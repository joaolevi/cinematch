"""Quem vê os registros de cada pessoa (RFF10): todos ("all"), quem segue a pessoa ("followers") ou só ela ("private").

Vale na Comunidade, nas resenhas do detalhe de cada título, no perfil e no "Para ver ou ouvir junto". A própria
pessoa sempre vê o que é dela, e a moderação vê tudo. Seguir não pede aceite (RFF09): "quem me segue" tira os
registros da Comunidade geral e do perfil de quem não segue, mas não é um cadeado; para esconder de todo mundo, a
opção é "só eu".
"""

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..models import Follow, User


def visible_owner(viewer_id: int):
    """Condição SQL sobre `User`: os donos cujos registros quem vê pode ver."""
    follows = select(Follow.followed_id).where(Follow.follower_id == viewer_id)
    return or_(
        User.id == viewer_id,
        User.visibility == "all",
        and_(User.visibility == "followers", User.id.in_(follows)),
    )


def can_see_entries(db: Session, viewer: User, owner: User) -> bool:
    """Se quem vê pode ver os registros desta pessoa."""
    if viewer.id == owner.id or owner.visibility == "all":
        return True
    if owner.visibility == "followers":
        follows = select(Follow.id).where(Follow.follower_id == viewer.id, Follow.followed_id == owner.id)
        return db.scalar(follows) is not None
    return False
