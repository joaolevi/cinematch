"""Ver Recomendações, Descartar Recomendação e feedback do feed (Quero ver / Já vi / Não me interesso)."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Media, RecEvent, User
from ..schemas import (
    MixOut,
    BecauseOut, FeedbackIn, FeedOut, ImpressionsIn, MediaOut, MediaType, PairOut, RecommendationOut, WatchlistNowOut,
    WishOut,
)
from ..services.bridges import album_suggestions, double_features, mix_albums, music_mixes
from ..services.moods import BY_KEY as MOODS, OCCASIONS_BY_KEY, fits_occasion
from ..services.recommender import Recommendation, decade_label, recommend
from ..services.streaming import available_ids, labels_on, streaming_on
from ..services.together import MAX_PEOPLE, together
from ..services.notifications import notify_watchlist_owners
from ..services.wish import understand
from .users import companion

router = APIRouter(prefix="/recommendations", tags=["recomendações"])


def moment_filter(
    db: Session,
    mood: str | None,
    max_minutes: int | None,
    occasion: str | None = None,
    services: list[str] | None = None,
) -> set[int] | None:
    """Os títulos que cabem no momento (RFF20): com o clima pedido, até `max_minutes` (na série, a duração do
    episódio), que combinam com a ocasião e, com `services`, que estão nesses serviços (RFF21). Títulos sem duração
    conhecida ficam de fora quando há limite. Sem filtro, None (vale tudo)."""
    if not mood and not max_minutes and not occasion and services is None:
        return None
    wanted = OCCASIONS_BY_KEY.get(occasion) if occasion else None
    on_services = available_ids(db, services) if services is not None else None
    allowed = set()
    for m in db.scalars(select(Media)):
        if mood and mood not in (m.moods or []):
            continue
        if max_minutes and (m.duration_min is None or m.duration_min > max_minutes):
            continue
        if occasion and (wanted is None or not fits_occasion(m, wanted)):
            continue
        if on_services is not None and m.id not in on_services:
            continue
        allowed.add(m.id)
    return allowed


def because_out(db: Session, r: Recommendation) -> BecauseOut | None:
    if r.because is None:
        return None
    kind, value = r.because
    if kind == "title":
        label = db.scalar(select(Media.title).where(Media.id == int(value))) or value
    elif kind == "decade":
        label = decade_label(int(value))
    elif kind == "mood":
        label = MOODS[value].label if value in MOODS else value
    else:
        label = value
    return BecauseOut(kind=kind, value=value, label=label)


def rec_out(db: Session, r: Recommendation, services: list[str] | None = None) -> RecommendationOut:
    return RecommendationOut(
        media=MediaOut.model_validate(r.media),
        score=round(r.score, 4),
        reason=r.reason,
        strategy=r.strategy,
        because=because_out(db, r),
        services=labels_on(r.media, services or []),
        streaming=streaming_on(r.media),
    )


MOOD_QUERY = Query(default=None, description='Momento (RFF20): só títulos com este clima, como "leve"')
MINUTES_QUERY = Query(default=None, ge=10, le=600, description="Momento (RFF20): duração máxima; na série, a do episódio")
OCCASION_QUERY = Query(
    default=None, description='Momento (RFF20): a ocasião, "a-dois", "amigos" ou "familia"; veja GET /media/occasions'
)
ONLY_MINE_QUERY = Query(
    default=False,
    description="Só filmes e séries que estão, por assinatura, nos serviços da pessoa (RFF21). Sem serviços marcados, "
    "não sobra nada",
)


@router.get("", response_model=FeedOut)
def feed(
    type: MediaType | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    exclude: list[int] = Query(default=[], description="Títulos que já foram mostrados, para trazer outros"),
    discovery: Literal["taste", "beyond", "outside"] = Query(
        default="taste",
        description='Modo descoberta: "taste" (no meu gosto, o padrão), "beyond" (um pouco além) ou "outside" '
        "(fora da sua bolha). Os dois últimos puxam para títulos menos famosos e gêneros que a pessoa consome menos",
    ),
    mood: str | None = MOOD_QUERY,
    max_minutes: int | None = MINUTES_QUERY,
    occasion: str | None = OCCASION_QUERY,
    only_mine: bool = ONLY_MINE_QUERY,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sem `type`, o feed misto: filmes e séries do recomendador e, em lugares fixos (3º, 7º, 11º...), álbuns ligados
    por ponte ao que a pessoa curtiu. Com `type=album`, só álbuns, pelas pontes e depois os mais ouvidos. O modo
    descoberta também vale para a música: parte dos discos passa a ser de gêneros que a pessoa ainda não ouve.
    `mood`, `max_minutes` e `occasion` restringem as sugestões ao momento (RFF20), e `only_mine`, aos serviços da
    pessoa (RFF21); o atalho "Hoje à noite" junta os dois. Cada sugestão traz `because`, o que está por trás do motivo,
    para o "Não por esse motivo" (RFF08), e `services`, os serviços da pessoa onde o título está."""
    allow = moment_filter(db, mood, max_minutes, occasion, user.services or [] if only_mine else None)
    if type == "album":
        strategy, recs = "bridge", album_suggestions(db, user.id, exclude, limit, discovery, allow)
    else:
        strategy, recs = recommend(db, user, type, limit, skip=exclude, discovery=discovery, allow=allow)
        if type is None:
            recs = mix_albums(recs, album_suggestions(db, user.id, exclude, limit, discovery, allow), limit)

    return FeedOut(variant=user.variant, strategy=strategy, items=[rec_out(db, r, user.services) for r in recs])


