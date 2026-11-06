from sqlalchemy import event

from app.db import engine

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
