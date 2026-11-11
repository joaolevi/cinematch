"""Calcula títulos parecidos com avaliações reais do MovieLens e guarda no banco.

Rode depois da carga do catálogo, porque ligamos os filmes pelo ID do TMDB. A base não fica no
repositório: baixe `ml-32m` em https://grouplens.org/datasets/movielens/ e respeite a licença,
que não permite uso comercial sem permissão. Para usar o resultado, defina
TASTORY_USE_EXTERNAL_NEIGHBORS=true.

Uso (a partir de backend/):
    python -m scripts.import_movielens <pasta-do-ml-32m>
"""

import argparse
import csv
from array import array
from pathlib import Path

import numpy as np
from scipy import sparse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine
from app.migrations import atualizar_banco
from app.models import ItemNeighbor, Media
from app.services.recommender import rating_weight

SOURCE = "movielens"
NEIGHBORS_PER_TITLE = 50
USERS_PER_CHUNK = 4096


def catalog_movies(db: Session) -> dict[int, int]:
    """Filmes do catálogo que vieram do TMDB: ID do TMDB -> ID da mídia."""
    rows = db.execute(
        select(Media.id, Media.external_id).where(
            Media.source == "tmdb", Media.type == "movie", Media.external_id.like("movie-%")
        )
    )
    return {int(external_id.removeprefix("movie-")): media_id for media_id, external_id in rows}


def load_links(root: Path, movies: dict[int, int]) -> dict[int, int]:
    """Filmes do MovieLens presentes no catálogo: ID do MovieLens -> ID da mídia."""
    links: dict[int, int] = {}
    with open(root / "links.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["tmdbId"] and int(row["tmdbId"]) in movies:
                links[int(row["movieId"])] = movies[int(row["tmdbId"])]
    return links


def load_matrix(root: Path, links: dict[int, int], media_ids: list[int]) -> sparse.csr_matrix:
    """Matriz usuário x título, só com os filmes do catálogo."""
    column = {media_id: i for i, media_id in enumerate(media_ids)}
    users: dict[int, int] = {}
    rows, cols, values = array("i"), array("i"), array("f")
    with open(root / "ratings.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            media_id = links.get(int(row["movieId"]))
            if media_id is None:
                continue
            rows.append(users.setdefault(int(row["userId"]), len(users)))
            cols.append(column[media_id])
            values.append(rating_weight(float(row["rating"])))
    return sparse.csr_matrix((values, (rows, cols)), shape=(len(users), len(media_ids)), dtype=np.float32)


def similarity(matrix: sparse.csr_matrix) -> np.ndarray:
    """Cosseno entre títulos, somando por blocos de usuários para caber na memória."""
    size = matrix.shape[1]
    products = np.zeros((size, size), dtype=np.float32)
    for start in range(0, matrix.shape[0], USERS_PER_CHUNK):
        block = matrix[start : start + USERS_PER_CHUNK].toarray()
        products += block.T @ block
    norms = np.sqrt(np.diag(products))
    norms[norms == 0] = 1
    result = products / norms[:, None] / norms[None, :]
    np.fill_diagonal(result, 0)
    return result


def top_neighbors(scores: np.ndarray, media_ids: list[int]) -> list[ItemNeighbor]:
    neighbors: list[ItemNeighbor] = []
    count = min(NEIGHBORS_PER_TITLE, len(media_ids) - 1)
    for row, media_id in enumerate(media_ids):
        for col in np.argsort(-scores[row])[:count]:
            if scores[row, col] > 0:
                neighbors.append(
                    ItemNeighbor(
                        media_id=media_id,
                        neighbor_id=media_ids[col],
                        source=SOURCE,
                        score=float(scores[row, col]),
                    )
                )
    return neighbors


def import_movielens(db: Session, root: Path) -> dict:
    links = load_links(root, catalog_movies(db))
    media_ids = sorted(set(links.values()))
    if len(media_ids) < 2:
        return {"titles": len(media_ids), "neighbors": 0}
    neighbors = top_neighbors(similarity(load_matrix(root, links, media_ids)), media_ids)
    db.execute(delete(ItemNeighbor).where(ItemNeighbor.source == SOURCE))
    db.add_all(neighbors)
    db.commit()
    return {"titles": len(media_ids), "neighbors": len(neighbors)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="pasta do ml-32m")
    args = parser.parse_args()

    atualizar_banco(engine)
    with SessionLocal() as db:
        print(import_movielens(db, args.dataset))


if __name__ == "__main__":
    main()
