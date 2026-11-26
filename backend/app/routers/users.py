"""Perfil de uma pessoa, a compatibilidade de gosto com quem está vendo (RFF15), seguir pessoas e ver quem segue quem
(RFF09), quem vê os registros de cada uma (RFF10) e o "Para ver ou ouvir junto" (RFF28)."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Follow, Media, ReviewLike, User, UserAvatar
from ..schemas import (
    CommunityEntryOut,
    MemberOut,
    FoundPersonOut,
    CompatibilityOut, DiaryOut, MediaOut, PersonOut, ProfileItemOut, ProfileOut, RecommendationOut, SuggestedPersonOut,
)
from ..services.notifications import notify
from ..services.compatibility import compatibility, suggest_people
from ..services.theme import badges
from ..services.together import together
from ..services.visibility import can_see_entries

router = APIRouter(prefix="/users", tags=["pessoas"])

MAX_ITEMS = 12


def visible_person(db: Session, user_id: int, me: User) -> User:
    """A pessoa, se quem vê pode ver o perfil dela. Perfil privado de outra pessoa dá 404, como se não existisse."""
    user = db.get(User, user_id)
    if user is None or (user.visibility == "private" and user.id != me.id):
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return user


def companion(db: Session, user_id: int, me: User) -> User:
    """Uma pessoa para ver ou ouvir junto (RFF28): não pode ser quem pede nem ter perfil privado (404), e quem pede
    precisa poder ver os registros dela (403, quando ela só mostra para quem segue)."""
    other = db.get(User, user_id)
    if other is None or other.id == me.id or other.visibility == "private":
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")
    if not can_see_entries(db, me, other):
        raise HTTPException(status_code=403, detail=f"Só quem segue {other.name.split()[0]} vê os registros")
    return other


def listed(me: User):
    """Quem aparece nas listas de quem segue e de quem é seguido: perfis privados ficam de fora, menos o de quem vê."""
    return or_(User.visibility != "private", User.id == me.id)


def people_out(db: Session, query) -> list[PersonOut]:
    return [PersonOut(id=p.id, name=p.name) for p in db.scalars(query.order_by(User.name))]


@router.get("/avatars", response_model=dict[str, str])
def avatars(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """As fotos de perfil que quem pede pode ver: id da pessoa -> o código da foto, que entra no endereço
    `/users/{id}/avatar/{codigo}`. Perfil privado de outra pessoa fica de fora. A tela pede uma vez e guarda."""
    rows = db.execute(select(UserAvatar.user_id, UserAvatar.token, User.visibility).join(User, User.id == UserAvatar.user_id))
    return {str(uid): token for uid, token, visibility in rows if visibility != "private" or uid == me.id}


@router.get("/{user_id}/avatar/{token}", responses={200: {"content": {"image/jpeg": {}}}, 404: {}})
def avatar_image(user_id: int, token: str, db: Session = Depends(get_db)):
    """A foto de perfil. Sem login, porque o navegador não manda o login numa imagem; quem não sabe o código, que muda a
    cada troca, recebe 404. O endereço muda com a foto, então pode ficar em cache por um ano."""
    avatar = db.get(UserAvatar, user_id)
    if avatar is None or not secrets.compare_digest(avatar.token, token):
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    return Response(content=avatar.image, media_type=avatar.content_type,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


def _plain(text: str) -> str:
    """Sem acentos e em minúsculas: "Júlia" acha "julia"."""
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode().lower()


@router.get("/search", response_model=list[FoundPersonOut])
def search_people(
    q: str = Query(min_length=2, max_length=60, description="Parte do nome, sem diferenciar acentos e maiúsculas"),
    limit: int = Query(default=10, ge=1, le=30),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Procura pessoas pelo nome. Quem tem o nome começando pelo que foi digitado vem antes. Perfis privados, a conta de
    demonstração e as contas simuladas ficam de fora, e quem só mostra o diário para quem segue aparece sem o número
    de títulos."""
    from ..seed import DEMO_EMAIL

    needle = _plain(q.strip())
    people = db.scalars(
        select(User).where(
            User.id != me.id, User.role == "user", User.is_synthetic.is_(False), User.email != DEMO_EMAIL,
            User.visibility != "private",
        )
    )
    found = [p for p in people if needle in _plain(p.name)]
    # Primeiro quem tem o nome começando pelo que foi digitado; depois, um sobrenome; por último, no meio do nome
    found.sort(key=lambda p: (
        not _plain(p.name).startswith(needle),
        not any(w.startswith(needle) for w in _plain(p.name).split()),
        _plain(p.name),
    ))
    found = found[:limit]
    if not found:
        return []
    ids = [p.id for p in found]
    followers = dict(db.execute(
        select(Follow.followed_id, func.count()).where(Follow.followed_id.in_(ids)).group_by(Follow.followed_id)
    ).all())
    titles = dict(db.execute(
        select(DiaryEntry.user_id, func.count()).where(DiaryEntry.user_id.in_(ids), DiaryEntry.from_onboarding.is_(False))
        .group_by(DiaryEntry.user_id)
    ).all())
    mine = set(db.scalars(select(Follow.followed_id).where(Follow.follower_id == me.id, Follow.followed_id.in_(ids))))
    return [
        FoundPersonOut(
            id=p.id, name=p.name, followers=followers.get(p.id, 0), following=p.id in mine,
            titles=titles.get(p.id, 0) if can_see_entries(db, me, p) else None,
        )
        for p in found
    ]


