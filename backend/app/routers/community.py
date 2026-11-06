"""Comunidade: o que as pessoas marcaram como Já vi. No MVP, todo mundo vê todo mundo."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, User
from ..schemas import CommunityEntryOut, CommunityPage, MediaOut, ReviewerOut
from ..seed import DEMO_EMAIL

router = APIRouter(prefix="/community", tags=["comunidade"])


VISIBLE = (
    User.role == "user",
    User.is_synthetic.is_(False),
    User.email != DEMO_EMAIL,
    DiaryEntry.from_onboarding.is_(False),
)


@router.get("", response_model=CommunityPage)
def community(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    visible = select(DiaryEntry).join(User, User.id == DiaryEntry.user_id).where(*VISIBLE)
    entries = db.scalars(
        visible.options(selectinload(DiaryEntry.media), selectinload(DiaryEntry.user))
        .order_by(DiaryEntry.created_at.desc(), DiaryEntry.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return CommunityPage(
        items=[
            CommunityEntryOut(
                id=e.id,
                user_name=e.user.name,
                media=MediaOut.model_validate(e.media),
                rating=e.rating,
                review=None if e.review_hidden else e.review,
                consumed_at=e.consumed_at,
                created_at=e.created_at,
            )
            for e in entries
        ],
        total=db.scalar(select(func.count()).select_from(visible.subquery())) or 0,
    )


@router.get("/reviewers", response_model=list[ReviewerOut])
def reviewers(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Quem mais escreveu resenhas. Resenhas ocultas pela moderação não contam."""
    review_count = func.count(case((and_(DiaryEntry.review.is_not(None), DiaryEntry.review_hidden.is_(False)), 1)))
    title_count = func.count(DiaryEntry.id)
    rows = db.execute(
        select(User.name, title_count, review_count)
        .join(DiaryEntry, DiaryEntry.user_id == User.id)
        .where(*VISIBLE)
        .group_by(User.id, User.name)
        .order_by(review_count.desc(), title_count.desc(), User.name)
        .limit(limit)
    )
    return [ReviewerOut(name=name, titles=titles, reviews=reviews) for name, titles, reviews in rows]
