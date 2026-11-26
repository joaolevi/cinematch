"""Indicar títulos para quem você segue e as notificações."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import DiaryEntry, Follow, Invite, ListItem, Notification, Suggestion, User, UserList
from ..schemas import (
    InviteAnswerIn, InviteIn, InviteOut, InvitesOut, MediaOut, NotificationOut, NotificationsOut, PersonOut, SuggestIn,
    SuggestionOut, SuggestOut,
)
from ..services.notifications import notify

router = APIRouter(tags=["indicações e notificações"])


@router.post("/media/{media_id}/suggest", response_model=SuggestOut)
def suggest(media_id: int, data: SuggestIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Indicar um filme, uma série ou um disco para pessoas que você segue, com um recado opcional. Cada pessoa recebe
    uma notificação. Indicar de novo o mesmo título para a mesma pessoa só troca o recado. Quem já registrou o título
    no diário não recebe."""
    media = crud.get_media_or_404(db, media_id)
    followed = set(db.scalars(select(Follow.followed_id).where(Follow.follower_id == user.id)))
    targets = [uid for uid in dict.fromkeys(data.to) if uid != user.id]
    if not targets or any(uid not in followed for uid in targets):
        raise HTTPException(status_code=400, detail="Só dá para indicar para quem você segue")
    already = set(db.scalars(select(DiaryEntry.user_id).where(DiaryEntry.media_id == media.id, DiaryEntry.user_id.in_(targets))))
    note = (data.note or "").strip() or None
    sent = 0
    for uid in targets:
        if uid in already:
            continue
        row = db.scalar(select(Suggestion).where(Suggestion.from_id == user.id, Suggestion.to_id == uid, Suggestion.media_id == media.id))
        if row is None:
            db.add(Suggestion(from_id=user.id, to_id=uid, media_id=media.id, note=note))
        else:
            row.note = note
        notify(db, uid, "indicou", user.id, media_id=media.id, text=note)
        sent += 1
    db.commit()
    return SuggestOut(sent=sent)


@router.get("/me/suggestions", response_model=list[SuggestionOut])
def received(limit: int = Query(default=20, ge=1, le=50), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """As indicações que a pessoa recebeu, da mais nova para a mais antiga, sem o que ela já registrou no diário."""
    seen = select(DiaryEntry.media_id).where(DiaryEntry.user_id == user.id)
    rows = db.scalars(
        select(Suggestion).where(Suggestion.to_id == user.id, Suggestion.media_id.not_in(seen))
        .options(selectinload(Suggestion.sender), selectinload(Suggestion.media))
        .order_by(Suggestion.created_at.desc()).limit(limit)
    ).all()
    wanted = set(db.scalars(
        select(ListItem.media_id).join(UserList, UserList.id == ListItem.list_id)
        .where(UserList.user_id == user.id, UserList.is_watchlist.is_(True))
    ))
    return [
        SuggestionOut(id=s.id, media=MediaOut.model_validate(s.media), sender=PersonOut(id=s.sender.id, name=s.sender.name),
                      note=s.note, created_at=s.created_at, in_watchlist=s.media_id in wanted)
        for s in rows
    ]


@router.get("/me/notifications", response_model=NotificationsOut)
def notifications(limit: int = Query(default=30, ge=1, le=100), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Os avisos da pessoa, do mais novo para o mais antigo, e quantos ainda não foram lidos."""
    rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id)
        .options(selectinload(Notification.actor), selectinload(Notification.media))
        .order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
    ).all()
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))) or 0
    return NotificationsOut(unread=unread, items=[
        NotificationOut(
            id=n.id, kind=n.kind, entry_id=n.entry_id, text=n.text, read=n.read, created_at=n.created_at,
            actor=PersonOut(id=n.actor.id, name=n.actor.name) if n.actor else None,
            media=MediaOut.model_validate(n.media) if n.media else None,
        )
        for n in rows
    ])


@router.post("/me/notifications/read", status_code=204)
def mark_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Marca todos os avisos como lidos."""
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read.is_(False)).values(read=True))
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- criar lembrança juntos
KEEP_DAYS = 14  # depois de 14 dias da data, a lembrança sai da lista


