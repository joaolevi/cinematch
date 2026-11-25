"""Assistir ou ouvir junto (RFF28): sugestões para duas ou mais pessoas ao mesmo tempo.

Gera as sugestões de cada uma (filmes, séries e, pelas pontes, álbuns) e dá prioridade ao que aparece para mais
gente: primeiro o que aparece para todas, depois para quase todas, e assim por diante. Dentro de cada grupo, vale a
posição nas listas de cada uma. O motivo mostra cada lado. Com `allow`, só entram os títulos que cabem no momento
(RFF20), como no "Hoje à noite".
"""

import re

from sqlalchemy.orm import Session

from ..models import User
from .bridges import album_suggestions
from .recommender import Recommendation, excluded_ids, recommend

POOL = 60  # quantas sugestões de cada pessoa entram na conta
MAX_PEOPLE = 5  # quem pede e até mais quatro pessoas


def _ranked(db: Session, user: User, allow: set[int] | None) -> dict[int, tuple[int, Recommendation]]:
    _, videos = recommend(db, user, None, POOL, allow=allow)
    albums = [r for r in album_suggestions(db, user.id, (), POOL // 3, allow=allow) if r.strategy == "bridge"]
    out: dict[int, tuple[int, Recommendation]] = {}
    for rank, rec in enumerate(videos + albums):
        out.setdefault(rec.media.id, (rank, rec))
    return out


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:]


def _third_person(reason: str) -> str:
    """O motivo vem escrito para a própria pessoa ("Porque você curtiu Duna"). No lado de outra pessoa, o "você" sai:
    "Para Levi: porque curtiu Duna"."""
    text = re.sub(r"\bvocê ", "", reason)
    return text.replace("o seu perfil", "o perfil").replace("da sua bolha", "da bolha")


def together(db: Session, people: list[User], limit: int = 20, allow: set[int] | None = None) -> list[Recommendation]:
    """`people[0]` é quem pede, e o motivo fala com quem pede ("Para você"). Nada que alguma das pessoas já registrou,
    descartou ou guardou entra."""
    ranked = [_ranked(db, p, allow) for p in people]
    seen = set().union(*(excluded_ids(db, p.id) for p in people))
    labels = ["você"] + [p.name.split()[0] for p in people[1:]]
    scored = []
    for mid in set().union(*ranked):
        if mid in seen:
            continue
        hits = [(label, r[mid]) for label, r in zip(labels, ranked) if mid in r]
        score = sum(1 / (1 + rank) for _, (rank, _) in hits)
        rec = hits[0][1][1]
        reason = " · ".join(
            f"Para {label}: {_lower_first(r.reason if label == 'você' else _third_person(r.reason))}"
            for label, (_, r) in hits
        )
        strategy = "bridge" if rec.media.type == "album" else rec.strategy
        scored.append((len(hits), score, Recommendation(rec.media, round(score, 4), reason, strategy)))
    scored.sort(key=lambda x: (-x[0], -x[1]))
    return [rec for _, _, rec in scored[:limit]]
