"""Perfil de uma pessoa e a compatibilidade de gosto com quem está vendo (RFF15)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, User
from ..schemas import CompatibilityOut, MediaOut, ProfileItemOut, ProfileOut
from ..services.compatibility import compatibility

router = APIRouter(prefix="/users", tags=["pessoas"])

MAX_ITEMS = 12


@router.get("/{user_id}", response_model=ProfileOut)
def profile(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """O perfil de uma pessoa: quanto ela registrou, o que mais curtiu, o que registrou por último e, quando não é a
    própria pessoa, "Vocês combinam X%" com o que as duas têm em comum. Perfil privado (visibility = private) dá 404."""
    user = db.get(User, user_id)
    if user is None or (user.visibility == "private" and user.id != me.id):
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
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
    )
