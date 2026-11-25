"""Séries parecidas pela rota de recomendações do TMDB (RNFF06 nas séries).

O MovieLens só tem filmes. Para as séries, o TMDB responde, para cada uma, uma lista de séries recomendadas, na ordem.
Guardamos essa lista como vizinhos (`ItemNeighbor`, fonte "tmdb"), e o recomendador lê esses vizinhos como lê os do
MovieLens, quando `TASTORY_USE_EXTERNAL_NEIGHBORS` está ligada. A nota de cada vizinho vem da posição: o primeiro vale
1, o vigésimo, 0,05.

Como o catálogo tem poucas séries, muita recomendação cai fora dele. As séries recomendadas para várias séries do
catálogo (`min_mentions`) são trazidas do TMDB, com detalhes, até `max_new`.
"""

from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import ItemNeighbor, Media
from .importing import import_tmdb
from .tmdb import TmdbCatalogProvider, TmdbError

SOURCE = "tmdb"
PER_TITLE = 20  # o TMDB devolve 20 recomendações por página; usamos só a primeira


def rank_score(position: int) -> float:
    return round(1 - position / PER_TITLE, 4)


def catalog_series(db: Session) -> dict[int, Media]:
    """Séries do catálogo que vieram do TMDB: ID do TMDB -> mídia."""
    rows = db.scalars(select(Media).where(Media.source == "tmdb", Media.type == "series", Media.external_id.like("tv-%")))
    return {int(m.external_id.removeprefix("tv-")): m for m in rows}


def recommended(provider: TmdbCatalogProvider, tmdb_id: int) -> list[int] | None:
    """IDs do TMDB das séries recomendadas para esta, na ordem. None se a consulta falhar."""
    try:
        results = provider._get(f"/tv/{tmdb_id}/recommendations").get("results", [])
    except TmdbError:
        return None
    return [r["id"] for r in results if not r.get("adult")][:PER_TITLE]


def save_neighbors(db: Session, lists: dict[int, list[int]]) -> int:
    """Troca os vizinhos de fonte "tmdb" pelos das listas (ID do TMDB -> recomendados), só entre séries do catálogo."""
    series = catalog_series(db)
    db.execute(delete(ItemNeighbor).where(ItemNeighbor.source == SOURCE))
    count = 0
    for tmdb_id, recs in lists.items():
        if tmdb_id not in series:
            continue
        for position, other in enumerate(recs):  # a nota segue a posição na lista do TMDB, mesmo com buracos
            if other not in series or other == tmdb_id:
                continue
            db.add(ItemNeighbor(media_id=series[tmdb_id].id, neighbor_id=series[other].id, source=SOURCE,
                                score=rank_score(position)))
            count += 1
    db.commit()
    return count


def import_series_neighbors(
    db: Session, provider: TmdbCatalogProvider, min_mentions: int = 2, max_new: int = 60
) -> dict:
    """Busca as recomendações de cada série, traz as mais citadas que faltam e guarda os vizinhos."""
    ids = list(catalog_series(db))
    with ThreadPoolExecutor(max_workers=provider.max_workers) as pool:
        found = list(pool.map(lambda tmdb_id: recommended(provider, tmdb_id), ids))
    lists = {tmdb_id: recs for tmdb_id, recs in zip(ids, found) if recs is not None}
    failed = len(ids) - len(lists)

    mentions = Counter(r for recs in lists.values() for r in set(recs) if r not in lists)
    brought = []
    for tmdb_id, times in mentions.most_common():
        if times < min_mentions or len(brought) >= max_new:
            break
        try:
            media, _ = import_tmdb(db, provider, "series", tmdb_id)
        except TmdbError:
            failed += 1
            continue
        brought.append(media.title)
        if (recs := recommended(provider, tmdb_id)) is not None:
            lists[tmdb_id] = recs

    neighbors = save_neighbors(db, lists)
    with_neighbors = len({n for (n,) in db.execute(
        select(ItemNeighbor.media_id).where(ItemNeighbor.source == SOURCE).distinct()
    )})
    return {"consultadas": len(lists), "trazidas": brought, "vizinhos": neighbors, "com_vizinhos": with_neighbors,
            "falhas": failed}
