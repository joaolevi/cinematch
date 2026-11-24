"""O que o Tastory acha do gosto da pessoa (RFF07), calculado como o recomendador enxerga.

Cada título curtido pesa pelo sinal dele (nota, "Já vi" sem nota, listas) e espalha esse peso pelos seus gêneros,
década, pessoas e climas. As fatias mostram quanto cada um pesa no gosto. Os ajustes da pessoa aparecem junto.
"""

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DiaryEntry, Media
from . import adjustments as adj
from .moods import BY_KEY as MOODS
from .recommender import decade_label, user_signals

TOP = {"genre": 10, "decade": 6, "person": 10, "mood": 8}
TOP_TITLES = 12


def _label(kind: str, value: str) -> str:
    if kind == "decade":
        label = decade_label(int(value))
        return label[0].upper() + label[1:]
    if kind == "mood":
        return MOODS[value].label if value in MOODS else value
    return value


def taste_profile(db: Session, user_id: int) -> dict:
    signals = {mid: w for mid, w in user_signals(db, user_id).items() if w > 0}
    media = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_(signals)))} if signals else {}
    adjust = adj.load(db, user_id)

    weights: dict[str, Counter[str]] = {kind: Counter() for kind in TOP}
    for mid, w in signals.items():
        m = media[mid]
        for g in m.genres or []:
            weights["genre"][g] += w
        if m.year:
            weights["decade"][str((m.year // 10) * 10)] += w
        for p in (m.creators or [])[:2]:
            weights["person"][p] += w
        for mood in m.moods or []:
            weights["mood"][mood] += w

    facets = {}
    for kind, counter in weights.items():
        total = sum(counter.values()) or 1
        top = [value for value, _ in counter.most_common(TOP[kind])]
        # o que a pessoa ajustou aparece mesmo fora do topo, para ela poder desfazer
        top += [value for (k, value) in adjust if k == kind and value not in top]
        facets[kind] = [
            {
                "kind": kind,
                "value": value,
                "label": _label(kind, value),
                "share": round(counter[value] / total, 4),
                "weight": adjust.get((kind, value), 1.0),
            }
            for value in top
        ]

    entries = {
        e.media_id: e
        for e in db.scalars(select(DiaryEntry).where(DiaryEntry.user_id == user_id))
    }
    titles = sorted(signals.items(), key=lambda kv: -kv[1])[:TOP_TITLES]
    # o título com peso ajustado aparece mesmo fora do topo, para a pessoa poder desfazer
    shown = {mid for mid, _ in titles}
    titles += [
        (int(value), signals[int(value)])
        for (kind, value) in adjust
        if kind == "title" and value.isdigit() and int(value) in signals and int(value) not in shown
    ]
    return {
        **{f"{kind}s" if kind != "person" else "people": items for kind, items in facets.items()},
        "titles": [
            {
                "media": media[mid],
                "signal": round(w, 3),
                "entry_id": entries[mid].id if mid in entries else None,
                "rating": entries[mid].rating if mid in entries else None,
                "weight": adjust.get(("title", str(mid)), 1.0),
            }
            for mid, w in titles
        ],
        "excluded": [
            {"entry_id": e.id, "media": e.media}
            for e in db.scalars(
                select(DiaryEntry).where(DiaryEntry.user_id == user_id, DiaryEntry.excluded.is_(True))
            )
        ],
        "adjusted": len(adjust),
    }
