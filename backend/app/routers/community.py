"""Comunidade: o que as pessoas marcaram como Já vi, respeitando quem cada uma deixou ver (RFF10), com curtidas e
comentários nas resenhas e o rank de quem escreve pelas curtidas recebidas (RFF30)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, case, delete, func, select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Follow, ReviewComment, ReviewLike, User
from ..schemas import CommentIn, CommentOut, CommunityEntryOut, CommunityPage, MediaOut, ReviewerOut
from ..seed import DEMO_EMAIL
from ..services.visibility import visible_owner

router = APIRouter(prefix="/community", tags=["comunidade"])


VISIBLE = (
    User.role == "user",
    User.is_synthetic.is_(False),
    User.email != DEMO_EMAIL,
    DiaryEntry.from_onboarding.is_(False),
)
HAS_REVIEW = (DiaryEntry.review.is_not(None), DiaryEntry.review != "", DiaryEntry.review_hidden.is_(False))


def reachable_review(db: Session, entry_id: int, me: User) -> DiaryEntry:
    """A resenha, se quem vê pode vê-la na Comunidade: com texto, não oculta pela moderação e de quem deixa ver os
    registros (RFF10). Senão, 404."""
    entry = db.scalar(
        select(DiaryEntry)
        .join(User, User.id == DiaryEntry.user_id)
        .where(DiaryEntry.id == entry_id, *VISIBLE, *HAS_REVIEW, visible_owner(me.id))
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Resenha não encontrada")
    return entry


def counts_by_entry(db: Session, column, ids: list[int], *where) -> dict[int, int]:
    rows = db.execute(select(column, func.count()).where(column.in_(ids), *where).group_by(column))
    return dict(rows.all())


@router.get("", response_model=CommunityPage)
def community(
    limit: int = Query(default=20, ge=1, le=50),
    before_id: int | None = Query(default=None, ge=1, description="Traz os registros anteriores a este"),
    following: bool = Query(default=False, description="Só os registros de quem eu sigo (RFF09)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    visible = select(DiaryEntry).join(User, User.id == DiaryEntry.user_id).where(*VISIBLE, visible_owner(user.id))
    if following:
        visible = visible.where(DiaryEntry.user_id.in_(select(Follow.followed_id).where(Follow.follower_id == user.id)))
    page = visible.where(DiaryEntry.id < before_id) if before_id is not None else visible
    entries = list(
        db.scalars(
            page.options(selectinload(DiaryEntry.media), selectinload(DiaryEntry.user))
            .order_by(DiaryEntry.id.desc())
            .limit(limit)
        )
    )
    ids = [e.id for e in entries]
    likes = counts_by_entry(db, ReviewLike.entry_id, ids)
    comments = counts_by_entry(db, ReviewComment.entry_id, ids, ReviewComment.hidden.is_(False))
    liked = set(db.scalars(select(ReviewLike.entry_id).where(ReviewLike.entry_id.in_(ids), ReviewLike.user_id == user.id)))
    return CommunityPage(
        items=[
            CommunityEntryOut(
                id=e.id,
                user_id=e.user_id,
                user_name=e.user.name,
                media=MediaOut.model_validate(e.media),
                rating=e.rating,
                review=None if e.review_hidden else e.review,
                consumed_at=e.consumed_at,
                created_at=e.created_at,
                likes=likes.get(e.id, 0) if has_review(e) else 0,
                liked=e.id in liked and has_review(e),
                comments=comments.get(e.id, 0) if has_review(e) else 0,
            )
            for e in entries
        ]
    )


def has_review(e: DiaryEntry) -> bool:
    return bool(e.review) and not e.review_hidden


@router.get("/reviewers", response_model=list[ReviewerOut])
def reviewers(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Quem escreve as resenhas que mais agradam: o rank pelas curtidas recebidas (RFF30), depois por quantas resenhas
    escreveu, entre quem deixa ver os registros (RFF10) e já escreveu alguma resenha. Resenhas ocultas pela moderação
    não contam."""
    received = (
        select(DiaryEntry.user_id.label("owner"), func.count(ReviewLike.id).label("likes"))
        .join(ReviewLike, ReviewLike.entry_id == DiaryEntry.id)
        .where(*HAS_REVIEW)
        .group_by(DiaryEntry.user_id)
        .subquery()
    )
    likes = func.coalesce(received.c.likes, 0)
    review_count = func.count(case((and_(*HAS_REVIEW), 1)))
    title_count = func.count(DiaryEntry.id)
    rows = db.execute(
        select(User.id, User.name, title_count, review_count, likes)
        .join(DiaryEntry, DiaryEntry.user_id == User.id)
        .outerjoin(received, received.c.owner == User.id)
        .where(*VISIBLE, visible_owner(user.id))
        .group_by(User.id, User.name, received.c.likes)
        .having(review_count > 0)
        .order_by(likes.desc(), review_count.desc(), title_count.desc(), User.name)
        .limit(limit)
    )
    return [
        ReviewerOut(id=id_, name=name, titles=titles, reviews=reviews, likes=n)
        for id_, name, titles, reviews, n in rows
    ]