PERIOD_DAYS = {"semana": 7, "mes": 30, "sempre": None}


@router.get("/popular", response_model=list[MemberOut])
def popular_people(
    period: Literal["semana", "mes", "sempre"] = Query(default="semana", description="De quando contam os registros"),
    limit: int = Query(default=30, ge=1, le=60),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Pessoas, como os membros do Letterboxd: as mais ativas no período (registros na semana, no mês ou desde
    sempre), com resenhas, curtidas recebidas, seguidores e os três últimos títulos. Quem só mostra o diário para quem
    segue aparece sem os números do diário; perfis privados, a conta de demonstração e as contas simuladas ficam de
    fora."""
    from ..seed import DEMO_EMAIL
    from .community import HAS_REVIEW

    people = list(db.scalars(select(User).where(
        User.role == "user", User.is_synthetic.is_(False), User.email != DEMO_EMAIL, User.visibility != "private",
    )))
    if not people:
        return []
    ids = [p.id for p in people]
    days = PERIOD_DAYS[period]
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    base = [DiaryEntry.user_id.in_(ids), DiaryEntry.from_onboarding.is_(False)]
    per_user = lambda *where: dict(db.execute(  # noqa: E731
        select(DiaryEntry.user_id, func.count()).where(*base, *where).group_by(DiaryEntry.user_id)
    ).all())
    titles = per_user()
    active = per_user(DiaryEntry.created_at >= since) if since else titles
    reviews = per_user(*HAS_REVIEW)
    likes = dict(db.execute(
        select(DiaryEntry.user_id, func.count(ReviewLike.id)).join(ReviewLike, ReviewLike.entry_id == DiaryEntry.id)
        .where(DiaryEntry.user_id.in_(ids)).group_by(DiaryEntry.user_id)
    ).all())
    followers = dict(db.execute(
        select(Follow.followed_id, func.count()).where(Follow.followed_id.in_(ids)).group_by(Follow.followed_id)
    ).all())
    mine = set(db.scalars(select(Follow.followed_id).where(Follow.follower_id == me.id)))
    open_diary = {p.id: can_see_entries(db, me, p) for p in people}
    # Quem não deixa ver o diário entra pela quantidade de seguidores, sem revelar quanto registrou
    people.sort(key=lambda p: (-(active.get(p.id, 0) if open_diary[p.id] else 0), -followers.get(p.id, 0), p.name))
    out = []
    for p in people[:limit]:
        recent = []
        if open_diary[p.id]:
            recent = [MediaOut.model_validate(m) for m in db.scalars(
                select(Media).join(DiaryEntry, DiaryEntry.media_id == Media.id)
                .where(DiaryEntry.user_id == p.id, DiaryEntry.from_onboarding.is_(False))
                .order_by(DiaryEntry.created_at.desc()).limit(3)
            )]
        out.append(MemberOut(
            id=p.id, name=p.name, followers=followers.get(p.id, 0), following=p.id in mine, likes=likes.get(p.id, 0),
            titles=titles.get(p.id, 0) if open_diary[p.id] else None,
            active=active.get(p.id, 0) if open_diary[p.id] else None,
            reviews=reviews.get(p.id, 0) if open_diary[p.id] else None,
            recent=recent,
        ))
    return out


@router.get("/following", response_model=list[PersonOut])
def following(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Quem eu sigo, por nome. Perfis que ficaram privados saem da lista."""
    return people_out(
        db, select(User).join(Follow, Follow.followed_id == User.id).where(Follow.follower_id == me.id, listed(me))
    )


@router.get("/suggestions", response_model=list[SuggestedPersonOut])
def suggestions(
    limit: int = Query(default=5, ge=1, le=20), db: Session = Depends(get_db), me: User = Depends(get_current_user)
):
    """Quem seguir (RFF15): pessoas de gosto parecido que eu ainda não sigo, da mais compatível para a menos, com
    pelo menos 25%. Só entra quem deixa ver os registros para todos."""
    return [SuggestedPersonOut(**p) for p in suggest_people(db, me, limit)]


@router.get("/{user_id}/followers", response_model=list[PersonOut])
def followers_of(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Quem segue esta pessoa, por nome (RFF09). Perfis privados ficam de fora, como nos números do perfil."""
    user = visible_person(db, user_id, me)
    return people_out(
        db, select(User).join(Follow, Follow.follower_id == User.id).where(Follow.followed_id == user.id, listed(me))
    )


@router.get("/{user_id}/follows", response_model=list[PersonOut])
def follows_of(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Quem esta pessoa segue, por nome (RFF09). Perfis privados ficam de fora, como nos números do perfil."""
    user = visible_person(db, user_id, me)
    return people_out(
        db, select(User).join(Follow, Follow.followed_id == User.id).where(Follow.follower_id == user.id, listed(me))
    )


@router.put("/{user_id}/follow", status_code=204)
def follow(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Seguir uma pessoa (RFF09). Não pede aceite e repetir não muda nada."""
    user = visible_person(db, user_id, me)
    if user.id == me.id:
        raise HTTPException(status_code=400, detail="Não dá para seguir o próprio perfil")
    exists = db.scalar(select(Follow.id).where(Follow.follower_id == me.id, Follow.followed_id == user.id))
    if exists is None:
        db.add(Follow(follower_id=me.id, followed_id=user.id))
        notify(db, user.id, "seguiu", me.id)
        db.commit()
    return Response(status_code=204)


@router.delete("/{user_id}/follow", status_code=204)
def unfollow(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Deixar de seguir. Quem não seguia continua sem seguir."""
    db.execute(delete(Follow).where(Follow.follower_id == me.id, Follow.followed_id == user_id))
    db.commit()
    return Response(status_code=204)


@router.get("/{user_id}", response_model=ProfileOut)
def profile(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """O perfil de uma pessoa: quanto ela registrou, o que mais curtiu, o que registrou por último e, quando não é a
    própria pessoa, "Vocês combinam X%" com o que as duas têm em comum. Traz também se quem vê segue a pessoa e quantas
    pessoas ela segue e a seguem. Perfil privado (visibility = private) dá 404. Se a pessoa só deixa quem a segue ver
    os registros e quem vê não segue, volta o nome e os números de quem segue, com `restricted` e sem os registros."""
    user = visible_person(db, user_id, me)
    count = lambda side, other: db.scalar(  # noqa: E731
        select(func.count()).select_from(Follow).join(User, User.id == other).where(side == user.id, listed(me))
    ) or 0
    followers = count(Follow.followed_id, Follow.follower_id)
    follows = count(Follow.follower_id, Follow.followed_id)
    following_now = db.scalar(select(Follow.id).where(Follow.follower_id == me.id, Follow.followed_id == user.id)) is not None
    if not can_see_entries(db, me, user):
        return ProfileOut(
            id=user.id, name=user.name, is_me=False, counts={"movie": 0, "series": 0, "album": 0}, favorites=[],
            recent=[], compatibility=None, following=following_now, followers=followers, follows=follows,
            restricted=True,
        )
    entries = list(
        db.scalars(
            select(DiaryEntry)
            .where(DiaryEntry.user_id == user_id, DiaryEntry.from_onboarding.is_(False))
            .options(selectinload(DiaryEntry.media))
            .order_by(DiaryEntry.created_at.desc())
        )
    )
    counts = {"movie": 0, "series": 0, "album": 0}
    for e in entries:
        counts[e.media.type] = counts.get(e.media.type, 0) + 1
    rated = sorted((e for e in entries if e.rating is not None), key=lambda e: (-e.rating, -e.id))
    item = lambda e: ProfileItemOut(media=MediaOut.model_validate(e.media), rating=e.rating)  # noqa: E731
    compat = None
    if user.id != me.id:
        c = compatibility(db, me.id, user.id)
        compat = CompatibilityOut(
            percent=c["percent"],
            label=c["label"],
            shared=[MediaOut.model_validate(m) for m in c["shared"]],
            genres=c["genres"],
        )
    return ProfileOut(
        id=user.id,
        name=user.name,
        is_me=user.id == me.id,
        counts=counts,
        favorites=[item(e) for e in rated[:MAX_ITEMS]],
        recent=[item(e) for e in entries[:MAX_ITEMS]],
        compatibility=compat,
        following=following_now,
        followers=followers,
        follows=follows,
        badges=badges(db, user.id),
        pinned=pinned_media(db, user),
    )


def pinned_media(db: Session, user: User) -> list:
    """Os cinco favoritos, na ordem escolhida. Um título que saiu do diário sai dos favoritos também."""
    ids = list(user.pinned or [])
    if not ids:
        return []
    in_diary = set(db.scalars(select(DiaryEntry.media_id).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id.in_(ids))))
    by_id = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_(ids)))}
    return [MediaOut.model_validate(by_id[i]) for i in ids if i in by_id and i in in_diary]


