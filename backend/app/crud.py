"""Operações de domínio reutilizadas por vários routers (diário, listas, descartes)."""

from datetime import date

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import DiaryEntry, Dismissed, ListItem, Media, RecEvent, User, UserList


def get_media_or_404(db: Session, media_id: int) -> Media:
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")
    return media


def get_or_create_watchlist(db: Session, user: User) -> UserList:
    wl = db.scalar(
        select(UserList).where(UserList.user_id == user.id, UserList.is_watchlist.is_(True))
    )
    if wl is None:
        wl = UserList(user_id=user.id, name="Quero ver", is_watchlist=True)
        db.add(wl)
        db.flush()
    return wl


def add_to_list(db: Session, lst: UserList, media_id: int) -> None:
    exists = db.scalar(
        select(ListItem).where(ListItem.list_id == lst.id, ListItem.media_id == media_id)
    )
    if exists is None:
        db.add(ListItem(list_id=lst.id, media_id=media_id))


def remove_from_watchlist(db: Session, user: User, media_id: int) -> None:
    wl = get_or_create_watchlist(db, user)
    item = db.scalar(select(ListItem).where(ListItem.list_id == wl.id, ListItem.media_id == media_id))
    if item is not None:
        db.delete(item)


def upsert_diary(
    db: Session,
    user: User,
    media_id: int,
    rating: float | None = None,
    review: str | None = None,
    consumed_at: date | None = None,
    from_onboarding: bool = False,
) -> DiaryEntry:
    """Registra consumo. Se já existir registro do mesmo título, atualiza."""
    entry = db.scalar(
        select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media_id)
    )
    if entry is None:
        entry = DiaryEntry(
            user_id=user.id,
            media_id=media_id,
            consumed_at=consumed_at,
            from_onboarding=from_onboarding,
        )
        db.add(entry)
    elif consumed_at:
        entry.consumed_at = consumed_at
    if rating is not None:
        entry.rating = rating
    if review is not None:
        entry.review = review.strip() or None
    # quem já viu não precisa mais do título na watchlist nem nos descartes
    remove_from_watchlist(db, user, media_id)
    d = db.scalar(select(Dismissed).where(Dismissed.user_id == user.id, Dismissed.media_id == media_id))
    if d is not None:
        db.delete(d)
    db.flush()
    return entry


def add_onboarding_like(db: Session, user: User, media_id: int) -> None:
    """Registra um título curtido no onboarding, sem alterar o que já está no diário."""
    entry = db.scalar(
        select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media_id)
    )
    if entry is None:
        upsert_diary(db, user, media_id, rating=4.5, from_onboarding=True)


def undo_dismiss(db: Session, user: User, media_id: int) -> None:
    """Volta o título para as sugestões, como se o descarte não tivesse acontecido."""
    db.execute(delete(Dismissed).where(Dismissed.user_id == user.id, Dismissed.media_id == media_id))
    db.execute(
        delete(RecEvent).where(
            RecEvent.user_id == user.id, RecEvent.media_id == media_id, RecEvent.action == "dismiss"
        )
    )


def dismiss(db: Session, user: User, media_id: int) -> None:
    exists = db.scalar(
        select(Dismissed).where(Dismissed.user_id == user.id, Dismissed.media_id == media_id)
    )
    if exists is None:
        db.add(Dismissed(user_id=user.id, media_id=media_id))
