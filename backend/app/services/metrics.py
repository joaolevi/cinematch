"""Métrica de sucesso do pitch: taxa de aceitação = (Quero ver + Já vi) ÷ sugestões exibidas.

A taxa geral usa todas as sugestões exibidas. A comparação entre os grupos A e B usa só as personalizadas:
as "Em alta" (estratégia trending) são iguais nos dois grupos e diluiriam a diferença entre eles.
Uma reação só conta como aceitação se vier até 7 dias depois de a sugestão aparecer (RNFF04): depois disso, a pessoa
provavelmente chegou ao título por outro caminho. A satisfação (RFF04) diz, das aceitas que ganharam nota, quantas
ficaram com 3,5 ou mais: a aceitação mede interesse; a satisfação, se a pessoa gostou.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import DiaryEntry, ItemNeighbor, Media, RecEvent, User

ACCEPTANCE_WINDOW = timedelta(days=7)
SATISFIED_FROM = 3.5
from ..seed import DEMO_EMAIL


def _pairs(db: Session, action: str, variant: str | None, personalized: bool = False) -> set[tuple[int, int]]:
    """Pares (usuário, título) com o evento, contando cada par uma única vez. Admins ficam de fora.

    Com `personalized`, só entram exibições geradas pelo recomendador, sem as "Em alta".
    """
    q = (
        select(RecEvent.user_id, RecEvent.media_id)
        .join(User, User.id == RecEvent.user_id)
        .where(RecEvent.action == action, User.role == "user")
        .distinct()
    )
    if variant:
        q = q.where(RecEvent.variant == variant)
    if personalized:
        q = q.where(RecEvent.strategy != "trending")
    return {(user_id, media_id) for user_id, media_id in db.execute(q)}


def _utc(moment: datetime) -> datetime:
    """O SQLite devolve as datas sem fuso; elas foram gravadas em UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _times(db: Session, action: str, variant: str | None) -> dict[tuple[int, int], list[datetime]]:
    q = (
        select(RecEvent.user_id, RecEvent.media_id, RecEvent.created_at)
        .join(User, User.id == RecEvent.user_id)
        .where(RecEvent.action == action, User.role == "user")
    )
    if variant:
        q = q.where(RecEvent.variant == variant)
    out: dict[tuple[int, int], list[datetime]] = defaultdict(list)
    for user_id, media_id, at in db.execute(q):
        out[(user_id, media_id)].append(_utc(at))
    return out


def _in_window(db: Session, action: str, variant: str | None, shown: set[tuple[int, int]]) -> set[tuple[int, int]]:
    """Os pares exibidos em que a reação veio depois de uma exibição, no máximo 7 dias depois (RNFF04)."""
    shown_at = _times(db, "shown", variant)
    hits = set()
    for pair, moments in _times(db, action, variant).items():
        if pair in shown and any(s <= m <= s + ACCEPTANCE_WINDOW for m in moments for s in shown_at.get(pair, [])):
            hits.add(pair)
    return hits


def _variant_metrics(db: Session, variant: str | None, personalized: bool = False) -> dict:
    shown = _pairs(db, "shown", variant, personalized)
    # só contam reações a títulos que foram exibidos no feed, até 7 dias depois da exibição
    want = _in_window(db, "want", variant, shown)
    seen = _in_window(db, "seen", variant, shown)
    dismiss = _pairs(db, "dismiss", variant) & shown
    accepted = want | seen
    ratings = {
        (user_id, media_id): rating
        for user_id, media_id, rating in db.execute(
            select(DiaryEntry.user_id, DiaryEntry.media_id, DiaryEntry.rating).where(DiaryEntry.rating.is_not(None))
        )
        if (user_id, media_id) in accepted
    }
    satisfied = sum(1 for rating in ratings.values() if rating >= SATISFIED_FROM)
    return {
        "variant": variant or "total",
        "users": len({user_id for user_id, _ in shown}),
        "shown": len(shown),
        "want": len(want),
        "seen": len(seen),
        "dismiss": len(dismiss),
        "acceptance_rate": round(len(accepted) / len(shown), 4) if shown else 0.0,
        "rated": len(ratings),
        "satisfied": satisfied,
        "satisfaction_rate": round(satisfied / len(ratings), 4) if ratings else None,
    }


def _count(db: Session, *conditions) -> int:
    return int(db.scalar(select(func.count()).select_from(Media).where(*conditions)) or 0)


def _simulated_shown(db: Session) -> int:
    """Sugestões exibidas a usuários sintéticos, para o painel avisar de onde vêm os números."""
    shown = (
        select(RecEvent.user_id, RecEvent.media_id)
        .join(User, User.id == RecEvent.user_id)
        .where(RecEvent.action == "shown", User.is_synthetic.is_(True))
        .distinct()
    )
    return int(db.scalar(select(func.count()).select_from(shown.subquery())) or 0)


def acceptance_metrics(db: Session) -> dict:
    return {
        "overall": _variant_metrics(db, None),
        "by_variant": [_variant_metrics(db, "A", personalized=True), _variant_metrics(db, "B", personalized=True)],
        # Exibições "Em alta" que ficaram fora da comparação A/B (estão na taxa geral)
        "trending_shown": len(_pairs(db, "shown", None) - _pairs(db, "shown", None, personalized=True)),
        "catalog_size": int(db.scalar(select(func.count()).select_from(Media)) or 0),
        "users": int(db.scalar(select(func.count()).select_from(User)) or 0),
        "diary_entries": int(
            db.scalar(
                select(func.count())
                .select_from(DiaryEntry)
                .join(User, User.id == DiaryEntry.user_id)
                .where(User.is_synthetic.is_(False))
            )
            or 0
        ),
        "real_users": int(
            db.scalar(
                select(func.count())
                .select_from(User)
                .where(User.is_synthetic.is_(False), User.role == "user", User.email != DEMO_EMAIL)
            )
            or 0
        ),
        "simulated_shown": _simulated_shown(db),
        "movies": _count(db, Media.type == "movie"),
        "series": _count(db, Media.type == "series"),
        "albums": _count(db, Media.type == "album"),
        "external_neighbors_enabled": settings.use_external_neighbors,
        "titles_with_neighbors": int(db.scalar(select(func.count(ItemNeighbor.media_id.distinct()))) or 0),
        "acceptance_window_days": ACCEPTANCE_WINDOW.days,
        "opted_out": int(
            db.scalar(select(func.count()).select_from(User).where(User.in_experiments.is_(False), User.role == "user")) or 0
        ),
    }