MAX_DIARY = 1000


@router.get("/{user_id}/reviews", response_model=list[CommunityEntryOut])
def person_reviews(
    user_id: int,
    sort: Literal["recentes", "populares"] = "recentes",
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """As resenhas da pessoa, como a aba Resenhas do perfil no Letterboxd: as mais novas ou as mais curtidas, com
    curtidas e comentários. Quem só mostra o diário para quem segue: 403 para quem não segue. Perfil privado: 404."""
    from .community import HAS_REVIEW, entries_out

    user = visible_person(db, user_id, me)
    if not can_see_entries(db, me, user):
        raise HTTPException(status_code=403, detail="As resenhas são só para quem segue")
    q = select(DiaryEntry).where(DiaryEntry.user_id == user.id, *HAS_REVIEW).options(
        selectinload(DiaryEntry.media), selectinload(DiaryEntry.user)
    )
    if sort == "populares":
        likes = select(func.count(ReviewLike.id)).where(ReviewLike.entry_id == DiaryEntry.id).scalar_subquery()
        q = q.order_by(likes.desc(), DiaryEntry.created_at.desc())
    else:
        q = q.order_by(DiaryEntry.created_at.desc(), DiaryEntry.id.desc())
    return entries_out(db, list(db.scalars(q.offset(offset).limit(limit))), me)


@router.get("/{user_id}/diary", response_model=list[DiaryOut])
def person_diary(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """O diário de uma pessoa, para a história do gosto no perfil (RFF11): a frase, os números e os gráficos são
    calculados na tela, como no próprio diário. Segue a mesma regra do perfil: perfil privado de outra pessoa dá 404, e
    quem só mostra para quem segue dá 403 para quem não segue. Resenhas escondidas pela moderação não saem."""
    user = visible_person(db, user_id, me)
    if not can_see_entries(db, me, user):
        raise HTTPException(status_code=403, detail="Só quem segue esta pessoa vê o diário dela")
    entries = list(
        db.scalars(
            select(DiaryEntry)
            .where(DiaryEntry.user_id == user.id)
            .options(selectinload(DiaryEntry.media))
            .order_by(DiaryEntry.consumed_at.desc().nulls_last(), DiaryEntry.created_at.desc())
            .limit(MAX_DIARY)
        )
    )
    out = []
    for e in entries:
        item = DiaryOut.model_validate(e)
        if e.review_hidden and user.id != me.id:
            item.review = None
        out.append(item)
    return out


@router.get("/{user_id}/together", response_model=list[RecommendationOut])
def watch_together(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Assistir ou ouvir junto (RFF28): sugestões para quem vê e esta pessoa. Primeiro o que aparece para as duas,
    depois o que agrada a uma e a outra ainda não viu. O motivo mostra os dois lados ("Para você: ... · Para Levi: ...").
    Itens que alguma das duas já registrou, descartou ou guardou ficam de fora. Só vale com quem deixa ver os
    registros (RFF10): com perfil privado dá 404; só para quem segue, sem seguir, dá 403. Para mais pessoas e com o
    momento, use `GET /recommendations/together`."""
    other = companion(db, user_id, me)
    return [
        RecommendationOut(media=MediaOut.model_validate(r.media), score=r.score, reason=r.reason, strategy=r.strategy)
        for r in together(db, [me, other], limit)
    ]
