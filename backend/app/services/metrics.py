"""Métrica de sucesso do pitch: taxa de aceitação = (Quero ver + Já vi) ÷ sugestões exibidas."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import DiaryEntry, Media, RecEvent, User


def _pairs(db: Session, action: str, variant: str | None) -> set[tuple[int, int]]:
    """Pares (usuário, título) com o evento, contando cada par uma única vez."""
    q = select(RecEvent.user_id, RecEvent.media_id).where(RecEvent.action == action).distinct()
    if variant:
        q = q.where(RecEvent.variant == variant)
    return {(user_id, media_id) for user_id, media_id in db.execute(q)}


def _variant_metrics(db: Session, variant: str | None) -> dict:
    shown = _pairs(db, "shown", variant)
    # só contam reações a títulos que foram exibidos no feed
    want = _pairs(db, "want", variant) & shown
    seen = _pairs(db, "seen", variant) & shown
    dismiss = _pairs(db, "dismiss", variant) & shown
    accepted = want | seen

    users_q = select(func.count()).select_from(User)
    if variant:
        users_q = users_q.where(User.ab_group == variant)
    return {
        "variant": variant or "total",
        "users": int(db.scalar(users_q) or 0),
        "shown": len(shown),
        "want": len(want),
        "seen": len(seen),
        "dismiss": len(dismiss),
        "acceptance_rate": round(len(accepted) / len(shown), 4) if shown else 0.0,
    }


def acceptance_metrics(db: Session) -> dict:
    return {
        "overall": _variant_metrics(db, None),
        "by_variant": [_variant_metrics(db, "A"), _variant_metrics(db, "B")],
        "catalog_size": int(db.scalar(select(func.count()).select_from(Media)) or 0),
        "users": int(db.scalar(select(func.count()).select_from(User)) or 0),
        "diary_entries": int(db.scalar(select(func.count()).select_from(DiaryEntry)) or 0),
    }
