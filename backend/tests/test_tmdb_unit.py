"""Testes do provider do TMDB SEM rede: as respostas da API são simuladas com httpx.MockTransport."""

import dataclasses

import httpx
import pytest

from app.config import settings
from app.models import DiaryEntry, Media, RecEvent, User
from app.routers import admin as admin_router
from app.services.catalog import MockCatalogProvider, sync_catalog, title_key
from app.services.tmdb import (
    StaticProvider,
    enrich_catalog,
    TmdbCatalogProvider,
    TmdbError,
    map_genres,
    normalize_popularity,
)

MOVIE = {
    "id": 155, "title": "Batman: O Cavaleiro das Trevas", "release_date": "2008-07-16",
    "overview": "Batman enfrenta o Coringa.", "poster_path": "/dk.jpg", "genre_ids": [28, 80, 53],
    "popularity": 2300.0, "vote_average": 8.5,
}
SERIES = {
    "id": 1396, "name": "Breaking Bad", "first_air_date": "2008-01-20", "overview": "Um professor...",
    "poster_path": "/bb.jpg", "genre_ids": [18, 80], "popularity": 400.0, "vote_average": 8.9,
}
NEW_MOVIE = {
    "id": 999001, "title": "Filme Inédito", "release_date": "2026-03-01", "overview": "",
    "poster_path": None, "genre_ids": [878, 10770], "popularity": 50.0, "vote_average": 7.0,
}


def fake_tmdb(request: httpx.Request) -> httpx.Response:
    if request.url.params.get("api_key") != "chave-teste":
        return httpx.Response(401, json={"status_message": "Invalid API key"})
    path = request.url.path.removeprefix("/3")
    routes = {
        "/movie/popular": {"results": [MOVIE, NEW_MOVIE]},
        "/tv/popular": {"results": [SERIES]},
        "/movie/155": {**MOVIE, "genres": [{"id": 28}, {"id": 80}, {"id": 53}],
                       "credits": {"crew": [{"job": "Director", "name": "Christopher Nolan"},
                                            {"job": "Writer", "name": "Jonathan Nolan"}],
                                   "cast": [{"name": f"Ator {i}"} for i in range(1, 12)]},
                       "keywords": {"keywords": [{"name": "Joker"}, {"name": "Superhero"}]}},
        "/movie/999001": {**NEW_MOVIE, "genres": [{"id": 878}],
                          "credits": {"crew": []}, "keywords": {"keywords": []}},
        "/tv/1396": {**SERIES, "genres": [{"id": 18}, {"id": 80}],
                     "created_by": [{"name": "Vince Gilligan"}], "keywords": {"results": [{"name": "drug"}]},
                     "aggregate_credits": {"cast": [{"name": "Bryan Cranston"}, {"name": "Aaron Paul"}]}},
        "/movie/603": {"id": 603, "title": "Matrix", "release_date": "1999-03-31", "overview": "Neo descobre...",
                       "poster_path": "/matrix.jpg", "genres": [{"id": 28}], "popularity": 90, "vote_average": 8.2,
                       "credits": {"crew": [], "cast": [{"name": "Keanu Reeves"}]}, "keywords": {"keywords": []}},
        "/search/multi": {"results": [{**MOVIE, "media_type": "movie"}, {"id": 1, "media_type": "person"}]},
    }
    if path in routes:
        return httpx.Response(200, json=routes[path])
    if path == "/search/movie":  # usado no enriquecimento do catálogo
        q = request.url.params.get("query", "")
        if q == "Matrix":
            return httpx.Response(200, json={"results": [
                {"id": 603, "title": "Matrix", "release_date": "1999-03-31", "overview": "Neo descobre...",
                 "poster_path": "/matrix.jpg", "genre_ids": [28, 878], "popularity": 90, "vote_average": 8.2}]})
        return httpx.Response(200, json={"results": []})
    if path == "/search/tv":
        return httpx.Response(200, json={"results": []})
    return httpx.Response(404, json={"status_message": "not found"})


