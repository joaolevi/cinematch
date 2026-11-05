from .conftest import media_id_by_title


def test_admin_routes_require_admin(client, user_headers):
    assert client.get("/admin/metrics", headers=user_headers).status_code == 403
    assert client.post("/admin/sync", headers=user_headers).status_code == 403


def test_sync_external_catalog_is_idempotent(client, admin_headers):
    before = client.get("/media", headers=admin_headers).json()["total"]
    first = client.post("/admin/sync", headers=admin_headers).json()
    assert first["created"] == first["fetched"] > 0
    second = client.post("/admin/sync", headers=admin_headers).json()
    assert second["created"] == 0
    after = client.get("/media", headers=admin_headers).json()["total"]
    assert after == before + first["created"]


def test_catalog_crud(client, admin_headers):
    r = client.post(
        "/admin/media",
        json={"type": "movie", "title": "Filme da Turma", "year": 2026, "genres": ["Comédia"]},
        headers=admin_headers,
    )
    assert r.status_code == 201
    mid = r.json()["id"]
    r = client.patch(f"/admin/media/{mid}", json={"title": "Filme da Turma 2"}, headers=admin_headers)
    assert r.json()["title"] == "Filme da Turma 2"
    assert client.delete(f"/admin/media/{mid}", headers=admin_headers).status_code == 204
    assert client.get(f"/media/{mid}", headers=admin_headers).status_code == 404


def test_moderation_hides_review(client, admin_headers, user_headers):
    mid = media_id_by_title(client, user_headers, "Matrix")
    entry = client.post(
        "/diary", json={"media_id": mid, "rating": 1, "review": "texto ofensivo"}, headers=user_headers
    ).json()
    reviews = client.get("/admin/reviews", headers=admin_headers).json()
    assert any(r["id"] == entry["id"] for r in reviews)

    r = client.patch(f"/admin/reviews/{entry['id']}", json={"hidden": True}, headers=admin_headers)
    assert r.json()["review_hidden"] is True
    detail = client.get(f"/media/{mid}", headers=user_headers).json()
    assert detail["reviews"] == []


def test_acceptance_rate(client, admin_headers, user_headers):
    items = client.get("/recommendations", params={"limit": 10}, headers=user_headers).json()["items"]
    ids = [i["media"]["id"] for i in items]
    client.post(f"/recommendations/{ids[0]}/feedback", json={"action": "want"}, headers=user_headers)
    client.post(f"/recommendations/{ids[1]}/feedback", json={"action": "seen"}, headers=user_headers)
    client.post(f"/recommendations/{ids[2]}/feedback", json={"action": "dismiss"}, headers=user_headers)

    m = client.get("/admin/metrics", headers=admin_headers).json()
    assert m["overall"]["shown"] == 10
    assert m["overall"]["acceptance_rate"] == 0.2  # (1 want + 1 seen) / 10 exibidas
