"""Buscar Mídias, detalhe e mídias em alta."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Dismissed, ListItem, Media, User, UserList
from ..schemas import MediaDetailOut, MediaOut, MediaPage, MediaType, MyStatus, ReviewOut
from ..services.catalog import search_text
from ..services.recommender import trending as trending_service

router = APIRouter(prefix="/media", tags=["mídias"])


@router.get("", response_model=MediaPage)
def search_media(
    q: str | None = Query(default=None, description="Trecho do título, criador ou tag"),
    type: MediaType | None = None,
    genre: str | None = None,
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
    if q:
        needle = search_text(q.strip())
        items = [
            m
            for m in items
            if needle in search_text(m.title)
            or any(needle in search_text(c) for c in m.creators or [])
            or any(needle in search_text(t) for t in m.tags or [])
        ]
        # títulos que começam com o termo vêm primeiro
        items.sort(key=lambda m: (not search_text(m.title).startswith(needle), -m.popularity))
    elif sort == "title":
        items.sort(key=lambda m: m.title.lower())
    elif sort == "year":
        items.sort(key=lambda m: -(m.year or 0))
    else:
        items.sort(key=lambda m: -m.popularity)
    return MediaPage(items=items[offset : offset + limit], total=len(items))


@router.get("/genres", response_model=list[str])
def list_genres(db: Session = Depends(get_db)):
    genres: set[str] = set()
    for g in db.scalars(select(Media.genres)):
        genres.update(g or [])
    return sorted(genres)


@router.get("/trending", response_model=list[MediaOut])
def trending(
    type: MediaType | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return [r.media for r in trending_service(db, type, limit)]


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
        .where(
            DiaryEntry.media_id == media_id,
            DiaryEntry.review.is_not(None),
            DiaryEntry.review_hidden.is_(False),
        )
        .order_by(DiaryEntry.created_at.desc())
        .limit(20)
    ).all()
    reviews = [
        ReviewOut(
            id=e.id,
            user_name=e.user.name,
            rating=e.rating,
            review=e.review or "",
            consumed_at=e.consumed_at,
            created_at=e.created_at,
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
        in_watchlist=any(is_wl for _, is_wl in lists),
        dismissed=dismissed is not None,
        list_ids=[lid for lid, is_wl in lists if not is_wl],
    )
    return MediaDetailOut(
        **MediaOut.model_validate(media).model_dump(),
        avg_rating=round(float(avg), 2) if avg is not None else None,
        ratings_count=int(count or 0),
        reviews=reviews,
        my_status=status,
    )
