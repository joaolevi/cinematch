from datetime import date

from sqlalchemy import event

from app.db import engine
from app.models import Media
from app.services.catalog import search_text

from .conftest import media_id_by_title


def test_search_media(client, user_headers):
    r = client.get("/media", params={"q": "matrix"}, headers=user_headers)
    assert r.status_code == 200
    assert r.json()["items"][0]["title"] == "Matrix"

    series = client.get("/media", params={"type": "series", "limit": 100}, headers=user_headers).json()
    assert series["total"] > 0
    assert all(m["type"] == "series" for m in series["items"])


def test_register_consumption_with_rating(client, user_headers):
    mid = media_id_by_title(client, user_headers, "Parasita")
    r = client.post("/diary", json={"media_id": mid, "rating": 4.5, "review": "Genial"}, headers=user_headers)
    assert r.status_code == 201
    entry = r.json()
    assert entry["rating"] == 4.5 and entry["media"]["title"] == "Parasita"

    detail = client.get(f"/media/{mid}", headers=user_headers).json()
    assert detail["my_status"]["diary_entry_id"] == entry["id"]
    assert detail["ratings_count"] == 1
    assert detail["reviews"][0]["review"] == "Genial"
    assert detail["actors"] == []  # o catálogo mock não tem elenco


def test_rating_is_optional_and_validated(client, user_headers):
    mid = media_id_by_title(client, user_headers, "Dark")
    assert client.post("/diary", json={"media_id": mid}, headers=user_headers).status_code == 201
    bad = client.post("/diary", json={"media_id": mid, "rating": 4.3}, headers=user_headers)
    assert bad.status_code == 422
    bad = client.post("/diary", json={"media_id": mid, "rating": 6}, headers=user_headers)
    assert bad.status_code == 422


def test_update_and_delete_entry(client, user_headers):
    mid = media_id_by_title(client, user_headers, "Titanic")
    entry = client.post("/diary", json={"media_id": mid}, headers=user_headers).json()
    r = client.patch(f"/diary/{entry['id']}", json={"rating": 3.0}, headers=user_headers)
    assert r.json()["rating"] == 3.0
    assert client.delete(f"/diary/{entry['id']}", headers=user_headers).status_code == 204
    assert client.get("/diary", headers=user_headers).json() == []


def test_lists_crud(client, user_headers):
    mid = media_id_by_title(client, user_headers, "Interestelar")
    lst = client.post("/lists", json={"name": "Ficção top"}, headers=user_headers).json()
    r = client.post(f"/lists/{lst['id']}/items", json={"media_id": mid}, headers=user_headers)
    assert r.status_code == 201 and r.json()["items"][0]["media"]["id"] == mid

    r = client.patch(f"/lists/{lst['id']}", json={"name": "Favoritos sci-fi"}, headers=user_headers)
    assert r.json()["name"] == "Favoritos sci-fi"

    assert client.delete(f"/lists/{lst['id']}/items/{mid}", headers=user_headers).status_code == 204
    assert client.delete(f"/lists/{lst['id']}", headers=user_headers).status_code == 204


def test_watchlist_cannot_be_deleted(client, user_headers):
    wl = client.get("/lists", headers=user_headers).json()[0]
    assert client.delete(f"/lists/{wl['id']}", headers=user_headers).status_code == 400


def test_cannot_touch_other_users_list(client, user_headers):
    from .conftest import register

    other = register(client, email="outro@teste.com")
    lst = client.post("/lists", json={"name": "Minha"}, headers=other).json()
    assert client.get(f"/lists/{lst['id']}", headers=user_headers).status_code == 404


def test_onboarding_keeps_existing_rating(client, user_headers):
    mid = media_id_by_title(client, user_headers, "Parasita")
    client.post("/diary", json={"media_id": mid, "rating": 1}, headers=user_headers)

    r = client.put("/me/preferences", json={"genres": [], "liked_media_ids": [mid]}, headers=user_headers)
    assert r.status_code == 200
    assert client.get("/diary", headers=user_headers).json()[0]["rating"] == 1


def count_queries(client, path, headers) -> int:
    statements = []

    def record(_conn, _cursor, statement, *_args):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        assert client.get(path, headers=headers).status_code == 200
    finally:
        event.remove(engine, "before_cursor_execute", record)
    return len(statements)


def test_queries_do_not_grow_with_items(client, user_headers):
    ids = [m["id"] for m in client.get("/media", params={"limit": 12}, headers=user_headers).json()["items"]]
    lst = client.post("/lists", json={"name": "Grande"}, headers=user_headers).json()

    def add(media_ids):
        for mid in media_ids:
            client.post("/diary", json={"media_id": mid}, headers=user_headers)
            client.post(f"/lists/{lst['id']}/items", json={"media_id": mid}, headers=user_headers)

    add(ids[:2])
    diary_before = count_queries(client, "/diary", user_headers)
    lists_before = count_queries(client, "/lists", user_headers)
    add(ids[2:])
    assert count_queries(client, "/diary", user_headers) == diary_before
    assert count_queries(client, "/lists", user_headers) == lists_before


def test_search_ignores_accents(client, user_headers):
    for query in ("chefao", "CHEFÃO"):
        items = client.get("/media", params={"q": query}, headers=user_headers).json()["items"]
        assert "O Poderoso Chefão" in [m["title"] for m in items]


def test_facets_follow_chosen_genres(client):
    facets = client.get("/media/facets", params={"genre": ["Terror"], "limit": 5}).json()
    assert len(facets["creators"]) == 5
    assert facets["decades"] == sorted(facets["decades"], reverse=True)

    everything = client.get("/media/facets", params={"limit": 50}).json()
    assert set(facets["decades"]) <= set(everything["decades"])
    assert set(facets["creators"]) <= set(everything["creators"])


def test_trending_is_public_and_respects_filters(client):
    series = client.get("/media/trending", params={"type": "series", "limit": 3}).json()
    assert len(series) == 3
    assert all(m["type"] == "series" for m in series)


def test_search_filters_by_genre_and_sorts(client, user_headers):
    def search(**params):
        return client.get("/media", params={"limit": 100, **params}, headers=user_headers).json()["items"]

    assert all("Terror" in m["genres"] for m in search(genre="Terror"))

    popular = [m["popularity"] for m in search()]
    assert popular == sorted(popular, reverse=True)
    years = [m["year"] for m in search(sort="year")]
    assert years == sorted(years, reverse=True)
    titles = [search_text(m["title"]) for m in search(sort="title")]
    assert titles == sorted(titles)

    # a ordem escolhida vale também para quem digitou um termo
    years = [m["year"] for m in search(q="a", sort="year")]
    assert len(years) > 1 and years == sorted(years, reverse=True)


def test_most_recent_order_leaves_upcoming_titles_last(client, user_headers, db):
    next_year = date.today().year + 1
    db.add(Media(type="movie", title="Ainda Vai Estrear", year=next_year, source="manual"))
    db.commit()
    total = client.get("/media", params={"limit": 1}, headers=user_headers).json()["total"]
    page = {"sort": "year", "limit": 1}
    newest = client.get("/media", params=page, headers=user_headers).json()["items"][0]
    last = client.get("/media", params={**page, "offset": total - 1}, headers=user_headers).json()["items"][0]
    assert newest["year"] <= date.today().year
    assert last["title"] == "Ainda Vai Estrear"


def test_genres_are_public_and_sorted(client):
    genres = client.get("/media/genres").json()
    assert "Terror" in genres
    assert genres == sorted(genres)
