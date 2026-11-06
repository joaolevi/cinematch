"""Avalia o recomendador com avaliações reais do MovieLens (teste exploratório, ver docs/ARQUITETURA.md).

Reproduz a fórmula de `app/services/recommender.py`, sem a etapa de diversidade, e compara as variantes.
A base não fica no repositório: baixe `ml-latest-small` em https://grouplens.org/datasets/movielens/latest/

Uso (a partir de backend/):
    python -m scripts.evaluate_recommender <pasta-do-ml-latest-small>
"""

import argparse
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import NamedTuple

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

from app.services.recommender import POPULARITY_BONUS, _minmax, rating_weight

TOP_K = 20
MIN_RATINGS_IN_CATALOG = 5  # filmes com menos avaliações ficam fora do catálogo
MIN_HISTORY = 5  # usuários com menos registros não entram na avaliação
LIKED_RATING = 4.0  # a partir dessa nota, o filme conta como acerto
TRAIN_SHARE = 0.8  # parte das avaliações usada como histórico
HYBRID_CONTENT_WEIGHT = 0.5  # alpha do grupo A para quem tem histórico
TUNED_CONTENT_WEIGHT = 0.2
COLLAB_USER_COUNTS = (10, 30, 100, 300)
RANDOM_REPEATS = 5
BOOTSTRAP_SAMPLES = 2000


class Rating(NamedTuple):
    user_id: int
    movie_id: int
    value: float
    timestamp: int


class Catalog(NamedTuple):
    positions: dict[int, int]  # movie_id -> posição na matriz
    features: sparse.csr_matrix


# ---------------------------------------------------------------- dados
def load_ratings(root: Path) -> list[Rating]:
    with open(root / "ratings.csv", newline="", encoding="utf-8") as f:
        return [
            Rating(int(r["userId"]), int(r["movieId"]), float(r["rating"]), int(r["timestamp"]))
            for r in csv.DictReader(f)
        ]


def movie_tokens(title: str, genres: list[str], tags: list[str]) -> str:
    """Transforma um filme em 'palavras' para o TF-IDF, como `media_tokens` faz no recomendador."""
    tokens: list[str] = []
    for genre in genres:
        tokens += ["g:" + genre.lower().replace(" ", "_")] * 2  # gênero pesa mais
    tokens += ["t:" + tag for tag in sorted(set(tags))]
    year = re.search(r"\((\d{4})\)", title)
    if year:
        tokens.append(f"d:{int(year.group(1)) // 10 * 10}")
    tokens.append("type:movie")
    return " ".join(tokens)