@router.get("/understand", response_model=WishOut)
def understand_wish(
    q: str = Query(min_length=1, max_length=200, description='O pedido, como "algo leve para a Sessão da Tarde"'),
    user: User = Depends(get_current_user),
):
    """Pedido em português (RFF25): transforma o texto nos filtros do momento (RFF20), no tipo de mídia, no modo
    descoberta (RFF16) e no "só nos meus serviços" (RFF21). É um dicionário de expressões, sem IA, e não recomenda nada:
    a tela aplica os filtros e pede o feed de sempre. `understood` mostra o que cada trecho virou; `ignored`, o que
    ficou de fora."""
    return understand(q)


@router.get("/mixes", response_model=list[MixOut])
def mixes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Mixes de música, como os do Spotify: um para cada gênero que a pessoa mais ouve (MPB, tropicália, bossa
    nova...), com discos que ela ainda não registrou, e um com as trilhas do que ela viu. Cada disco entra em um mix
    só; mix com menos de 3 discos não aparece."""
    return [MixOut(title=m["title"], subtitle=m["subtitle"], items=[MediaOut.model_validate(a) for a in m["items"]])
            for m in music_mixes(db, user.id)]


@router.get("/pairs", response_model=list[PairOut])
def pairs(
    limit: int = Query(default=3, ge=1, le=10),
    exclude: list[int] = Query(default=[], description="Filmes e séries que já estão na tela, para não repetir"),
    mood: str | None = MOOD_QUERY,
    max_minutes: int | None = MINUTES_QUERY,
    occasion: str | None = OCCASION_QUERY,
    only_mine: bool = ONLY_MINE_QUERY,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sessão dupla (RFF27): um filme ou série sugerido e um disco para ouvir depois, ligados por uma ponte forte
    (trilha, compositor, quem atua e canta, cinebiografia ou documentário). O momento vale para os dois lados, menos a
    duração e os serviços, que só valem para o filme ou a série. Não entra na comparação A/B."""
    video_allow = moment_filter(db, mood, max_minutes, occasion, user.services or [] if only_mine else None)
    album_allow = moment_filter(db, mood, None, occasion, None)
    return [
        PairOut(video=rec_out(db, p.video, user.services), album=MediaOut.model_validate(p.album), kind=p.kind,
                reason=p.reason)
        for p in double_features(db, user, limit, exclude, video_allow, album_allow)
    ]


