"""Registrar Consumo e Avaliar Mídia («extend»: a nota é opcional)."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Media, User
from ..schemas import DiaryIn, DiaryOut, DiaryUpdate
from ..services.notifications import notify_watchlist_owners

router = APIRouter(prefix="/diary", tags=["diário"])


def _check_progress(media: Media, status: str | None, season: int | None) -> None:
    """"Assistindo" e temporada só valem para séries, e a temporada precisa existir, quando sabemos quantas são."""
    if (status == "watching" or season is not None) and media.type != "series":
        raise HTTPException(status_code=422, detail="Só séries têm temporada e o estado assistindo")
    numbers = {t.get("number") for t in media.seasons or []}
    if season is not None and numbers and season not in numbers:
        raise HTTPException(status_code=422, detail=f"Esta série tem {len(numbers)} temporadas")


def _own_entry(db: Session, user: User, entry_id: int) -> DiaryEntry:
    entry = db.get(DiaryEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return entry


@router.get("", response_model=list[DiaryOut])
def my_diary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(
        select(DiaryEntry)
        .options(selectinload(DiaryEntry.media))
        .where(DiaryEntry.user_id == user.id)
        .order_by(DiaryEntry.consumed_at.desc().nulls_last(), DiaryEntry.created_at.desc())
    ).all()


@router.post("", response_model=DiaryOut, status_code=201)
def register_consumption(
    data: DiaryIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Registra que viu, com nota e resenha opcionais. Nas séries, `status="watching"` e `season` acompanham quem ainda
    está assistindo (RFF24); registrar de novo com `status="seen"` marca que terminou."""
    media = crud.get_media_or_404(db, data.media_id)
    _check_progress(media, data.status, data.season)
    is_new = db.scalar(select(DiaryEntry.id).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == data.media_id)) is None
    entry = crud.upsert_diary(
        db, user, data.media_id, rating=data.rating, review=data.review, consumed_at=data.consumed_at,
        status=data.status, season=data.season,
    )
    entry.spoiler = data.spoiler
    if is_new:
        db.flush()
        notify_watchlist_owners(db, user, entry)
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
    if "consumed_at" in fields:
        entry.consumed_at = fields["consumed_at"]
    if fields.get("excluded") is not None:
        entry.excluded = fields["excluded"]
    if fields.get("spoiler") is not None:
        entry.spoiler = fields["spoiler"]
    if fields.get("status") is not None or fields.get("season") is not None:
        _check_progress(entry.media, fields.get("status"), fields.get("season"))
        if fields.get("status") is not None:
            entry.status = fields["status"]
        if fields.get("season") is not None:
            entry.season = fields["season"]
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_own_entry(db, user, entry_id))
    db.commit()
    return Response(status_code=204)
