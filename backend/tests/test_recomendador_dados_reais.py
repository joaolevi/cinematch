"""Recomendador com dados reais: vizinhos sem domínio dos populares (RNFF10), séries parecidas pelo TMDB (RNFF06) e
volta ao colaborativo das pessoas do Tastory quando não há vizinho de fora."""

import httpx
import numpy as np
from sqlalchemy import select

from app.models import ItemNeighbor, Media
from app.seed import create_synthetic_users
from app.services.recommender import cooccurrence_similarity
from app.services.series_neighbors import import_series_neighbors, save_neighbors
from app.services.tmdb import TmdbCatalogProvider

from .test_recommendations import external_neighbors_on, group_a_user, media_id_by_title


# ---------------------------------------------------------------- RNFF10
def test_cosseno_assimetrico_tira_a_vantagem_do_popular():
    # Três títulos: 0 é o que a pessoa curtiu; 1 é popular (visto por todos); 2 é de nicho, visto só por quem viu o 0
    R = np.array([[1, 1, 1], [1, 1, 1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]], dtype=float)
    products = R.T @ R
    cos = cooccurrence_similarity(products, alpha=0.5)
    norms = np.sqrt(np.diag(products))
    assert np.allclose(cos, (products / np.outer(norms, norms)) * (1 - np.eye(3)))  # 0,5 é o cosseno simples
    damped = cooccurrence_similarity(products, alpha=0.4)
    assert damped[0, 1] / damped[0, 2] < cos[0, 1] / cos[0, 2]  # o popular perde força como vizinho do 0
    assert np.all(np.diag(damped) == 0)


# ---------------------------------------------------------------- volta ao colaborativo interno
def test_sem_vizinho_de_fora_usa_as_pessoas_do_tastory(client, db, monkeypatch):
    external_neighbors_on(monkeypatch)
    create_synthetic_users(db, per_persona=3)
    headers = group_a_user(client)
    client.post("/diary", json={"media_id": media_id_by_title(client, headers, "Toy Story"), "rating": 5},
                headers=headers)
    assert db.scalar(select(ItemNeighbor)) is None
    assert client.get("/recommendations", headers=headers).json()["strategy"] == "hybrid"


# ---------------------------------------------------------------- RNFF06 nas séries
def test_vizinhos_do_tmdb_guiam_as_series(client, db, monkeypatch):
    external_neighbors_on(monkeypatch)
    headers = group_a_user(client)
    dark = media_id_by_title(client, headers, "Dark")
    vizinha = next(m for m in db.scalars(select(Media).where(Media.type == "series"))
                   if m.id != dark and "Comédia" in (m.genres or []))  # longe de Dark pelo conteúdo
    db.add(ItemNeighbor(media_id=dark, neighbor_id=vizinha.id, source="tmdb", score=1.0))
    db.commit()
    client.post("/diary", json={"media_id": dark, "rating": 5}, headers=headers)

    feed = client.get("/recommendations", params={"type": "series", "limit": 5}, headers=headers).json()
    assert feed["strategy"] == "hybrid"
    assert feed["items"][0]["media"]["id"] == vizinha.id
    assert feed["items"][0]["reason"] == "Quem curtiu Dark também curtiu"


def test_filmes_e_series_normalizados_a_parte(client, db, monkeypatch):
    external_neighbors_on(monkeypatch)
    headers = group_a_user(client)
    toy, titanic = media_id_by_title(client, headers, "Toy Story"), media_id_by_title(client, headers, "Titanic")
    dark = media_id_by_title(client, headers, "Dark")
    vizinha = next(m for m in db.scalars(select(Media).where(Media.type == "series"))
                   if m.id != dark and "Comédia" in (m.genres or []))
    db.add_all([ItemNeighbor(media_id=toy, neighbor_id=titanic, source="movielens", score=0.9),
                ItemNeighbor(media_id=dark, neighbor_id=vizinha.id, source="tmdb", score=0.05)])  # nota bem menor
    db.commit()
    for mid in (toy, dark):
        client.post("/diary", json={"media_id": mid, "rating": 5}, headers=headers)

    feed = client.get("/recommendations", params={"limit": 20}, headers=headers).json()["items"]
    ids = [i["media"]["id"] for i in feed]
    assert titanic in ids and vizinha.id in ids  # a nota baixa do TMDB não some ao lado da do MovieLens


# ---------------------------------------------------------------- importação das séries parecidas
def serie(tmdb_id, name, genres=(18,)):
    return {"id": tmdb_id, "name": name, "first_air_date": "2020-01-01", "overview": "Uma série.", "poster_path": "/p.jpg",
            "genre_ids": list(genres), "genres": [{"id": g} for g in genres], "popularity": 50, "vote_average": 7,
            "origin_country": ["US"], "original_language": "en", "created_by": [], "aggregate_credits": {"cast": []},
            "keywords": {"results": []}}


RECOMENDADAS = {101: [102, 999, 500], 102: [999, 101], 999: [101, 102]}


def fake_tmdb(request: httpx.Request) -> httpx.Response:
    parts = request.url.path.removeprefix("/3/").split("/")  # tv/<id>[/recommendations]
    tmdb_id = int(parts[1])
    if len(parts) == 3:
        return httpx.Response(200, json={"results": [{"id": i} for i in RECOMENDADAS.get(tmdb_id, [])]})
    return httpx.Response(200, json=serie(tmdb_id, f"Série {tmdb_id}"))


def test_importa_as_series_parecidas_e_traz_as_mais_citadas(db):
    for tmdb_id in (101, 102):
        db.add(Media(type="series", source="tmdb", external_id=f"tv-{tmdb_id}", title=f"Série {tmdb_id}",
                     genres=["Drama"], popularity=50))
    db.commit()
    client = httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(fake_tmdb))
    provider = TmdbCatalogProvider("chave-teste", pages=1, client=client, max_workers=2)

    result = import_series_neighbors(db, provider, min_mentions=2)
    assert result["trazidas"] == ["Série 999"]  # citada por duas; a 500, por uma só, fica de fora
    assert result["falhas"] == 0 and result["com_vizinhos"] == 3
    by_ext = {m.id: m.external_id for m in db.scalars(select(Media))}
    vizinhos = {(by_ext[n.media_id], by_ext[n.neighbor_id]): n.score
                for n in db.scalars(select(ItemNeighbor).where(ItemNeighbor.source == "tmdb"))}
    assert vizinhos[("tv-101", "tv-102")] == 1.0 and vizinhos[("tv-101", "tv-999")] == 0.95  # a posição dá a nota
    assert ("tv-101", "tv-500") not in vizinhos

    db.add(ItemNeighbor(media_id=1, neighbor_id=2, source="movielens", score=0.5))
    db.commit()
    assert save_neighbors(db, {101: [102]}) == 1  # refazer troca só os do TMDB
    assert db.scalar(select(ItemNeighbor).where(ItemNeighbor.source == "movielens")) is not None
