"""O Top 10 do Tastory: os títulos mais registrados pela comunidade nos últimos dias, como o Top 10 da Netflix, mas a
partir do que as pessoas registram aqui, e não da popularidade do TMDB."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import DiaryEntry, Media, User

MIN_TITLES = 5  # com menos que isso na semana, a janela aumenta para o mês


def top_titles(db: Session, days: int = 7, limit: int = 10, media_type: str | None = None) -> tuple[int, list[dict]]:
    """Os títulos com mais registros nos últimos `days` dias, com a nota média. Contas simuladas ficam de fora. Se a
    semana tiver poucos registros, usa os últimos 30 dias. Devolve (dias usados, lista)."""
    for window in (days, 30) if days < 30 else (days,):
        since = datetime.now(timezone.utc) - timedelta(days=window)
        q = (
            select(DiaryEntry.media_id, func.count().label("n"), func.avg(DiaryEntry.rating))
            .join(User, User.id == DiaryEntry.user_id)
            .where(User.is_synthetic.is_(False), DiaryEntry.from_onboarding.is_(False), DiaryEntry.created_at >= since)
            .group_by(DiaryEntry.media_id)
            .order_by(func.count().desc(), func.avg(DiaryEntry.rating).desc())
        )
        if media_type:
            q = q.join(Media, Media.id == DiaryEntry.media_id).where(Media.type == media_type)
        rows = db.execute(q.limit(limit)).all()
        if len(rows) >= MIN_TITLES or window == 30:
            break
    media = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_([r[0] for r in rows])))} if rows else {}
    return window, [
        {"media": media[mid], "count": n, "average": round(avg, 2) if avg is not None else None}
        for mid, n, avg in rows
        if mid in media
    ]