def make_provider(key="chave-teste", **kw) -> TmdbCatalogProvider:
    client = httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(fake_tmdb))
    return TmdbCatalogProvider(key, pages=1, client=client, max_workers=2, **kw)


def test_map_genres_uses_tastory_vocabulary():
    assert map_genres("movie", [878, 53, 10770]) == ["Ficção Científica", "Suspense"]
    assert map_genres("series", [10765, 10759]) == ["Ficção Científica", "Fantasia", "Ação", "Aventura"]


def test_normalize_popularity_is_bounded():
    assert 0 <= normalize_popularity(0, 0) <= normalize_popularity(100, 6) <= normalize_popularity(5000, 9) <= 100


def test_fetch_titles_normalizes_and_enriches():
    titles = {t["external_id"]: t for t in make_provider().fetch_titles()}
    assert set(titles) == {"movie-155", "movie-999001", "tv-1396"}
    dk = titles["movie-155"]
    assert dk["type"] == "movie" and dk["year"] == 2008
    assert dk["genres"] == ["Ação", "Crime", "Suspense"]
    assert dk["creators"] == ["Christopher Nolan"]
    assert dk["actors"] == [f"Ator {i}" for i in range(1, 9)]  # só o elenco principal
    assert dk["tags"] == ["joker", "superhero"]
    assert dk["poster_url"].endswith("/dk.jpg")
    bb = titles["tv-1396"]
    assert bb["type"] == "series" and bb["creators"] == ["Vince Gilligan"]
    assert bb["actors"] == ["Bryan Cranston", "Aaron Paul"]
    assert titles["movie-999001"]["poster_url"] is None


def test_search_ignores_people():
    results = make_provider().search("batman")
    assert [r["external_id"] for r in results] == ["movie-155"]


def test_invalid_key_raises():
    with pytest.raises(TmdbError) as exc:
        make_provider(key="errada").popular("movie")
    assert "inválida" in str(exc.value)


def test_missing_key_raises():
    with pytest.raises(TmdbError):
        TmdbCatalogProvider("")


def test_sync_promotes_mock_title_instead_of_duplicating(db):
    before = db.query(Media).count()
    result = sync_catalog(db, make_provider(), source="tmdb")
    # Batman e Breaking Bad já existiam no mock -> promovidos; o filme inédito é criado
    assert result["merged"] == 2 and result["created"] == 1
    assert db.query(Media).count() == before + 1
    dk = db.query(Media).filter(Media.external_id == "movie-155").one()
    assert dk.source == "tmdb" and dk.poster_url and dk.creators == ["Christopher Nolan"]
    keys = [title_key(m.type, m.title, m.year) for m in db.query(Media)]
    assert len(keys) == len(set(keys))  # nenhum título duplicado

    again = sync_catalog(db, make_provider(), source="tmdb")
    assert again["created"] == 0 and again["merged"] == 0


def test_mock_sync_does_not_demote_tmdb_titles(db):
    sync_catalog(db, make_provider(), source="tmdb")
    before = db.query(Media).count()
    result = sync_catalog(db, MockCatalogProvider(settings.seed_catalog_path), source="mock")
    assert result["skipped"] == 2  # Batman e Breaking Bad já são do TMDB: o mock não os rebaixa
    assert result["created"] == 0 and db.query(Media).count() == before
    assert db.query(Media).filter(Media.external_id == "movie-155").one().source == "tmdb"


def test_static_provider_import(db):
    title = make_provider().get_title("movie", 999001)
    result = sync_catalog(db, StaticProvider([title]), source="tmdb")
    assert result["created"] == 1


# ---------------------------------------------------------------- rotas admin (sem rede)
@pytest.fixture()
def fake_admin_provider(monkeypatch):
    monkeypatch.setattr(admin_router, "tmdb_provider", lambda pages=None: make_provider())