def invite_out(db: Session, inv: Invite, me: User) -> InviteOut:
    registered = db.scalar(select(DiaryEntry.id).where(DiaryEntry.user_id == me.id, DiaryEntry.media_id == inv.media_id)) is not None
    return InviteOut(
        id=inv.id, media=MediaOut.model_validate(inv.media), day=inv.day, note=inv.note, status=inv.status,
        created_at=inv.created_at, mine=inv.from_id == me.id, registered=registered,
        sender=PersonOut(id=inv.sender.id, name=inv.sender.name),
        receiver=PersonOut(id=inv.receiver.id, name=inv.receiver.name),
    )


@router.post("/media/{media_id}/invite", response_model=InviteOut, status_code=201)
def invite(media_id: int, data: InviteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Criar lembrança juntos: chamar alguém que você segue para ver ou ouvir o título, com um dia combinado e um recado,
    se quiser. A pessoa recebe um aviso. Chamar de novo a mesma pessoa para o mesmo título troca o dia e o recado e
    volta a esperar a resposta."""
    media = crud.get_media_or_404(db, media_id)
    follows = db.scalar(select(Follow.id).where(Follow.follower_id == user.id, Follow.followed_id == data.to))
    if data.to == user.id or follows is None:
        raise HTTPException(status_code=400, detail="Só dá para chamar quem você segue")
    if data.day and data.day < date.today() - timedelta(days=1):
        raise HTTPException(status_code=422, detail="Escolha um dia de hoje em diante")
    inv = db.scalar(select(Invite).where(Invite.from_id == user.id, Invite.to_id == data.to, Invite.media_id == media.id,
                                         Invite.status != "declined"))
    if inv is None:
        inv = Invite(from_id=user.id, to_id=data.to, media_id=media.id)
        db.add(inv)
    inv.day, inv.note, inv.status = data.day, (data.note or "").strip() or None, "pending"
    notify(db, data.to, "convidou", user.id, media_id=media.id, text=inv.note)
    db.commit()
    db.refresh(inv)
    return invite_out(db, inv, user)


@router.get("/me/invites", response_model=InvitesOut)
def my_invites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """As lembranças da pessoa: os convites recebidos esperando resposta, os combinados (dos dois lados) e os enviados
    que ainda esperam. Os recusados e os que passaram há mais de duas semanas saem."""
    limit = date.today() - timedelta(days=KEEP_DAYS)
    rows = db.scalars(
        select(Invite).where(
            ((Invite.to_id == user.id) & (Invite.status != "declined"))
            | ((Invite.from_id == user.id) & (Invite.status != "declined")),
        )
        .options(selectinload(Invite.sender), selectinload(Invite.receiver), selectinload(Invite.media))
        .order_by(Invite.created_at.desc())
        .limit(40)
    ).all()
    keep = [i for i in rows if i.day is None or i.day >= limit]
    return InvitesOut(items=[invite_out(db, i, user) for i in keep])


@router.put("/invites/{invite_id}", response_model=InviteOut)
def answer_invite(invite_id: int, data: InviteAnswerIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Responder um convite: topar (o título vai para o Quero ver, e quem chamou recebe um aviso) ou agora não."""
    inv = db.get(Invite, invite_id)
    if inv is None or inv.to_id != user.id:
        raise HTTPException(status_code=404, detail="Convite não encontrado")
    inv.status = data.answer
    if data.answer == "accepted":
        crud.add_to_list(db, crud.get_or_create_watchlist(db, user), inv.media_id)
        notify(db, inv.from_id, "aceitou", user.id, media_id=inv.media_id)
    db.commit()
    db.refresh(inv)
    return invite_out(db, inv, user)
