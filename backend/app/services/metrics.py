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
from ..models import DiaryEntry, ItemNeighbor, Media, MediaBridge, RecEvent, User

ACCEPTANCE_WINDOW = timedelta(days=7)
SATISFIED_FROM = 3.5
from ..seed import DEMO_EMAIL, VITRINE_DOMAIN


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


BRIDGE_LABELS = {
    "soundtrack": "Trilha sonora",
    "composer": "Compositor da trilha",
    "same_person": "Quem atua e canta",
    "biopic": "Cinebiografia",
    "documentary": "Documentário",
    "artist": "Mesmo artista",
    "weak": "Ponte fraca: gênero, década, país ou idioma",
}


def _bridge_kind(db: Session, album: Media, liked: set[int], liked_artists: set[str]) -> str:
    """A ponte mais forte entre o disco e o que a pessoa curte hoje: uma ponte forte guardada, o mesmo artista de um
    disco curtido ou, sem nenhuma das duas, uma ponte fraca."""
    best = db.execute(
        select(MediaBridge.kind, MediaBridge.weight)
        .where(MediaBridge.media_id == album.id, MediaBridge.other_id.in_(liked))
        .order_by(MediaBridge.weight.desc())
        .limit(1)
    ).first()
    if best:
        return best[0]
    return "artist" if set(album.creators or []) & liked_artists else "weak"


def acceptance_by_bridge(db: Session) -> list[dict]:
    """EXP03: a aceitação dos discos sugeridos por ponte, separada pelo tipo de ponte. O tipo é a ponte mais forte entre
    o disco e o que a pessoa curte hoje, uma aproximação: a exibição não guarda o motivo. Mesma janela de 7 dias."""
    from .recommender import user_signals

    q = (
        select(RecEvent.user_id, RecEvent.media_id)
        .join(User, User.id == RecEvent.user_id)
        .where(RecEvent.action == "shown", RecEvent.strategy == "bridge", User.role == "user")
        .distinct()
    )
    shown = {(u, m) for u, m in db.execute(q)}
    if not shown:
        return []
    accepted = _in_window(db, "want", None, shown) | _in_window(db, "seen", None, shown)
    albums = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_({m for _, m in shown})))}
    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for user_id in {u for u, _ in shown}:
        liked = {mid for mid, w in user_signals(db, user_id).items() if w > 0}
        artists = {a for m in db.scalars(select(Media).where(Media.id.in_(liked), Media.type == "album")) for a in m.creators or []}
        for pair in (p for p in shown if p[0] == user_id):
            kind = _bridge_kind(db, albums[pair[1]], liked, artists)
            totals[kind][0] += 1
            totals[kind][1] += pair in accepted
    return [
        {"kind": kind, "label": BRIDGE_LABELS.get(kind, kind), "shown": n, "accepted": ok, "acceptance_rate": round(ok / n, 4)}
        for kind, (n, ok) in sorted(totals.items(), key=lambda x: -x[1][0])
    ]


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
                .where(User.is_synthetic.is_(False), User.email.not_like(f"%@{VITRINE_DOMAIN}"))
            )
            or 0
        ),
        "real_users": int(
            db.scalar(
                select(func.count())
                .select_from(User)
                .where(
                    User.is_synthetic.is_(False), User.role == "user", User.email != DEMO_EMAIL,
                    User.email.not_like(f"%@{VITRINE_DOMAIN}"),
                )
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
        "by_bridge": acceptance_by_bridge(db),
        "opted_out": int(
            db.scalar(select(func.count()).select_from(User).where(User.in_experiments.is_(False), User.role == "user")) or 0
        ),
    }
