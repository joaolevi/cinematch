"""Perfil de uma pessoa, a compatibilidade de gosto com quem está vendo (RFF15) e seguir pessoas (RFF09)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Follow, User
from ..schemas import CompatibilityOut, MediaOut, PersonOut, ProfileItemOut, ProfileOut, RecommendationOut
from ..services.compatibility import compatibility
from ..services.together import together

router = APIRouter(prefix="/users", tags=["pessoas"])

MAX_ITEMS = 12


def visible_person(db: Session, user_id: int, me: User) -> User:
    """A pessoa, se quem vê pode ver o perfil dela. Perfil privado de outra pessoa dá 404, como se não existisse."""
    user = db.get(User, user_id)
    if user is None or (user.visibility == "private" and user.id != me.id):
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return user


@router.get("/following", response_model=list[PersonOut])
def following(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Quem eu sigo, por nome. Perfis que ficaram privados saem da lista."""
    people = db.scalars(
        select(User)
        .join(Follow, Follow.followed_id == User.id)
        .where(Follow.follower_id == me.id, User.visibility != "private")
        .order_by(User.name)
    )
    return [PersonOut(id=p.id, name=p.name) for p in people]


@router.put("/{user_id}/follow", status_code=204)
def follow(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Seguir uma pessoa (RFF09). Não pede aceite e repetir não muda nada."""
    user = visible_person(db, user_id, me)
    if user.id == me.id:
        raise HTTPException(status_code=400, detail="Não dá para seguir o próprio perfil")
    exists = db.scalar(select(Follow.id).where(Follow.follower_id == me.id, Follow.followed_id == user.id))
    if exists is None:
        db.add(Follow(follower_id=me.id, followed_id=user.id))
        db.commit()
    return Response(status_code=204)


@router.delete("/{user_id}/follow", status_code=204)
def unfollow(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Deixar de seguir. Quem não seguia continua sem seguir."""
    db.execute(delete(Follow).where(Follow.follower_id == me.id, Follow.followed_id == user_id))
    db.commit()
    return Response(status_code=204)


@router.get("/{user_id}", response_model=ProfileOut)
def profile(user_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """O perfil de uma pessoa: quanto ela registrou, o que mais curtiu, o que registrou por último e, quando não é a
    própria pessoa, "Vocês combinam X%" com o que as duas têm em comum. Traz também se quem vê segue a pessoa e quantas
    pessoas ela segue e a seguem. Perfil privado (visibility = private) dá 404."""
    user = visible_person(db, user_id, me)
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
        following=db.scalar(select(Follow.id).where(Follow.follower_id == me.id, Follow.followed_id == user.id)) is not None,
        followers=db.scalar(select(func.count()).where(Follow.followed_id == user.id)) or 0,
        follows=db.scalar(select(func.count()).where(Follow.follower_id == user.id)) or 0,
    )


@router.get("/{user_id}/together", response_model=list[RecommendationOut])
def watch_together(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Assistir ou ouvir junto (RFF28): sugestões para quem vê e esta pessoa. Primeiro o que aparece para as duas,
    depois o que agrada a uma e a outra ainda não viu. O motivo mostra os dois lados ("Para você: ... · Para Levi: ...").
    Itens que alguma das duas já registrou, descartou ou guardou ficam de fora."""
    other = db.get(User, user_id)
    if other is None or other.id == me.id or (other.visibility == "private"):
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")
    return [
        RecommendationOut(media=MediaOut.model_validate(r.media), score=r.score, reason=r.reason, strategy=r.strategy)
        for r in together(db, me, other, limit)
    ]
