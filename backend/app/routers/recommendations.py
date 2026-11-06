"""Ver Recomendações, Descartar Recomendação e feedback do feed (Quero ver / Já vi / Não me interesso)."""

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import Media, RecEvent, User
from ..schemas import FeedbackIn, FeedOut, ImpressionsIn, MediaOut, MediaType, RecommendationOut
from ..services.recommender import recommend

router = APIRouter(prefix="/recommendations", tags=["recomendações"])


@router.get("", response_model=FeedOut)
def feed(
    type: MediaType | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    exclude: list[int] = Query(default=[], description="Títulos que já foram mostrados, para trazer outros"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    strategy, recs = recommend(db, user, type, limit, skip=exclude)

    return FeedOut(
        variant=user.ab_group,
        strategy=strategy,
        items=[
            RecommendationOut(
                media=MediaOut.model_validate(r.media),
                score=round(r.score, 4),
                reason=r.reason,
                strategy=r.strategy,
            )
            for r in recs
        ],
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
                variant=user.ab_group,
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
    db.add(RecEvent(user_id=user.id, media_id=media_id, action=data.action, variant=user.ab_group))
    db.commit()
    return {"ok": True, "action": data.action}


@router.delete("/{media_id}/feedback", status_code=204)
def undo_dismiss(media_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Desfaz o "Não me interesso"."""
    crud.get_media_or_404(db, media_id)
    crud.undo_dismiss(db, user, media_id)
    db.commit()
    return Response(status_code=204)
