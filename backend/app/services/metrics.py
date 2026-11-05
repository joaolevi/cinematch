"""Métrica de sucesso do pitch: taxa de aceitação = (Quero ver + Já vi) ÷ sugestões exibidas."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import DiaryEntry, Media, RecEvent, User


def _variant_metrics(db: Session, variant: str | None) -> dict:
    def count(action: str) -> int:
        q = select(func.count()).select_from(RecEvent).where(RecEvent.action == action)
        if variant:
            q = q.where(RecEvent.variant == variant)
        return int(db.scalar(q) or 0)

    # cada título conta uma única vez por usuário como "exibido"
    sub = select(RecEvent.user_id, RecEvent.media_id).where(RecEvent.action == "shown")
    if variant:
        sub = sub.where(RecEvent.variant == variant)
    shown = int(db.scalar(select(func.count()).select_from(sub.distinct().subquery())) or 0)

    users_q = select(func.count()).select_from(User)
    if variant:
        users_q = users_q.where(User.ab_group == variant)
    want, seen, dismiss = count("want"), count("seen"), count("dismiss")
    return {
        "variant": variant or "total",
        "users": int(db.scalar(users_q) or 0),
        "shown": shown,
        "want": want,
        "seen": seen,
        "dismiss": dismiss,
        "acceptance_rate": round((want + seen) / shown, 4) if shown else 0.0,
    }


def acceptance_metrics(db: Session) -> dict:
    return {
        "overall": _variant_metrics(db, None),
        "by_variant": [_variant_metrics(db, "A"), _variant_metrics(db, "B")],
        "catalog_size": int(db.scalar(select(func.count()).select_from(Media)) or 0),
        "users": int(db.scalar(select(func.count()).select_from(User)) or 0),
        "diary_entries": int(db.scalar(select(func.count()).select_from(DiaryEntry)) or 0),
    }
