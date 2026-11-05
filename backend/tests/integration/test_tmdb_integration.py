"""Testes de integração REAIS: backend + API do TMDB + banco de dados.

Rodam somente se CINEMATCH_TMDB_API_KEY estiver configurada (no .env ou no ambiente).
    python -m pytest -m integration -v      # só estes
    python -m pytest -m "not integration"   # tudo menos estes (offline)
"""

import pytest

from app.config import settings
from app.models import Media
from app.services.catalog import title_key
from app.services.tmdb import TmdbCatalogProvider, TmdbError

from ..conftest import register

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not settings.tmdb_api_key, reason="CINEMATCH_TMDB_API_KEY não configurada"),
]

VOCABULARY = {
    "Ação", "Aventura", "Animação", "Comédia", "Crime", "Documentário", "Drama", "Família", "Fantasia",
    "Histórico", "Terror", "Musical", "Mistério", "Romance", "Ficção Científica", "Suspense", "Guerra",
    "Faroeste",
}


@pytest.fixture()
def tmdb():
    provider = TmdbCatalogProvider(settings.tmdb_api_key, pages=1)
    yield provider
    provider.close()


# ------------------------------------------------------------ provider x TMDB real
def test_popular_movies_are_normalized(tmdb):
    movies = tmdb.popular("movie")
    assert len(movies) >= 15
    for m in movies:
        assert m["type"] == "movie" and m["external_id"].startswith("movie-")
        assert set(m["genres"]) <= VOCABULARY, m["genres"]
        assert 0 <= m["popularity"] <= 100
    assert sum(1 for m in movies if m["poster_url"]) >= len(movies) * 0.8
    assert all(m["poster_url"].startswith("https://image.tmdb.org/") for m in movies if m["poster_url"])


def test_popular_series_are_normalized(tmdb):
    series = tmdb.popular("series")
    assert len(series) >= 15
    assert all(s["type"] == "series" and s["external_id"].startswith("tv-") for s in series)
    assert all(set(s["genres"]) <= VOCABULARY for s in series)


def test_movie_details_in_portuguese(tmdb):
    dk = tmdb.get_title("movie", 155)
    assert dk["title"] == "Batman: O Cavaleiro das Trevas"
    assert dk["year"] == 2008
    assert "Christopher Nolan" in dk["creators"]
    assert {"Ação", "Crime"} <= set(dk["genres"])
    assert dk["tags"] and dk["overview"]


def test_series_details(tmdb):
    bb = tmdb.get_title("series", 1396)
    assert bb["title"] == "Breaking Bad" and bb["year"] == 2008
    assert bb["creators"] == ["Vince Gilligan"]


def test_search_finds_brazilian_movie(tmdb):
    ids = [r["external_id"] for r in tmdb.search("Cidade de Deus")]
    assert "movie-598" in ids


def test_unknown_id_returns_404(tmdb):
    with pytest.raises(TmdbError) as exc:
        tmdb.get_title("movie", 999_999_999)
    assert exc.value.status_code == 404


def test_invalid_key_is_rejected():
    provider = TmdbCatalogProvider("chave-invalida-123", pages=1)
    with pytest.raises(TmdbError) as exc:
        provider.popular("movie")
    assert "inválida" in str(exc.value)


# ------------------------------------------------ API (FastAPI) + TMDB + banco SQLite
def test_sync_endpoint_persists_tmdb_titles(client, db, admin_headers):
    before = db.query(Media).count()
    r = client.post("/admin/sync", params={"provider": "tmdb", "pages": 1}, headers=admin_headers)
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["provider"] == "TMDB" and res["fetched"] >= 30
    assert res["created"] + res["merged"] + res["skipped"] == res["fetched"]

    db.expire_all()
    tmdb_rows = db.query(Media).filter(Media.source == "tmdb").all()
    assert len(tmdb_rows) == res["created"] + res["merged"]
    assert db.query(Media).count() == before + res["created"]
    assert sum(1 for m in tmdb_rows if m.creators) >= len(tmdb_rows) * 0.7  # detalhes buscados
    keys = [title_key(m.type, m.title, m.year) for m in db.query(Media)]
    assert len(keys) == len(set(keys)), "títulos duplicados no catálogo"

    # idempotente: a segunda sincronização não cria nem duplica nada
    again = client.post("/admin/sync", params={"provider": "tmdb", "pages": 1}, headers=admin_headers).json()
    assert again["created"] == 0 and again["merged"] == 0
    db.expire_all()
    assert db.query(Media).count() == before + res["created"]

    # títulos importados aparecem na busca pública com pôster real
    some = next(m for m in tmdb_rows if m.poster_url)
    found = client.get("/media", params={"q": some.title}, headers=admin_headers).json()["items"]
    assert any(m["id"] == some.id and m["poster_url"] for m in found)


def test_import_merges_with_existing_mock_title(client, db, admin_headers):
    mock_dk = db.query(Media).filter(Media.title == "Batman: O Cavaleiro das Trevas").one()
    assert mock_dk.source == "mock"
    before = db.query(Media).count()

    r = client.post("/admin/tmdb/import", json={"type": "movie", "tmdb_id": 155}, headers=admin_headers)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["result"]["merged"] == 1
    assert body["media"]["id"] == mock_dk.id  # mesmo registro, agora com dados do TMDB
    assert body["media"]["source"] == "tmdb" and body["media"]["poster_url"]

    db.expire_all()
    assert db.query(Media).count() == before

    # a busca no TMDB já indica que o título está no catálogo
    found = client.get("/admin/tmdb/search", params={"q": "Batman O Cavaleiro das Trevas", "type": "movie"},
                       headers=admin_headers).json()
    assert any(f["external_id"] == "movie-155" and f["media_id"] == mock_dk.id for f in found)


def test_search_recognizes_title_already_in_mock_catalog(client, db, admin_headers):
    mock = db.query(Media).filter(Media.title == "Ainda Estou Aqui", Media.year == 2024).one()
    found = client.get("/admin/tmdb/search", params={"q": "Ainda Estou Aqui", "type": "movie"},
                       headers=admin_headers).json()
    match = [f for f in found if f["title"] == "Ainda Estou Aqui" and f["year"] == 2024]
    assert match and match[0]["media_id"] == mock.id


def test_import_unknown_id_returns_404(client, admin_headers):
    r = client.post("/admin/tmdb/import", json={"type": "movie", "tmdb_id": 999_999_999}, headers=admin_headers)
    assert r.status_code == 404


def test_recommendations_use_tmdb_catalog(client, db, admin_headers):
    """Usuário avalia títulos vindos do TMDB e o recomendador personaliza o feed com eles."""
    client.post("/admin/sync", params={"provider": "tmdb", "pages": 1}, headers=admin_headers)
    db.expire_all()
    tmdb_titles = db.query(Media).filter(Media.source == "tmdb").order_by(Media.popularity.desc()).all()
    assert len(tmdb_titles) >= 10

    user = register(client, email="tmdb-fan@teste.com")
    rated = [m.id for m in tmdb_titles[:3]]
    for mid in rated:
        assert client.post("/diary", json={"media_id": mid, "rating": 5}, headers=user).status_code == 201

    feed = client.get("/recommendations", params={"limit": 20}, headers=user).json()
    assert feed["strategy"] in {"content", "hybrid"}
    ids = [i["media"]["id"] for i in feed["items"]]
    assert len(ids) == 20 and not set(ids) & set(rated)
    assert any(i["media"]["source"] == "tmdb" for i in feed["items"])
    rated_titles = {m.title for m in tmdb_titles[:3]}
    assert any(any(t in i["reason"] for t in rated_titles) for i in feed["items"])