def test_admin_sync_tmdb_route(client, admin_headers, fake_admin_provider):
    r = client.post("/admin/sync", params={"provider": "tmdb"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["provider"] == "TMDB" and r.json()["fetched"] == 3


def test_admin_import_and_search_routes(client, admin_headers, fake_admin_provider):
    r = client.post("/admin/tmdb/import", json={"type": "movie", "tmdb_id": 155}, headers=admin_headers)
    assert r.status_code == 201, r.text
    media = r.json()["media"]
    assert media["source"] == "tmdb" and r.json()["result"]["merged"] == 1

    found = client.get("/admin/tmdb/search", params={"q": "batman"}, headers=admin_headers).json()
    assert found[0]["media_id"] == media["id"]  # já está no catálogo


def test_admin_tmdb_without_key_returns_400(client, admin_headers, monkeypatch):
    monkeypatch.setattr(admin_router, "settings", dataclasses.replace(admin_router.settings, tmdb_api_key=""))
    r = client.get("/admin/tmdb/search", params={"q": "x"}, headers=admin_headers)
    assert r.status_code == 400
    # sem chave, o modo automático cai no mock
    r = client.post("/admin/sync", headers=admin_headers)
    assert r.status_code == 200 and r.json()["provider"] == "Mock TMDB"


def test_enrich_catalog_adds_posters_keeping_tags(db):
    matrix = db.query(Media).filter(Media.title == "Matrix").one()
    tags_before, creators_before = list(matrix.tags), list(matrix.creators)
    result = enrich_catalog(db, make_provider())
    assert result["enriched"] == 1 and result["checked"] > 100
    db.refresh(matrix)
    assert matrix.source == "tmdb" and matrix.external_id == "movie-603"
    assert matrix.poster_url.endswith("/matrix.jpg") and matrix.overview == "Neo descobre..."
    assert matrix.tags == tags_before and matrix.creators == creators_before
    assert matrix.actors == ["Keanu Reeves"]
    # rodar de novo não refaz quem já tem pôster
    assert enrich_catalog(db, make_provider())["enriched"] == 0


def test_enrich_merges_mock_title_already_in_tmdb_with_another_name(db):
    mock = db.query(Media).filter(Media.title == "Matrix").one()
    twin = Media(type="movie", title="Matrix: Outro Nome", year=1999, source="tmdb", external_id="movie-603")
    db.add(twin)
    moved = User(name="Moved", email="moved@t.com", password_hash="x", ab_group="A")
    both = User(name="Both", email="both@t.com", password_hash="x", ab_group="A")
    db.add_all([moved, both])
    db.flush()
    db.add_all([
        DiaryEntry(user_id=moved.id, media_id=mock.id, rating=4),
        DiaryEntry(user_id=both.id, media_id=mock.id, rating=1),
        DiaryEntry(user_id=both.id, media_id=twin.id, rating=5),
        RecEvent(user_id=moved.id, media_id=mock.id, action="shown", variant="A"),
    ])
    db.commit()
    mock_id = mock.id

    assert enrich_catalog(db, make_provider())["merged"] == 1

    db.expire_all()
    assert db.get(Media, mock_id) is None
    entries = {e.user_id: e.rating for e in db.query(DiaryEntry).filter(DiaryEntry.media_id == twin.id)}
    assert entries == {moved.id: 4, both.id: 5}  # quem tinha os dois fica com o registro do título que ficou
    assert db.query(DiaryEntry).filter(DiaryEntry.media_id == mock_id).count() == 0
    assert db.query(RecEvent).filter(RecEvent.media_id == twin.id).count() == 1


def test_admin_enrich_route(client, admin_headers, fake_admin_provider):
    r = client.post("/admin/tmdb/enrich", headers=admin_headers)
    assert r.status_code == 200 and r.json()["enriched"] == 1
