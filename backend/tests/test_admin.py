from sqlalchemy import select

from app.models import ItemNeighbor, Media, RecEvent, User

from .conftest import media_id_by_title


def test_admin_routes_require_admin(client, user_headers):
    assert client.get("/admin/metrics", headers=user_headers).status_code == 403
    assert client.post("/admin/sync", headers=user_headers).status_code == 403


def test_sync_external_catalog_is_idempotent(client, admin_headers):
    before = client.get("/media", headers=admin_headers).json()["total"]
    first = client.post("/admin/sync", params={"provider": "mock"}, headers=admin_headers).json()
    assert first["created"] == first["fetched"] > 0
    second = client.post("/admin/sync", params={"provider": "mock"}, headers=admin_headers).json()
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


def test_acceptance_counts_each_title_once(client, admin_headers, user_headers):
    items = client.get("/recommendations", params={"limit": 10}, headers=user_headers).json()["items"]
    mid = items[0]["media"]["id"]
    for _ in range(3):
        client.post(f"/recommendations/{mid}/feedback", json={"action": "want"}, headers=user_headers)
    client.post(f"/recommendations/{mid}/feedback", json={"action": "seen"}, headers=user_headers)

    overall = client.get("/admin/metrics", headers=admin_headers).json()["overall"]
    assert overall["shown"] == 10
    assert overall["acceptance_rate"] == 0.1


def test_acceptance_ignores_titles_not_shown(client, admin_headers, user_headers):
    shown = client.get("/recommendations", params={"limit": 1}, headers=user_headers).json()["items"]
    shown_id = shown[0]["media"]["id"]
    catalog = client.get("/media", params={"limit": 5}, headers=user_headers).json()["items"]
    other = next(m["id"] for m in catalog if m["id"] != shown_id)
    client.post(f"/recommendations/{other}/feedback", json={"action": "want"}, headers=user_headers)

    overall = client.get("/admin/metrics", headers=admin_headers).json()["overall"]
    assert overall["want"] == 0
    assert overall["acceptance_rate"] == 0.0


def test_edit_keeps_moderated_review_hidden(client, admin_headers, user_headers):
    mid = media_id_by_title(client, user_headers, "Matrix")
    entry = client.post(
        "/diary", json={"media_id": mid, "review": "texto ofensivo"}, headers=user_headers
    ).json()
    client.patch(f"/admin/reviews/{entry['id']}", json={"hidden": True}, headers=admin_headers)

    r = client.patch(f"/diary/{entry['id']}", json={"review": "ofensivo de novo"}, headers=user_headers)
    assert r.json()["review_hidden"] is True
    assert client.get(f"/media/{mid}", headers=user_headers).json()["reviews"] == []

    client.patch(f"/admin/reviews/{entry['id']}", json={"hidden": False}, headers=admin_headers)
    reviews = client.get(f"/media/{mid}", headers=user_headers).json()["reviews"]
    assert reviews[0]["review"] == "ofensivo de novo"


def test_poster_url_above_limit_is_rejected(client, admin_headers):
    payload = {"type": "movie", "title": "Filme", "poster_url": "http://a/" + "x" * 500}
    assert client.post("/admin/media", json=payload, headers=admin_headers).status_code == 422


def test_metrics_explain_where_the_numbers_come_from(client, db, admin_headers, user_headers):
    client.get("/recommendations", params={"limit": 3}, headers=user_headers)
    synthetic = User(name="Sintético", email="sint@teste.com", password_hash="x", is_synthetic=True)
    movie = db.scalar(select(Media).where(Media.type == "movie"))
    db.add(synthetic)
    db.flush()
    db.add(RecEvent(user_id=synthetic.id, media_id=movie.id, action="shown", variant="A"))
    db.add(ItemNeighbor(media_id=movie.id, neighbor_id=movie.id, source="movielens", score=0.5))
    db.commit()

    m = client.get("/admin/metrics", headers=admin_headers).json()
    assert m["simulated_shown"] == 1
    assert m["overall"]["shown"] == 4
    assert m["movies"] + m["series"] == m["catalog_size"]
    assert m["external_neighbors_enabled"] is False
    assert m["titles_with_neighbors"] == 1
    assert m["real_users"] == 2  # conta demo + usuário do teste
