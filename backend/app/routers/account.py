"""A própria conta: exportar os dados, excluir a conta (RFF06), sair dos experimentos (RFF17), escolher quem vê os
registros (RFF10), marcar os serviços que assina (RFF21) e ver o próprio histórico de atividades (RFF31)."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
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
    ListItem,
    UserInterest,
    UserList,
    UserPreference,
)
from ..schemas import (
    ActivityOut, DeleteAccountIn, ExperimentsIn, MediaOut, PersonOut, ServicesIn, UserOut, VisibilityIn,
)
from ..services.streaming import BY_KEY as SERVICES

router = APIRouter(prefix="/me", tags=["conta"])


def _title(media: Media) -> dict:
    return {"id": media.id, "title": media.title, "type": media.type, "year": media.year}


def _utc(moment: datetime) -> datetime:
    """O SQLite devolve as datas sem fuso; elas foram gravadas em UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


ActivityKind = Literal["registros", "notas", "resenhas", "listas", "curtidas", "comentarios", "seguindo"]


@router.get("/activity", response_model=list[ActivityOut])
def my_activity(
    kind: ActivityKind | None = Query(default=None, description="Só um tipo de atividade"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """O próprio histórico de atividades (RFF31), do mais recente ao mais antigo: registros no diário (com nota e
    resenha), títulos guardados em listas, curtidas e comentários em resenhas e pessoas que passou a seguir. `kind`
    filtra: `notas` e `resenhas` são os registros com nota ou com resenha. O começo (onboarding) não entra."""
    items: list[ActivityOut] = []
    media_out = MediaOut.model_validate
    if kind in (None, "registros", "notas", "resenhas"):
        q = select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.from_onboarding.is_(False))
        if kind == "notas":
            q = q.where(DiaryEntry.rating.is_not(None))
        if kind == "resenhas":
            q = q.where(DiaryEntry.review.is_not(None), DiaryEntry.review != "")
        for e in db.scalars(q.options(selectinload(DiaryEntry.media))):
            items.append(ActivityOut(kind="registro", at=_utc(e.created_at), media=media_out(e.media), rating=e.rating,
                                     text=e.review or None))
    if kind in (None, "listas"):
        rows = db.execute(
            select(ListItem, UserList.name, UserList.is_watchlist)
            .join(UserList, UserList.id == ListItem.list_id)
            .where(UserList.user_id == user.id, UserList.featured.is_(False))
            .options(selectinload(ListItem.media))
        )
        for item, name, watchlist in rows:
            items.append(ActivityOut(kind="lista", at=_utc(item.added_at), media=media_out(item.media),
                                     list_name="Quero ver" if watchlist else name))
    if kind in (None, "curtidas"):
        rows = db.execute(
            select(ReviewLike.created_at, DiaryEntry)
            .join(DiaryEntry, DiaryEntry.id == ReviewLike.entry_id)
            .where(ReviewLike.user_id == user.id)
            .options(selectinload(DiaryEntry.media), selectinload(DiaryEntry.user))
        )
        for at, entry in rows:
            items.append(ActivityOut(kind="curtida", at=_utc(at), media=media_out(entry.media),
                                     person=PersonOut(id=entry.user.id, name=entry.user.name)))
    if kind in (None, "comentarios"):
        rows = db.scalars(
            select(ReviewComment)
            .where(ReviewComment.user_id == user.id)
            .options(selectinload(ReviewComment.entry).selectinload(DiaryEntry.media),
                     selectinload(ReviewComment.entry).selectinload(DiaryEntry.user))
        )
        for c in rows:
            items.append(ActivityOut(kind="comentario", at=_utc(c.created_at), media=media_out(c.entry.media),
                                     text=c.text, person=PersonOut(id=c.entry.user.id, name=c.entry.user.name)))
    if kind in (None, "seguindo"):
        rows = db.execute(
            select(Follow.created_at, User.id, User.name)
            .join(User, User.id == Follow.followed_id)
            .where(Follow.follower_id == user.id)
        )
        for at, person_id, name in rows:
            items.append(ActivityOut(kind="seguiu", at=_utc(at), person=PersonOut(id=person_id, name=name)))
    items.sort(key=lambda a: a.at, reverse=True)
    return items[offset : offset + limit]


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
