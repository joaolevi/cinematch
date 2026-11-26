"""Buscar Mídias, detalhe e mídias em alta."""

from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Dismissed, Follow, ListItem, Media, ReviewComment, ReviewLike, User, UserList
from ..schemas import (
    TopItemOut,
    TopOut,
    TrailerOut,
    ConnectionOut, MediaDetailOut, MediaFacetsOut, MediaOut, MediaPage, MediaType, MoodOut, MyStatus, OccasionOut, ProviderOut,
    ReviewOut, ServiceOut,
    ShowcaseOut,
    FriendRatingOut,
)
from ..services.bridges import connections, showcase
from .community import counts_by_entry
from ..services.episodes import counts_by_season
from ..services.top import top_titles
from ..services.trailers import trailer_of
from ..services.catalog import search_text
from ..services.moods import MOODS, OCCASIONS
from ..services.streaming import SERVICES, catalog_counts
from ..services.providers import where_to_watch
from ..services.sources import credit_for
from ..services.visibility import visible_owner
from ..services.recommender import similar_titles, trending as trending_service

router = APIRouter(prefix="/media", tags=["mídias"])

MIN_TITLES_PER_DECADE = 3


@router.get("", response_model=MediaPage)
def search_media(
    q: str | None = Query(default=None, description="Trecho do título, criador, ator ou tag"),
    type: MediaType | None = None,
    genre: str | None = None,
    person: str | None = Query(default=None, description="Nome exato de um diretor, criador ou ator"),
    mood: str | None = Query(default=None, description='Clima (RFF23), como "melancolico"; veja GET /media/moods'),
    decade: int | None = Query(default=None, ge=1900, le=2100, multiple_of=10, description="Década, como 1990 (#17)"),
    sort: str = Query(default="popularity", pattern="^(popularity|title|year)$"),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    items = list(db.scalars(select(Media)))
    if type:
        items = [m for m in items if m.type == type]
    if genre:
        items = [m for m in items if genre in (m.genres or [])]
    if mood:
        items = [m for m in items if mood in (m.moods or [])]
    if decade:
        items = [m for m in items if m.year and m.year // 10 * 10 == decade]
    if person:
        wanted = search_text(person.strip())
        items = [m for m in items if wanted in {search_text(n) for n in (m.creators or []) + (m.actors or [])}]
    if q:
        needle = search_text(q.strip())
        items = [
            m
            for m in items
            if needle in search_text(m.title)
            or any(needle in search_text(c) for c in m.creators or [])
            or any(needle in search_text(a) for a in m.actors or [])
            or any(needle in search_text(t) for t in m.tags or [])
        ]
    if sort == "title":
        items.sort(key=lambda m: search_text(m.title))
    elif sort == "year":
        this_year = date.today().year  # o que ainda não estreou fica no fim da lista
        items.sort(key=lambda m: ((m.year or 0) > this_year, -(m.year or 0), -m.popularity))
    elif q:
        # títulos que começam com o termo vêm primeiro
        items.sort(key=lambda m: (not search_text(m.title).startswith(needle), -m.popularity))
    else:
        items.sort(key=lambda m: -m.popularity)
    return MediaPage(items=items[offset : offset + limit], total=len(items))


VIDEO_TYPES = ("movie", "series")


@router.get("/genres", response_model=list[str])
def list_genres(
    type: MediaType | None = Query(
        default=None, description="Sem tipo, só os gêneros de filmes e séries; `album` traz os gêneros musicais"
    ),
    db: Session = Depends(get_db),
):
    types = (type,) if type else VIDEO_TYPES
    genres: set[str] = set()
    for g in db.scalars(select(Media.genres).where(Media.type.in_(types))):
        genres.update(g or [])
    return sorted(genres)


@router.get("/moods", response_model=list[MoodOut])
def moods(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """O vocabulário de climas (RNFF09), na ordem de sempre, com quantos títulos têm cada um. Os climas valem para
    filmes, séries e álbuns: a busca por clima (RFF23) traz as três mídias juntas."""
    counts = Counter(mood for m in db.scalars(select(Media)) for mood in m.moods or [])
    return [MoodOut(key=m.key, label=m.label, count=counts[m.key]) for m in MOODS]


@router.get("/occasions", response_model=list[OccasionOut])
def occasions(_user: User = Depends(get_current_user)):
    """As ocasiões do momento (RFF20): a dois, com amigos e em família. Cada uma aceita alguns climas; "em família"
    também tira terror, crime, suspense e guerra. Use a chave em `occasion` de `GET /recommendations`."""
    return [OccasionOut(key=o.key, label=o.label) for o in OCCASIONS]


@router.get("/services", response_model=list[ServiceOut])
def services(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Os serviços de streaming que a pessoa pode marcar como seus (RFF21), com quantos títulos do catálogo estão em
    cada um, por assinatura. Os dados de onde assistir são da JustWatch, pelo TMDB (`make servicos` busca todos)."""
    counts = catalog_counts(db)
    return [ServiceOut(key=s.key, label=s.label, count=counts[s.key]) for s in SERVICES]


@router.get("/facets", response_model=MediaFacetsOut)
def media_facets(
    genre: list[str] = Query(default=[]),
    type: MediaType | None = Query(default=None, description="Sem tipo, filmes e séries; `album` traz décadas e artistas"),
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Décadas e criadores do catálogo, para o onboarding. Criadores vêm ordenados pela popularidade."""
    items = list(db.scalars(select(Media).where(Media.type.in_((type,) if type else VIDEO_TYPES))))
    if genre:
        items = [m for m in items if set(genre) & set(m.genres or [])]
    decades = Counter((m.year // 10) * 10 for m in items if m.year)
    creators: Counter[str] = Counter()
    for m in items:
        for creator in m.creators or []:
            creators[creator] += m.popularity
    return MediaFacetsOut(
        decades=sorted((d for d, count in decades.items() if count >= MIN_TITLES_PER_DECADE), reverse=True),
        creators=[name for name, _ in creators.most_common(limit)],
    )


@router.get("/trending", response_model=list[MediaOut])
def trending(
    type: MediaType | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return [r.media for r in trending_service(db, type, limit)]


@router.get("/top", response_model=TopOut)
def top(
    type: MediaType | None = None,
    limit: int = Query(default=10, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """O Top 10 do Tastory: os títulos mais registrados pela comunidade nos últimos 7 dias, com a nota média. Se a
    semana teve poucos registros, vale o último mês (`days` diz qual). Contas simuladas não entram."""
    days, items = top_titles(db, 7, limit, type)
    return TopOut(days=days, items=[TopItemOut(media=MediaOut.model_validate(i["media"]), count=i["count"],
                                               average=i["average"]) for i in items])


@router.get("/showcase", response_model=ShowcaseOut)
def media_showcase(db: Session = Depends(get_db)):
    """Exemplos para a página de apresentação, sem login: pares de filme ou série e disco ligados por trilha,
    cinebiografia, documentário ou compositor (RFF26, RFF27), e os álbuns mais ouvidos do catálogo."""
    return showcase(db)


@router.get("/{media_id}/similar", response_model=list[MediaOut])
def similar(
    media_id: int,
    limit: int = Query(default=12, ge=1, le=24),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    crud.get_media_or_404(db, media_id)
    return similar_titles(db, user, media_id, limit)


@router.get("/{media_id}/connections", response_model=list[ConnectionOut])
def media_connections(
    media_id: int,
    limit: int = Query(default=12, ge=1, le=30),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """"Para ouvir depois" (no detalhe de um filme ou série) e "Para ver depois" (no detalhe de um álbum).

    Primeiro as pontes fortes (trilha, compositor, mesma pessoa), depois as fracas (gênero, década e país, pelo menos
    duas juntas). `reason` já vem escrito para o detalhe deste título.
    """
    media = crud.get_media_or_404(db, media_id)
    return [
        ConnectionOut(media=MediaOut.model_validate(other), kind=link.kind, weight=link.weight, reason=reason)
        for other, link, reason in connections(db, media, limit)
    ]


@router.get("/{media_id}/trailer", response_model=TrailerOut, responses={404: {"description": "Sem trailer"}})
def trailer(media_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """O trailer do filme ou da série, do TMDB (YouTube): em português quando há, senão em inglês. 404 quando não
    há trailer, para álbuns e para títulos que não vieram do TMDB."""
    found = trailer_of(crud.get_media_or_404(db, media_id))
    if found is None:
        raise HTTPException(status_code=404, detail="Este título não tem trailer")
    return TrailerOut(**found, url=f"https://www.youtube.com/watch?v={found['key']}",
                      embed_url=f"https://www.youtube-nocookie.com/embed/{found['key']}?autoplay=1&rel=0")


@router.get("/{media_id}/providers", response_model=list[ProviderOut])
def media_providers(media_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Onde assistir no Brasil: assinatura, aluguel e compra, pelo TMDB, com dados da JustWatch (mostre o crédito).
    Guardado por 7 dias. Vazio para álbuns (eles têm `links`) e para títulos fora do TMDB."""
    return where_to_watch(db, crud.get_media_or_404(db, media_id))


@router.get("/{media_id}", response_model=MediaDetailOut)
def media_detail(
    media_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    media = crud.get_media_or_404(db, media_id)
    avg, count = db.execute(
        select(func.avg(DiaryEntry.rating), func.count(DiaryEntry.rating)).where(
            DiaryEntry.media_id == media_id
        )
    ).one()
    entries = db.scalars(
        select(DiaryEntry)
        .join(User, User.id == DiaryEntry.user_id)
        .where(
            DiaryEntry.media_id == media_id,
            DiaryEntry.review.is_not(None),
            DiaryEntry.review_hidden.is_(False),
            visible_owner(user.id),  # só as resenhas de quem deixa ver (RFF10)
        )
        .order_by(DiaryEntry.created_at.desc())
        .limit(50)
    ).all()
    # Curtir e comentar a resenha também na página do título, como na Comunidade (RFF30)
    ids = [e.id for e in entries]
    likes = counts_by_entry(db, ReviewLike.entry_id, ids)
    comments = counts_by_entry(db, ReviewComment.entry_id, ids, ReviewComment.hidden.is_(False))
    liked = set(db.scalars(select(ReviewLike.entry_id).where(ReviewLike.entry_id.in_(ids), ReviewLike.user_id == user.id)))
    follows = set(db.scalars(select(Follow.followed_id).where(Follow.follower_id == user.id)))
    from .community import reported_by

    reported = reported_by(db, ids, user.id)
    reviews = [
        ReviewOut(
            id=e.id,
            spoiler=bool(e.spoiler),
            following=e.user_id in follows,
            user_id=e.user_id,
            user_name=e.user.name,
            rating=e.rating,
            review=e.review or "",
            consumed_at=e.consumed_at,
            created_at=e.created_at,
            likes=likes.get(e.id, 0),
            liked=e.id in liked,
            comments=comments.get(e.id, 0),
            reported=e.id in reported,
        )
        for e in entries
    ]

    mine = db.scalar(
        select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media_id)
    )
    lists = db.execute(
        select(UserList.id, UserList.is_watchlist)
        .join(ListItem)
        .where(UserList.user_id == user.id, ListItem.media_id == media_id)
    ).all()
    dismissed = db.scalar(
        select(Dismissed).where(Dismissed.user_id == user.id, Dismissed.media_id == media_id)
    )
    status = MyStatus(
        diary_entry_id=mine.id if mine else None,
        rating=mine.rating if mine else None,
        consumed_at=mine.consumed_at if mine else None,
        status=mine.status if mine else None,
        season=mine.season if mine else None,
        episodes=counts_by_season(db, user.id, media_id) if media.type == "series" else {},
        spoiler=bool(mine.spoiler) if mine else False,
        in_watchlist=any(is_wl for _, is_wl in lists),
        dismissed=dismissed is not None,
        list_ids=[lid for lid, is_wl in lists if not is_wl],
    )
    # A distribuição das notas, como a do Letterboxd: 10 colunas, de 0,5 a 5
    histogram = [0] * 10
    for (rating,) in db.execute(select(DiaryEntry.rating).where(DiaryEntry.media_id == media_id, DiaryEntry.rating.is_not(None))):
        histogram[min(9, max(0, round(rating * 2) - 1))] += 1
    # Quem eu sigo e registrou o título, com a nota: a prova social que mais pesa (respeitando quem vê o quê)
    friend_rows = db.execute(
        select(User.id, User.name, DiaryEntry.rating, DiaryEntry.status)
        .join(DiaryEntry, DiaryEntry.user_id == User.id)
        .where(DiaryEntry.media_id == media_id, User.id.in_(follows), visible_owner(user.id))
        .order_by(DiaryEntry.rating.desc().nulls_last())
        .limit(12)
    ).all()
    friends = [FriendRatingOut(id=i, name=n, rating=r, status=st or "seen") for i, n, r, st in friend_rows]
    return MediaDetailOut(
        **MediaOut.model_validate(media).model_dump(),
        actors=media.actors or [],
        histogram=histogram,
        friends=friends,
        seasons=media.seasons or [] if media.type == "series" else [],
        credit=credit_for(media),
        avg_rating=round(float(avg), 2) if avg is not None else None,
        ratings_count=int(count or 0),
        reviews=reviews,
        my_status=status,
    )