@router.get("/together", response_model=list[RecommendationOut])
def watch_together(
    with_: list[int] = Query(
        alias="with", description=f"Quem assiste ou ouve junto: de 1 a {MAX_PEOPLE - 1} pessoas, pelo id"
    ),
    limit: int = Query(default=20, ge=1, le=40),
    mood: str | None = MOOD_QUERY,
    max_minutes: int | None = MINUTES_QUERY,
    occasion: str | None = OCCASION_QUERY,
    only_mine: bool = ONLY_MINE_QUERY,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Para ver ou ouvir junto (RFF28), no momento (RFF20): sugestões para quem pede e mais uma a quatro pessoas.
    Primeiro o que aparece para todas, depois para menos gente; o motivo mostra cada lado. Nada que alguma já
    registrou, descartou ou guardou entra. `mood`, `max_minutes`, `occasion` e `only_mine` funcionam como no feed; os
    serviços são os de quem pede, que é quem vai pôr para tocar. Cada pessoa precisa deixar quem pede ver os registros
    (RFF10): perfil privado dá 404; só para quem segue, sem seguir, dá 403."""
    ids = list(dict.fromkeys(with_))
    if not 1 <= len(ids) <= MAX_PEOPLE - 1:
        raise HTTPException(status_code=422, detail=f"Escolha de 1 a {MAX_PEOPLE - 1} pessoas")
    people = [user] + [companion(db, i, user) for i in ids]
    allow = moment_filter(db, mood, max_minutes, occasion, user.services or [] if only_mine else None)
    return [rec_out(db, r, user.services) for r in together(db, people, limit, allow)]


SERVICE_BONUS = 1.2  # no Quero ver, o que está nos serviços da pessoa sobe um pouco


@router.get("/watchlist", response_model=WatchlistNowOut)
def watchlist_now(
    mood: str | None = MOOD_QUERY,
    max_minutes: int | None = MINUTES_QUERY,
    occasion: str | None = OCCASION_QUERY,
    only_mine: bool = ONLY_MINE_QUERY,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """O Quero ver ordenado pelo que combina agora (RFF22). `items` traz o que cabe no momento, do que mais combina
    com o gosto ao que menos; o que está nos serviços da pessoa ganha um pouco de peso. `later` traz o resto da lista,
    na ordem em que foi guardado. Álbuns e títulos que o recomendador não pontua vão para o fim de `items`."""
    watchlist = crud.get_or_create_watchlist(db, user)
    saved = [item.media for item in watchlist.items]  # do mais recente ao mais antigo
    fit = moment_filter(db, mood, max_minutes, occasion, user.services or [] if only_mine else None)
    now = [m for m in saved if fit is None or m.id in fit]
    later = [m for m in saved if fit is not None and m.id not in fit]

    now_ids = {m.id for m in now}
    recs: list[Recommendation] = []
    if now_ids:
        _, recs = recommend(db, user, None, limit=len(now_ids), allow=now_ids, keep_watchlist=True)
    scored = {r.media.id for r in recs}
    mine = user.services or []
    recs.sort(key=lambda r: -r.score * (SERVICE_BONUS if labels_on(r.media, mine) else 1))
    recs += [Recommendation(m, 0.0, "Você guardou para ver ou ouvir depois", "watchlist") for m in now if m.id not in scored]
    return WatchlistNowOut(
        items=[rec_out(db, r, mine) for r in recs],
        later=[rec_out(db, Recommendation(m, 0.0, "Fica para outro momento", "watchlist"), mine) for m in later],
    )


@router.post("/impressions", status_code=204)
def impressions(
    data: ImpressionsIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Registra os títulos do feed que apareceram na tela, uma vez por usuário e título."""
    ids = {item.media_id for item in data.items}
    existing = set(db.scalars(select(Media.id).where(Media.id.in_(ids))))
    already_shown = set(
        db.scalars(
            select(RecEvent.media_id).where(
                RecEvent.user_id == user.id, RecEvent.action == "shown", RecEvent.media_id.in_(ids)
            )
        )
    )
    new = {i.media_id: i for i in data.items if i.media_id in existing - already_shown}
    for item in new.values():
        db.add(
            RecEvent(
                user_id=user.id,
                media_id=item.media_id,
                action="shown",
                variant=user.variant,
                strategy=item.strategy,
                score=item.score,
            )
        )
    db.commit()
    return Response(status_code=204)


@router.post("/{media_id}/feedback", status_code=201)
def feedback(
    media_id: int,
    data: FeedbackIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    crud.get_media_or_404(db, media_id)
    if data.action == "want":
        crud.add_to_list(db, crud.get_or_create_watchlist(db, user), media_id)
    elif data.action == "seen":
        is_new = db.scalar(select(DiaryEntry.id).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media_id)) is None
        entry = crud.upsert_diary(
            db, user, media_id, rating=data.rating, review=data.review, consumed_at=data.consumed_at
        )
        if is_new:
            db.flush()
            notify_watchlist_owners(db, user, entry)
    else:
        crud.dismiss(db, user, media_id)
    db.add(RecEvent(user_id=user.id, media_id=media_id, action=data.action, variant=user.variant))
    db.commit()
    return {"ok": True, "action": data.action}


@router.delete("/{media_id}/feedback", status_code=204)
def undo_dismiss(media_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Desfaz o "Não me interesso"."""
    crud.get_media_or_404(db, media_id)
    crud.undo_dismiss(db, user, media_id)
    db.commit()
    return Response(status_code=204)
