"""Compatibilidade de gosto entre duas pessoas (RFF15).

Cada pessoa vira um vetor com os títulos que curtiu e, com peso menor, os gêneros, as pessoas (direção, criação,
artistas) e as décadas desses títulos, nas três mídias. A compatibilidade é o cosseno entre os dois vetores, de 0 a 100:
quem curtiu os mesmos títulos fica perto de 100; quem curte os mesmos gêneros e épocas, sem títulos em comum, fica no
meio.
"""

import math
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Follow, Media, User
from .recommender import user_signals

W_TITLE = 2.0
W_GENRE = 1.0
W_PERSON = 1.0
W_DECADE = 0.5
MAX_SHARED = 12


def taste_vector(db: Session, user_id: int) -> tuple[Counter[str], dict[int, float], dict[int, Media]]:
    liked = {mid: w for mid, w in user_signals(db, user_id).items() if w > 0}
    media = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_(liked)))} if liked else {}
    vec: Counter[str] = Counter()
    for mid, w in liked.items():
        m = media.get(mid)
        if m is None:
            continue
        vec[f"t:{mid}"] += W_TITLE * w
        for g in m.genres or []:
            vec[f"g:{g}"] += W_GENRE * w
        for p in m.creators or []:
            vec[f"p:{p}"] += W_PERSON * w
        if m.year:
            vec[f"d:{m.year // 10 * 10}"] += W_DECADE * w
    return vec, liked, media


def _cosine(a: Counter[str], b: Counter[str]) -> float:
    dot = sum(v * b[k] for k, v in a.items() if k in b)
    na, nb = math.sqrt(sum(v * v for v in a.values())), math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


MIN_SUGGEST = 25  # abaixo disso, "gostos bem diferentes": não vale sugerir


def suggest_people(db: Session, me: User, limit: int = 5) -> list[dict]:
    """Quem seguir (RFF15): as pessoas de gosto mais parecido que quem pede ainda não segue. Só entram contas de
    pessoas reais que deixam ver os registros para todos (RFF10), com pelo menos 25% de compatibilidade."""
    from ..seed import DEMO_EMAIL

    mine, _, _ = taste_vector(db, me.id)
    if not mine:
        return []
    followed = set(db.scalars(select(Follow.followed_id).where(Follow.follower_id == me.id)))
    candidates = db.scalars(
        select(User).where(
            User.id != me.id, User.role == "user", User.is_synthetic.is_(False), User.email != DEMO_EMAIL,
            User.visibility == "all",
        )
    )
    found = []
    for person in candidates:
        if person.id in followed:
            continue
        theirs, _, _ = taste_vector(db, person.id)
        percent = round(100 * _cosine(mine, theirs)) if theirs else 0
        if percent >= MIN_SUGGEST:
            found.append({"id": person.id, "name": person.name, "percent": percent, "label": label_for(percent)})
    found.sort(key=lambda p: (-p["percent"], p["name"]))
    return found[:limit]


def label_for(percent: int) -> str:
    if percent >= 75:
        return "Gostos quase gêmeos"
    if percent >= 50:
        return "Gostos parecidos"
    if percent >= 25:
        return "Alguma coisa em comum"
    return "Gostos bem diferentes"


def compatibility(db: Session, me_id: int, other_id: int) -> dict:
    """O percentual, uma frase, os títulos que as duas curtiram e os gêneros que mais têm em comum."""
    mine, my_liked, my_media = taste_vector(db, me_id)
    theirs, their_liked, their_media = taste_vector(db, other_id)
    if not mine or not theirs:
        who = "Você ainda não registrou" if not mine else "Esta pessoa ainda não registrou"
        return {"percent": None, "label": f"{who} o que curte", "shared": [], "genres": []}
    percent = round(100 * _cosine(mine, theirs))
    both = sorted(set(my_liked) & set(their_liked), key=lambda mid: -(my_liked[mid] + their_liked[mid]))
    genres = sorted(
        (k[2:] for k in mine if k.startswith("g:") and k in theirs),
        key=lambda k: -min(mine[f"g:{k}"], theirs[f"g:{k}"]),
    )
    return {
        "percent": percent,
        "label": label_for(percent),
        "shared": [my_media.get(mid) or their_media[mid] for mid in both[:MAX_SHARED]],
        "genres": genres[:4],
    }
