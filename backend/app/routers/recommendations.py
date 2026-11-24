"""Ver Recomendações, Descartar Recomendação e feedback do feed (Quero ver / Já vi / Não me interesso)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import Media, RecEvent, User
from ..schemas import BecauseOut, FeedbackIn, FeedOut, ImpressionsIn, MediaOut, MediaType, RecommendationOut
from ..services.bridges import album_suggestions, mix_albums
from ..services.moods import BY_KEY as MOODS
from ..services.recommender import Recommendation, decade_label, recommend

router = APIRouter(prefix="/recommendations", tags=["recomendações"])


def moment_filter(db: Session, mood: str | None, max_minutes: int | None) -> set[int] | None:
    """Os títulos que cabem no momento (RFF20): com o clima pedido e, com `max_minutes`, até essa duração (na série,
    a do episódio). Títulos sem duração conhecida ficam de fora quando há limite. Sem filtro, None (vale tudo)."""
    if not mood and not max_minutes:
        return None
    allowed = set()
    for m in db.scalars(select(Media)):
        if mood and mood not in (m.moods or []):
            continue
        if max_minutes and (m.duration_min is None or m.duration_min > max_minutes):
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


def rec_out(db: Session, r: Recommendation) -> RecommendationOut:
    return RecommendationOut(
        media=MediaOut.model_validate(r.media),
        score=round(r.score, 4),
        reason=r.reason,
        strategy=r.strategy,
        because=because_out(db, r),
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
    mood: str | None = Query(default=None, description='Momento (RFF20): só títulos com este clima, como "leve"'),
    max_minutes: int | None = Query(
        default=None, ge=10, le=600, description="Momento (RFF20): duração máxima; na série, a do episódio"
    ),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sem `type`, o feed misto: filmes e séries do recomendador e, em lugares fixos (3º, 7º, 11º...), álbuns ligados
    por ponte ao que a pessoa curtiu. Com `type=album`, só álbuns, pelas pontes e depois os mais ouvidos. O modo
    descoberta também vale para a música: parte dos discos passa a ser de gêneros que a pessoa ainda não ouve.
    `mood` e `max_minutes` restringem as sugestões ao momento (RFF20). Cada sugestão traz `because`, o que está por
    trás do motivo, para o "Não por esse motivo" (RFF08)."""
    allow = moment_filter(db, mood, max_minutes)
    if type == "album":
        strategy, recs = "bridge", album_suggestions(db, user.id, exclude, limit, discovery, allow)
    else:
        strategy, recs = recommend(db, user, type, limit, skip=exclude, discovery=discovery, allow=allow)
        if type is None:
            recs = mix_albums(recs, album_suggestions(db, user.id, exclude, limit, discovery, allow), limit)

    return FeedOut(variant=user.variant, strategy=strategy, items=[rec_out(db, r) for r in recs])


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
        crud.upsert_diary(
            db, user, media_id, rating=data.rating, review=data.review, consumed_at=data.consumed_at
        )
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
