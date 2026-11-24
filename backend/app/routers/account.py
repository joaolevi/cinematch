"""A própria conta: exportar os dados, excluir a conta (RFF06), sair dos experimentos (RFF17), escolher quem vê os
registros (RFF10) e marcar os serviços que assina (RFF21)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user, verify_password
from ..db import get_db
from ..models import (
    DiaryEntry,
    Dismissed,
    Follow,
    Media,
    RecEvent,
    ReviewComment,
    ReviewLike,
    TasteAdjustment,
    User,
    UserInterest,
    UserList,
    UserPreference,
)
from ..schemas import DeleteAccountIn, ExperimentsIn, ServicesIn, UserOut, VisibilityIn
from ..services.streaming import BY_KEY as SERVICES

router = APIRouter(prefix="/me", tags=["conta"])


def _title(media: Media) -> dict:
    return {"id": media.id, "title": media.title, "type": media.type, "year": media.year}


@router.get("/export")
def export_my_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Tudo o que o Tastory guarda sobre a pessoa, em JSON, para baixar (RFF06). A senha não sai, nem cifrada."""
    titles = {m.id: m for m in db.scalars(select(Media))}
    entries = db.scalars(
        select(DiaryEntry).where(DiaryEntry.user_id == user.id).order_by(DiaryEntry.created_at)
    )
    lists = db.scalars(
        select(UserList).where(UserList.user_id == user.id).options(selectinload(UserList.items)).order_by(UserList.id)
    )
    names = {u.id: u.name for u in db.scalars(select(User))}
    interests = db.execute(select(UserInterest.kind, UserInterest.value).where(UserInterest.user_id == user.id)).all()
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at,
            "visibility": user.visibility,
            "ab_group": user.ab_group,
            "in_experiments": user.in_experiments,
            "services": user.services,
        },
        "preferences": {
            "genres": list(db.scalars(select(UserPreference.genre).where(UserPreference.user_id == user.id))),
            "interests": [{"kind": kind, "value": value} for kind, value in interests],
        },
        "diary": [
            {
                "media": _title(e.media),
                "rating": e.rating,
                "review": e.review,
                "consumed_at": e.consumed_at,
                "created_at": e.created_at,
                "from_onboarding": e.from_onboarding,
            }
            for e in entries
        ],
        "lists": [
            {
                "name": lst.name,
                "is_watchlist": lst.is_watchlist,
                "items": [{"media": _title(titles[i.media_id]), "added_at": i.added_at} for i in lst.items],
            }
            for lst in lists
        ],
        "dismissed": [
            _title(titles[mid]) for mid in db.scalars(select(Dismissed.media_id).where(Dismissed.user_id == user.id))
        ],
        "following": [
            names.get(fid) for fid in db.scalars(select(Follow.followed_id).where(Follow.follower_id == user.id))
        ],
        "review_likes": len(list(db.scalars(select(ReviewLike.id).where(ReviewLike.user_id == user.id)))),
        "review_comments": [
            {"text": text, "created_at": at}
            for text, at in db.execute(
                select(ReviewComment.text, ReviewComment.created_at).where(ReviewComment.user_id == user.id)
            )
        ],
        "taste_adjustments": [
            {"kind": kind, "value": value}
            for kind, value in db.execute(
                select(TasteAdjustment.kind, TasteAdjustment.value).where(TasteAdjustment.user_id == user.id)
            )
        ],
        # O que a pessoa viu e fez nas sugestões: a base da taxa de aceitação
        "recommendation_events": [
            {"media": _title(titles[mid]), "action": action, "created_at": at}
            for mid, action, at in db.execute(
                select(RecEvent.media_id, RecEvent.action, RecEvent.created_at)
                .where(RecEvent.user_id == user.id)
                .order_by(RecEvent.created_at)
            )
        ],
    }


@router.delete("", status_code=204)
def delete_my_account(data: DeleteAccountIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Exclui a conta e tudo o que é dela: diário, listas, preferências, eventos e quem a pessoa segue (RFF06).
    Pede a senha atual. Contas de administração não saem por aqui."""
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Senha incorreta")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Contas de administração não podem ser excluídas por aqui")
    db.delete(user)
    db.commit()
    return Response(status_code=204)


@router.put("/experiments", response_model=UserOut)
def set_experiments(data: ExperimentsIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Sair ou voltar para os experimentos (RFF17). Fora deles, a pessoa recebe o recomendador completo e as reações
    dela ficam fora da comparação entre os grupos A e B."""
    user.in_experiments = data.in_experiments
    db.commit()
    db.refresh(user)
    return user


@router.put("/visibility", response_model=UserOut)
def set_visibility(data: VisibilityIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Quem vê os registros (RFF10): "all" (todos), "followers" (quem me segue) ou "private" (só eu). Vale na
    Comunidade, nas resenhas de cada título, no perfil e no "Para ver ou ouvir junto". Seguir não pede aceite, então
    "followers" não é um cadeado: para esconder de todo mundo, use "private"."""
    user.visibility = data.visibility
    db.commit()
    db.refresh(user)
    return user


@router.put("/services", response_model=UserOut)
def set_services(data: ServicesIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Os serviços de streaming que a pessoa assina (RFF21), pelas chaves de `GET /media/services`. Lista vazia
    desmarca todos. Chave desconhecida dá 422."""
    unknown = [key for key in data.services if key not in SERVICES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Serviço desconhecido: {', '.join(unknown)}")
    user.services = [key for key in SERVICES if key in set(data.services)]  # sem repetir, na ordem da lista
    db.commit()
    db.refresh(user)
    return user
