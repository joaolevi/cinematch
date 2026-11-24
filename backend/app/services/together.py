"""Assistir ou ouvir junto (RFF28): sugestões para duas pessoas ao mesmo tempo.

Gera as sugestões de cada uma (filmes, séries e, pelas pontes, álbuns) e dá prioridade ao que aparece para as duas.
Depois completa com o que agrada a uma e a outra ainda não viu. O motivo mostra os dois lados.
"""

from sqlalchemy.orm import Session

from ..models import User
from .bridges import album_suggestions
from .recommender import Recommendation, excluded_ids, recommend

POOL = 60  # quantas sugestões de cada pessoa entram na conta
ONLY_ONE_WEIGHT = 0.4  # o que agrada só a uma pessoa vale menos que o que agrada às duas


def _ranked(db: Session, user: User) -> dict[int, tuple[int, Recommendation]]:
    _, videos = recommend(db, user, None, POOL)
    albums = [r for r in album_suggestions(db, user.id, (), POOL // 3) if r.strategy == "bridge"]
    out: dict[int, tuple[int, Recommendation]] = {}
    for rank, rec in enumerate(videos + albums):
        out.setdefault(rec.media.id, (rank, rec))
    return out


def together(db: Session, me: User, other: User, limit: int = 20) -> list[Recommendation]:
    mine, theirs = _ranked(db, me), _ranked(db, other)
    seen_by = {me.id: excluded_ids(db, me.id), other.id: excluded_ids(db, other.id)}
    first = other.name.split()[0]
    scored = []
    for mid in set(mine) | set(theirs):
        if mid in seen_by[me.id] or mid in seen_by[other.id]:
            continue
        a, b = mine.get(mid), theirs.get(mid)
        score = (1 / (1 + a[0]) if a else 0) + (1 / (1 + b[0]) if b else 0)
        if not (a and b):
            score *= ONLY_ONE_WEIGHT
        rec = (a or b)[1]
        parts = []
        if a:
            parts.append(f"Para você: {a[1].reason[:1].lower()}{a[1].reason[1:]}")
        if b:
            parts.append(f"Para {first}: {b[1].reason[:1].lower()}{b[1].reason[1:]}")
        strategy = "bridge" if rec.media.type == "album" else rec.strategy
        scored.append((score, bool(a and b), Recommendation(rec.media, round(score, 4), " · ".join(parts), strategy)))
    scored.sort(key=lambda x: (-x[1], -x[0]))
    return [rec for _, _, rec in scored[:limit]]
