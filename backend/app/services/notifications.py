"""Notificações: avisos do que acontece com a pessoa e com quem ela segue, guardados no banco e lidos ao abrir a página.

- seguiu: alguém passou a seguir a pessoa
- curtiu e comentou: na resenha dela
- indicou: alguém indicou um filme, uma série ou um disco para ela
- registrou: alguém que ela segue registrou um título que está no Quero ver dela

Ninguém recebe aviso do que fez, e o mesmo aviso não se repete enquanto não for lido.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DiaryEntry, Follow, ListItem, Notification, User, UserList


def notify(db: Session, user_id: int, kind: str, actor_id: int | None, media_id: int | None = None,
           entry_id: int | None = None, text: str | None = None) -> None:
    """Guarda um aviso. Não faz commit: entra junto com a ação que o gerou."""
    if actor_id is not None and actor_id == user_id:
        return
    same = db.scalar(select(Notification.id).where(
        Notification.user_id == user_id, Notification.kind == kind, Notification.actor_id == actor_id,
        Notification.media_id == media_id, Notification.entry_id == entry_id, Notification.read.is_(False),
    ))
    if same is None:
        db.add(Notification(user_id=user_id, kind=kind, actor_id=actor_id, media_id=media_id, entry_id=entry_id,
                            text=(text or "").strip()[:200] or None))


def notify_watchlist_owners(db: Session, actor: User, entry: DiaryEntry) -> None:
    """Quem segue a pessoa e tem o título no Quero ver fica sabendo que ela registrou. Só se o registro dela é visível
    para quem segue (perfil privado não avisa ninguém)."""
    if entry.from_onboarding or actor.visibility == "private":
        return
    followers = select(Follow.follower_id).where(Follow.followed_id == actor.id)
    owners = db.scalars(
        select(UserList.user_id).join(ListItem, ListItem.list_id == UserList.id)
        .where(UserList.is_watchlist.is_(True), ListItem.media_id == entry.media_id, UserList.user_id.in_(followers))
    )
    for owner in set(owners):
        notify(db, owner, "registrou", actor.id, media_id=entry.media_id, entry_id=entry.id)