# ---------------------------------------------------------------- curtidas e comentários (RFF30)
@router.put("/{entry_id}/like", status_code=204)
def like(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Curtir uma resenha. Repetir não muda nada, e não dá para curtir a própria."""
    entry = reachable_review(db, entry_id, user)
    if entry.user_id == user.id:
        raise HTTPException(status_code=400, detail="Não dá para curtir a própria resenha")
    if db.scalar(select(ReviewLike.id).where(ReviewLike.entry_id == entry.id, ReviewLike.user_id == user.id)) is None:
        db.add(ReviewLike(entry_id=entry.id, user_id=user.id))
        db.commit()
    return Response(status_code=204)


@router.delete("/{entry_id}/like", status_code=204)
def unlike(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Tirar a curtida. Quem não tinha curtido continua sem curtir."""
    db.execute(delete(ReviewLike).where(ReviewLike.entry_id == entry_id, ReviewLike.user_id == user.id))
    db.commit()
    return Response(status_code=204)


def comment_out(c: ReviewComment, entry: DiaryEntry, me: User) -> CommentOut:
    return CommentOut(
        id=c.id, user_id=c.user_id, user_name=c.user.name, text=c.text, created_at=c.created_at,
        can_delete=me.id in (c.user_id, entry.user_id),
    )


@router.get("/{entry_id}/comments", response_model=list[CommentOut])
def comments(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Os comentários de uma resenha, do mais antigo ao mais novo. Os ocultos pela moderação não aparecem."""
    entry = reachable_review(db, entry_id, user)
    found = db.scalars(
        select(ReviewComment)
        .where(ReviewComment.entry_id == entry.id, ReviewComment.hidden.is_(False))
        .options(selectinload(ReviewComment.user))
        .order_by(ReviewComment.created_at, ReviewComment.id)
    )
    return [comment_out(c, entry, user) for c in found]


@router.post("/{entry_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(entry_id: int, data: CommentIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Comentar uma resenha, com até 500 caracteres. O comentário aparece com o nome de quem escreveu para todo mundo
    que vê a resenha, e a moderação pode ocultá-lo."""
    entry = reachable_review(db, entry_id, user)
    text = data.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Escreva o comentário")
    c = ReviewComment(entry_id=entry.id, user_id=user.id, text=text)
    db.add(c)
    db.commit()
    db.refresh(c)
    return comment_out(c, entry, user)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Apagar um comentário: quem escreveu o comentário ou quem escreveu a resenha."""
    c = db.get(ReviewComment, comment_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    entry = reachable_review(db, c.entry_id, user)
    if user.id not in (c.user_id, entry.user_id):
        raise HTTPException(status_code=403, detail="Só quem escreveu o comentário ou a resenha pode apagar")
    db.delete(c)
    db.commit()
    return Response(status_code=204)
