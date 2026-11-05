"""Registrar Consumo e Avaliar Mídia («extend»: a nota é opcional)."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, User
from ..schemas import DiaryIn, DiaryOut, DiaryUpdate

router = APIRouter(prefix="/diary", tags=["diário"])


def _own_entry(db: Session, user: User, entry_id: int) -> DiaryEntry:
    entry = db.get(DiaryEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return entry


@router.get("", response_model=list[DiaryOut])
def my_diary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user.id)
        .order_by(DiaryEntry.consumed_at.desc().nulls_last(), DiaryEntry.created_at.desc())
    ).all()


@router.post("", response_model=DiaryOut, status_code=201)
def register_consumption(
    data: DiaryIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    crud.get_media_or_404(db, data.media_id)
    entry = crud.upsert_diary(
        db, user, data.media_id, rating=data.rating, review=data.review, consumed_at=data.consumed_at
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=DiaryOut)
def update_entry(
    entry_id: int,
    data: DiaryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = _own_entry(db, user, entry_id)
    fields = data.model_dump(exclude_unset=True)
    if "rating" in fields:
        entry.rating = fields["rating"]
    if "review" in fields:
        entry.review = (fields["review"] or "").strip() or None
        entry.review_hidden = False
    if "consumed_at" in fields:
        entry.consumed_at = fields["consumed_at"]
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_own_entry(db, user, entry_id))
    db.commit()
    return Response(status_code=204)
