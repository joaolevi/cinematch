"""Serviço de Recomendação híbrido (pacote 3.4 da EAP / ator secundário do DCU).

Fluxo (Diagrama de Atividades):
  1. Consulta histórico e preferências do usuário.
  2. Sem dados  -> mídias em alta (cold start).
     Com dados  -> compara o perfil com os atributos do catálogo (conteúdo)
                   e reforça com preferências de usuários semelhantes (colaborativo).
  3. Remove descartados e já registrados e devolve o feed com o motivo de cada sugestão.

Variante A/B: grupo A = híbrido (conteúdo + colaborativo); grupo B = só conteúdo.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass

import numpy as np
from scipy import sparse
from scipy.sparse.linalg import norm as sparse_norm
from sklearn.feature_extraction.text import TfidfVectorizer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import (
    DiaryEntry,
    Dismissed,
    ItemNeighbor,
    ListItem,
    Media,
    User,
    UserInterest,
    UserList,
    UserPreference,
)

# Pesos dos sinais (explícitos e implícitos) no perfil do usuário
W_SEEN_NO_RATING = 0.6  # "Já vi" sem nota: gostou moderadamente
W_LIST = 0.5  # watchlist / listas (implícito)
W_DISMISS = -0.7  # "Não me interesso" (explícito negativo)
W_PREFERENCE = 1.0  # gêneros, décadas e criadores escolhidos no onboarding
W_ONBOARDING_LIKE = 0.8  # título marcado no onboarding, que entra no diário sem nota

POPULARITY_BONUS = 0.1
SERIES_POPULARITY_BONUS = 1.0  # sem avaliações reais de séries, a popularidade evita títulos obscuros
EXTERNAL_CONTENT_WEIGHT = 0.2  # com vizinhos de pessoas reais, o colaborativo pesa mais
DIVERSITY_PENALTY = 0.85  # multiplicador a cada repetição do gênero principal no topo
LATIN_LETTER = re.compile(r"[A-Za-zÀ-ÿ]")


@dataclass
class Recommendation:
    media: Media
    score: float
    reason: str
    strategy: str  # hybrid | content | trending


# ---------------------------------------------------------------- utilidades
def _tok(prefix: str, value: str) -> str:
    return f"{prefix}:{value.strip().lower().replace(' ', '_')}"


def has_readable_name(title: str) -> bool:
    """Aceita nomes com letras latinas e nomes só com números, como 1917."""
    return bool(LATIN_LETTER.search(title)) or not any(char.isalpha() for char in title)


def can_be_suggested(m: Media) -> bool:
    """O feed só sugere títulos do TMDB com sinopse, pôster e nome legível. A busca mostra todos."""
    if m.source != "tmdb":
        return True  # o catálogo mock não tem pôster
    return bool(m.overview and m.poster_url and has_readable_name(m.title))


def media_tokens(m: Media) -> str:
    """Transforma os atributos de uma mídia em 'palavras' para o TF-IDF."""
    toks: list[str] = []
    for g in m.genres or []:
        toks += [_tok("g", g)] * 2  # gênero pesa mais
    toks += [_tok("t", t) for t in m.tags or []]
    toks += [_tok("c", c) for c in m.creators or []]
    if m.year:
        toks.append(f"d:{(m.year // 10) * 10}")
    toks.append(f"type:{m.type}")
    return " ".join(toks)


def decade_label(decade: int) -> str:
    return f"anos {decade % 100}" if decade < 2000 else f"anos {decade}"


def rating_weight(rating: float | None) -> float:
    if rating is None:
        return W_SEEN_NO_RATING
    return (rating - 2.5) / 2.5  # 0.5 -> -0.8 ... 5.0 -> +1.0


def entry_weight(rating: float | None, from_onboarding: bool) -> float:
    """Peso de um registro do diário. Se a pessoa der uma nota depois, vale a nota."""
    return W_ONBOARDING_LIKE if rating is None and from_onboarding else rating_weight(rating)


def user_signals(db: Session, user_id: int) -> dict[int, float]:
    """Mapa media_id -> peso, combinando diário, listas e descartes."""
    signals: dict[int, float] = {}
    for media_id in db.scalars(
        select(ListItem.media_id).join(UserList).where(UserList.user_id == user_id)
    ):
        signals[media_id] = W_LIST
    for media_id in db.scalars(select(Dismissed.media_id).where(Dismissed.user_id == user_id)):
        signals[media_id] = W_DISMISS
    for media_id, rating, from_onboarding in db.execute(
        select(DiaryEntry.media_id, DiaryEntry.rating, DiaryEntry.from_onboarding).where(
            DiaryEntry.user_id == user_id
        )
    ):
        signals[media_id] = entry_weight(rating, from_onboarding)  # o diário tem prioridade
    return signals


def excluded_ids(db: Session, user_id: int) -> set[int]:
    """Itens que não devem aparecer no feed: já registrados, descartados ou na watchlist."""
    ids = set(db.scalars(select(DiaryEntry.media_id).where(DiaryEntry.user_id == user_id)))
    ids |= set(db.scalars(select(Dismissed.media_id).where(Dismissed.user_id == user_id)))
    ids |= set(
        db.scalars(
            select(ListItem.media_id)
            .join(UserList)
            .where(UserList.user_id == user_id, UserList.is_watchlist.is_(True))
        )
    )
    return ids


def _minmax(x: np.ndarray) -> np.ndarray:
    if x.size == 0:
        return x
    lo, hi = float(x.min()), float(x.max())
    if hi - lo < 1e-9:
        return np.zeros_like(x)
    return (x - lo) / (hi - lo)


def _pick_diverse(
    positions: Iterable[int], scores: np.ndarray, main_genre: Callable[[int], str], limit: int
) -> list[tuple[int, float]]:
    """Escolhe as melhores posições, penalizando a repetição do gênero principal no topo."""
    picked: list[tuple[int, float]] = []
    remaining = set(positions)
    genre_count: Counter[str] = Counter()
    while remaining and len(picked) < limit:
        best, best_score = None, -np.inf
        for pos in remaining:
            score = scores[pos] * (DIVERSITY_PENALTY ** genre_count[main_genre(pos)])
            if score > best_score:
                best, best_score = pos, score
        remaining.discard(best)
        genre_count[main_genre(best)] += 1
        picked.append((best, float(best_score)))
    return picked


# ---------------------------------------------------------------- cold start
def trending(
    db: Session,
    media_type: str | None = None,
    limit: int = 20,
    exclude: set[int] | None = None,
) -> list[Recommendation]:
    """Mídias em alta: popularidade do catálogo + quantidade de registros na plataforma."""
    exclude = exclude or set()
    q = select(Media)
    if media_type:
        q = q.where(Media.type == media_type)
    items = [m for m in db.scalars(q) if m.id not in exclude and can_be_suggested(m)]
    if not items:
        return []
    counts = dict(
        db.execute(select(DiaryEntry.media_id, func.count()).group_by(DiaryEntry.media_id)).all()
    )
    pop = np.array([m.popularity for m in items], dtype=float) / 100.0
    cnt = _minmax(np.array([counts.get(m.id, 0) for m in items], dtype=float))
    score = 0.7 * pop + 0.3 * cnt
    order = np.argsort(-score)[:limit]
    return [
        Recommendation(items[i], float(score[i]), "Em alta no Tastory", "trending") for i in order
    ]


# ---------------------------------------------------------------- híbrido
def recommend(
    db: Session,
    user: User,
    media_type: str | None = None,
    limit: int = 20,
    skip: Iterable[int] = (),
) -> tuple[str, list[Recommendation]]:
    """Gera o feed do usuário, sem os títulos de `skip`. Retorna (estratégia, recomendações)."""
    signals = user_signals(db, user.id)
    pref_genres = list(
        db.scalars(select(UserPreference.genre).where(UserPreference.user_id == user.id))
    )
    interests = db.execute(
        select(UserInterest.kind, UserInterest.value).where(UserInterest.user_id == user.id)
    ).all()
    pref_decades = [int(value) for kind, value in interests if kind == "decade"]
    pref_creators = [value for kind, value in interests if kind == "creator"]
    pref_tokens = [_tok("g", g) for g in pref_genres]
    pref_tokens += [f"d:{d}" for d in pref_decades]
    pref_tokens += [_tok("c", c) for c in pref_creators]
    exclude = excluded_ids(db, user.id) | set(skip)

    # Nó de decisão do DA: possui histórico ou preferências?
    if not signals and not pref_tokens:
        return "trending", trending(db, media_type, limit, exclude)

    catalog: list[Media] = list(db.scalars(select(Media).order_by(Media.id)))
    if not catalog:
        return "trending", []
    index = {m.id: i for i, m in enumerate(catalog)}

    # --- Conteúdo: perfil do usuário x atributos do catálogo (TF-IDF + cosseno)
    vectorizer = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False)
    X = vectorizer.fit_transform([media_tokens(m) for m in catalog])  # linhas já normalizadas (L2)

    sig_rows = [(index[mid], w) for mid, w in signals.items() if mid in index]
    profile = sparse.csr_matrix((1, X.shape[1]))
    for row, w in sig_rows:
        profile = profile + w * X[row]
    pref_vec = None
    if pref_tokens:
        pref_vec = vectorizer.transform([" ".join(pref_tokens)])
        profile = profile + W_PREFERENCE * pref_vec

    norm = sparse_norm(profile)
    if norm < 1e-9:
        return "trending", trending(db, media_type, limit, exclude)
    content = np.asarray((X @ profile.T).todense()).ravel() / norm  # cosseno em [-1, 1]

    # --- Colaborativo item-item: "quem curtiu X também curtiu Y"
    use_collab = user.ab_group == "A" and bool(sig_rows)
    collab = np.zeros(len(catalog))
    item_sim = None
    if use_collab and sig_rows:
        item_sim = (
            _external_similarity(db, catalog, index, sig_rows)
            if settings.use_external_neighbors
            else _item_similarity(db, index, len(catalog))
        )
        if item_sim is not None:
            rows = np.array([r for r, _ in sig_rows])
            ws = np.array([w for _, w in sig_rows])
            collab = np.asarray(ws @ item_sim[rows]).ravel() / (np.abs(ws).sum() + 1e-9)
            if not np.any(collab):
                use_collab = False
        else:
            use_collab = False

    # --- Combinação híbrida (alpha alto quando há pouco histórico)
    candidates = [
        i
        for i, m in enumerate(catalog)
        if m.id not in exclude and (media_type is None or m.type == media_type) and can_be_suggested(m)
    ]
    if not candidates:
        return ("hybrid" if use_collab else "content"), []
    cand = np.array(candidates)
    c_norm = _minmax(content[cand])
    if use_collab and settings.use_external_neighbors:
        # A base externa só cobre filmes: as séries seguem pelo conteúdo, para não sumirem do feed
        alpha = np.array([EXTERNAL_CONTENT_WEIGHT if catalog[i].type == "movie" else 1.0 for i in cand])
        cf_norm = _minmax(collab[cand])
        strategy = "hybrid"
    elif use_collab:
        alpha = np.full(len(cand), 0.8 if len(sig_rows) < 5 else 0.5)
        cf_norm = _minmax(collab[cand])
        strategy = "hybrid"
    else:
        alpha, cf_norm, strategy = np.ones(len(cand)), np.zeros(len(cand)), "content"
    pop = np.array([catalog[i].popularity for i in cand]) / 100.0
    blend = alpha * c_norm + (1 - alpha) * cf_norm
    final = blend + POPULARITY_BONUS * pop

    def main_genre(pos: int) -> str:
        return (catalog[cand[pos]].genres or ["?"])[0]

    def is_series(pos: int) -> bool:
        return catalog[cand[pos]].type == "series"

    picked = _pick_diverse(range(len(cand)), final, main_genre, limit)

    # Nas séries, a popularidade pesa mais. Os filmes e os lugares das séries no feed não mudam:
    # só as séries que ocupam esses lugares são escolhidas de novo.
    slots = [n for n, (pos, _) in enumerate(picked) if is_series(pos)]
    boosted = blend + SERIES_POPULARITY_BONUS * pop
    all_series = [pos for pos in range(len(cand)) if is_series(pos)]
    for slot, (pos, _) in zip(slots, _pick_diverse(all_series, boosted, main_genre, len(slots))):
        picked[slot] = (pos, picked[slot][1])

    recs: list[Recommendation] = []
    reason_uses: Counter[int] = Counter()  # evita repetir o mesmo título em todos os motivos
    for pos, score in picked:
        ci = int(cand[pos])
        reason = _reason(
            ci,
            catalog,
            X,
            sig_rows,
            pref_genres,
            pref_decades,
            pref_creators,
            pref_vec,
            item_sim if use_collab else None,
            content_share=alpha[pos] * c_norm[pos],
            collab_share=(1 - alpha[pos]) * cf_norm[pos],
            reason_uses=reason_uses,
        )
        recs.append(Recommendation(catalog[ci], score, reason, strategy))

    # Completa com mídias em alta se faltarem itens
    if len(recs) < limit:
        have = exclude | {r.media.id for r in recs}
        recs += trending(db, media_type, limit - len(recs), have)
    return strategy, recs


def similar_titles(db: Session, user: User, media_id: int, limit: int = 12) -> list[Media]:
    """Títulos do mesmo tipo parecidos com este, sem o que a pessoa já viu, descartou ou guardou."""
    catalog: list[Media] = list(db.scalars(select(Media).order_by(Media.id)))
    index = {m.id: i for i, m in enumerate(catalog)}
    media = catalog[index[media_id]]
    exclude = excluded_ids(db, user.id) | {media_id}
    usable = [m for m in catalog if m.type == media.type and m.id not in exclude and can_be_suggested(m)]
    by_id = {m.id: m for m in usable}

    picked: list[Media] = []
    if settings.use_external_neighbors:
        neighbors = db.scalars(
            select(ItemNeighbor.neighbor_id)
            .where(ItemNeighbor.media_id == media_id)
            .order_by(ItemNeighbor.score.desc())
        )
        picked = [by_id[n] for n in neighbors if n in by_id][:limit]

    if len(picked) < limit and usable:
        X = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False).fit_transform(
            [media_tokens(m) for m in catalog]
        )
        content = np.asarray((X @ X[index[media_id]].T).todense()).ravel()
        rows = [index[m.id] for m in usable]
        bonus = SERIES_POPULARITY_BONUS if media.type == "series" else POPULARITY_BONUS
        score = _minmax(content[rows]) + bonus * np.array([m.popularity for m in usable]) / 100.0
        have = {m.id for m in picked}
        ranked = [usable[pos] for pos in np.argsort(-score) if usable[pos].id not in have]
        picked += ranked[: limit - len(picked)]
    return picked


def _external_similarity(
    db: Session, catalog: list[Media], index: dict[int, int], sig_rows: list[tuple[int, float]]
) -> sparse.csr_matrix | None:
    """Vizinhos já calculados, só dos títulos do histórico do usuário."""
    media_ids = [catalog[row].id for row, _ in sig_rows]
    neighbors = db.execute(
        select(ItemNeighbor.media_id, ItemNeighbor.neighbor_id, ItemNeighbor.score).where(
            ItemNeighbor.media_id.in_(media_ids)
        )
    ).all()
    cells = [(index[m], index[n], score) for m, n, score in neighbors if m in index and n in index]
    if not cells:
        return None
    rows, cols, scores = zip(*cells)
    return sparse.csr_matrix((scores, (rows, cols)), shape=(len(catalog), len(catalog)))


def _item_similarity(db: Session, index: dict[int, int], n_items: int) -> np.ndarray | None:
    """Matriz item x item (cosseno) a partir das interações de todos os usuários."""
    per_user: dict[int, dict[int, float]] = defaultdict(dict)
    for uid, mid in db.execute(select(UserList.user_id, ListItem.media_id).join(ListItem)):
        per_user[uid][mid] = W_LIST
    for uid, mid, rating, from_onboarding in db.execute(
        select(DiaryEntry.user_id, DiaryEntry.media_id, DiaryEntry.rating, DiaryEntry.from_onboarding)
    ):
        per_user[uid][mid] = entry_weight(rating, from_onboarding)
    if len(per_user) < 2:
        return None
    rows, cols, vals = [], [], []
    for u, (uid, items) in enumerate(per_user.items()):
        for mid, w in items.items():
            if mid in index:
                rows.append(u)
                cols.append(index[mid])
                vals.append(w)
    R = sparse.csr_matrix((vals, (rows, cols)), shape=(len(per_user), n_items))
    col_norm = np.sqrt(np.asarray(R.multiply(R).sum(axis=0)).ravel())
    col_norm[col_norm == 0] = 1.0
    Rn = R @ sparse.diags(1.0 / col_norm)
    sim = np.asarray((Rn.T @ Rn).todense())
    np.fill_diagonal(sim, 0.0)
    return sim


def _reason(
    ci: int,
    catalog: list[Media],
    X,
    sig_rows: list[tuple[int, float]],
    pref_genres: list[str],
    pref_decades: list[int],
    pref_creators: list[str],
    pref_vec,
    item_sim: np.ndarray | sparse.csr_matrix | None,
    content_share: float,
    collab_share: float,
    reason_uses: Counter[int],
) -> str:
    """Explica a sugestão a partir do item do histórico que mais contribuiu."""
    positives = [(r, w) for r, w in sig_rows if w > 0]

    if item_sim is not None and collab_share > content_share and positives:
        r, _ = max(positives, key=lambda rw: rw[1] * item_sim[rw[0], ci] / (1 + reason_uses[rw[0]]))
        if item_sim[r, ci] > 0:
            reason_uses[r] += 1
            return f"Quem curtiu {catalog[r].title} também curtiu"

    best_item, best_val, best_rank = None, 0.0, 0.0
    for r, w in positives:
        val = w * float(X[r].multiply(X[ci]).sum())
        rank = val / (1 + reason_uses[r])
        if rank > best_rank:
            best_item, best_val, best_rank = r, val, rank
    pref_val = float(pref_vec.multiply(X[ci]).sum()) * W_PREFERENCE if pref_vec is not None else 0.0

    if best_item is not None and best_val >= pref_val:
        reason_uses[best_item] += 1
        return f"Porque você curtiu {catalog[best_item].title}"
    media = catalog[ci]
    creators = [c for c in pref_creators if c in (media.creators or [])]
    if creators:
        return f"Porque você curte {creators[0]}"
    matching = [g for g in pref_genres if g in (media.genres or [])]
    if matching:
        return f"Porque você gosta de {matching[0]}"
    decade = (media.year // 10) * 10 if media.year else None
    if decade in pref_decades:
        return f"Porque você curte os {decade_label(decade)}"
    if best_item is not None:
        return f"Porque você curtiu {catalog[best_item].title}"
    return "Combina com o seu perfil"