def load_catalog(root: Path, ratings: list[Rating]) -> Catalog:
    titles: dict[int, str] = {}
    genres: dict[int, list[str]] = {}
    with open(root / "movies.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            movie_id = int(row["movieId"])
            titles[movie_id] = row["title"]
            genres[movie_id] = [] if row["genres"].startswith("(no") else row["genres"].split("|")

    tags: dict[int, list[str]] = defaultdict(list)
    with open(root / "tags.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            tags[int(row["movieId"])].append(row["tag"].strip().lower().replace(" ", "_"))

    counts = Counter(r.movie_id for r in ratings)
    movies = sorted(m for m, c in counts.items() if c >= MIN_RATINGS_IN_CATALOG and m in genres)
    documents = [movie_tokens(titles[m], genres[m], tags[m]) for m in movies]
    features = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False).fit_transform(documents).tocsr()
    return Catalog({m: i for i, m in enumerate(movies)}, features)


def split_by_time(ratings: list[Rating]) -> tuple[list[Rating], dict[int, set[int]]]:
    """Corte global: o histórico é o passado, e os acertos estão no futuro."""
    timestamps = sorted(r.timestamp for r in ratings)
    cutoff = timestamps[int(TRAIN_SHARE * len(timestamps))]
    train = [r for r in ratings if r.timestamp < cutoff]
    test: dict[int, set[int]] = defaultdict(set)
    for r in ratings:
        if r.timestamp >= cutoff and r.value >= LIKED_RATING:
            test[r.user_id].add(r.movie_id)
    return train, test


def split_by_user(ratings: list[Rating]) -> tuple[list[Rating], dict[int, set[int]]]:
    """Corte por usuário: esconde as últimas avaliações de cada pessoa."""
    by_user: dict[int, list[Rating]] = defaultdict(list)
    for r in ratings:
        by_user[r.user_id].append(r)
    train: list[Rating] = []
    test: dict[int, set[int]] = {}
    for user_id, rows in by_user.items():
        rows.sort(key=lambda r: r.timestamp)
        cut = int(len(rows) * TRAIN_SHARE)
        train += rows[:cut]
        test[user_id] = {r.movie_id for r in rows[cut:] if r.value >= LIKED_RATING}
    return train, test


# ---------------------------------------------------------------- avaliação
def item_similarity(train: list[Rating], index: dict[int, int], users: list[int] | None = None) -> np.ndarray:
    """Matriz item x item (cosseno), como `_item_similarity` no recomendador."""
    user_ids = sorted({r.user_id for r in train}) if users is None else sorted(users)
    position = {u: i for i, u in enumerate(user_ids)}
    rated = [r for r in train if r.user_id in position and r.movie_id in index]
    matrix = sparse.csr_matrix(
        (
            [rating_weight(r.value) for r in rated],
            ([position[r.user_id] for r in rated], [index[r.movie_id] for r in rated]),
        ),
        shape=(len(user_ids), len(index)),
        dtype=np.float32,
    )
    norms = np.sqrt(np.asarray(matrix.multiply(matrix).sum(0)).ravel())
    norms[norms == 0] = 1
    normalized = matrix @ sparse.diags(1 / norms)
    similarity = np.asarray((normalized.T @ normalized).todense(), dtype=np.float32)
    np.fill_diagonal(similarity, 0)
    return similarity


def ndcg(hit_positions: list[int], relevant: int) -> float:
    gain = sum(1 / np.log2(i + 2) for i in hit_positions)
    best = sum(1 / np.log2(i + 2) for i in range(min(relevant, TOP_K)))
    return gain / best


def variant_scores(content: np.ndarray, collab: np.ndarray, popularity: np.ndarray) -> dict[str, np.ndarray]:
    bonus = POPULARITY_BONUS * popularity
    alpha, tuned = HYBRID_CONTENT_WEIGHT, TUNED_CONTENT_WEIGHT
    return {
        "popularidade": popularity,
        "conteúdo (grupo B)": content + bonus,
        "híbrido atual (grupo A)": alpha * content + (1 - alpha) * collab + bonus,
        "híbrido com peso 0,2 em conteúdo": tuned * content + (1 - tuned) * collab + bonus,
        "colaborativo puro": collab + bonus,
    }


def evaluate(
    train: list[Rating], test: dict[int, set[int]], catalog: Catalog, similarity: np.ndarray
) -> dict[str, np.ndarray]:
    """Retorna, por variante, uma linha por usuário com acerto, recall e NDCG."""
    index, features = catalog
    history: dict[int, list[tuple[int, float]]] = defaultdict(list)
    popularity = np.zeros(len(index))
    for r in train:
        if r.movie_id in index:
            history[r.user_id].append((index[r.movie_id], rating_weight(r.value)))
            popularity[index[r.movie_id]] += 1
    popularity = np.log1p(popularity) / max(np.log1p(popularity).max(), 1e-9)

    results: dict[str, list[tuple[float, float, float]]] = defaultdict(list)
    for user_id, liked in test.items():
        seen = {i for i, _ in history[user_id]}
        relevant = {index[m] for m in liked if m in index} - seen
        if len(history[user_id]) < MIN_HISTORY or not relevant:
            continue
        rows = np.array([i for i, _ in history[user_id]])
        weights = np.array([w for _, w in history[user_id]], dtype=np.float32)

        profile = sparse.csr_matrix(weights.reshape(1, -1)) @ features[rows]
        norm = np.sqrt(profile.multiply(profile).sum()) or 1.0
        content = np.asarray((features @ profile.T).todense()).ravel() / norm
        collab = (weights @ similarity[rows]) / (np.abs(weights).sum() + 1e-9)

        candidates = np.array([i for i in range(len(index)) if i not in seen])
        scores = variant_scores(
            _minmax(content[candidates]), _minmax(collab[candidates]), popularity[candidates]
        )
        for name, score in scores.items():
            top = candidates[np.argsort(-score)[:TOP_K]]
            hits = [pos for pos, item in enumerate(top) if int(item) in relevant]
            results[name].append(
                (float(bool(hits)), len(hits) / min(len(relevant), TOP_K), ndcg(hits, len(relevant)))
            )
    return {name: np.array(rows) for name, rows in results.items()}


# ---------------------------------------------------------------- relatório
def print_report(results: dict[str, np.ndarray], title: str) -> None:
    users = len(next(iter(results.values())))
    print(f"\n### {title} | usuários avaliados={users}")
    print(f"{'variante':36} acerto@{TOP_K}  recall@{TOP_K}  ndcg@{TOP_K}")
    for name, rows in results.items():
        print(f"{name:36} {rows[:, 0].mean():8.3f} {rows[:, 1].mean():10.3f} {rows[:, 2].mean():8.3f}")

    difference = results["híbrido atual (grupo A)"][:, 2] - results["conteúdo (grupo B)"][:, 2]
    rng = np.random.default_rng(0)
    samples = [
        difference[rng.integers(0, len(difference), len(difference))].mean()
        for _ in range(BOOTSTRAP_SAMPLES)
    ]
    low, high = np.percentile(samples, 2.5), np.percentile(samples, 97.5)
    print(f"A - B em ndcg@{TOP_K}: {difference.mean():+.3f} (IC 95%: {low:+.3f} a {high:+.3f})")


def print_user_effect(train: list[Rating], test: dict[int, set[int]], catalog: Catalog) -> None:
    """Mede quanto o colaborativo melhora conforme o número de usuários disponíveis."""
    all_users = sorted({r.user_id for r in train})
    rng = np.random.default_rng(1)
    print("\n### Efeito do número de usuários no colaborativo (últimos 20% de cada usuário)")
    print(f"{'usuários no colaborativo':26} A(ndcg)  B(ndcg)  A-B")
    for count in (*COLLAB_USER_COUNTS, len(all_users)):
        repeats = 1 if count == len(all_users) else RANDOM_REPEATS
        group_a, group_b = [], []
        for _ in range(repeats):
            users = all_users if count == len(all_users) else rng.choice(all_users, count, replace=False).tolist()
            results = evaluate(train, test, catalog, item_similarity(train, catalog.positions, users))
            group_a.append(results["híbrido atual (grupo A)"][:, 2].mean())
            group_b.append(results["conteúdo (grupo B)"][:, 2].mean())
        a, b = float(np.mean(group_a)), float(np.mean(group_b))
        print(f"{count:<26} {a:6.3f}  {b:6.3f}  {a - b:+.3f}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="pasta do ml-latest-small")
    args = parser.parse_args()

    ratings = load_ratings(args.dataset)
    catalog = load_catalog(args.dataset, ratings)
    print(f"avaliações={len(ratings)} catálogo avaliado={len(catalog.positions)}")

    train, test = split_by_time(ratings)
    results = evaluate(train, test, catalog, item_similarity(train, catalog.positions))
    print_report(results, "Corte temporal global (80% passado, 20% futuro)")

    train, test = split_by_user(ratings)
    results = evaluate(train, test, catalog, item_similarity(train, catalog.positions))
    print_report(results, "Últimos 20% de cada usuário")
    print_user_effect(train, test, catalog)


if __name__ == "__main__":
    main()
