from sqlalchemy import select

from app.models import DiaryEntry, User

from .conftest import media_id_by_title, register
from .test_diary_lists import count_queries


def community(client, headers, **params):
    return client.get("/community", params=params, headers=headers).json()


def see(client, headers, title, **body):
    mid = media_id_by_title(client, headers, title)
    return client.post("/diary", json={"media_id": mid, **body}, headers=headers).json()


def test_community_requires_login(client):
    assert client.get("/community").status_code == 401


def test_community_shows_everyone_newest_first(client, user_headers):
    other = register(client, name="Outra Pessoa", email="outra@teste.com")
    see(client, user_headers, "Matrix", rating=4, review="Muito bom")
    see(client, other, "Dark", rating=2)

    page = community(client, user_headers)
    assert page["total"] == 2
    assert [i["media"]["title"] for i in page["items"]] == ["Dark", "Matrix"]
    first, second = page["items"]
    assert first["user_name"] == "Outra Pessoa" and first["rating"] == 2 and first["review"] is None
    assert second["user_name"] == "Fulano" and second["review"] == "Muito bom"
    assert second["created_at"]


def test_community_never_exposes_the_email(client, user_headers):
    see(client, user_headers, "Matrix")
    assert "@" not in client.get("/community", headers=user_headers).text


def test_community_leaves_out_onboarding_and_special_accounts(client, db, user_headers, admin_headers):
    mid = media_id_by_title(client, user_headers, "Matrix")
    client.put(
        "/me/preferences",
        json={"genres": [], "decades": [], "creators": [], "liked_media_ids": [mid]},
        headers=user_headers,
    )
    see(client, admin_headers, "Dark")

    demo = client.post("/auth/login", json={"email": "demo@tastory.dev", "password": "demo123"}).json()
    see(client, {"Authorization": f"Bearer {demo['access_token']}"}, "Parasita")

    synthetic = User(name="Simulada", email="sint@teste.com", password_hash="x", is_synthetic=True)
    db.add(synthetic)
    db.flush()
    db.add(DiaryEntry(user_id=synthetic.id, media_id=mid, rating=5))
    db.commit()

    assert community(client, user_headers) == {"items": [], "total": 0}


def test_community_only_shows_seen_titles(client, user_headers):
    want = media_id_by_title(client, user_headers, "Matrix")
    dismiss = media_id_by_title(client, user_headers, "Dark")
    in_list = media_id_by_title(client, user_headers, "Parasita")
    client.post(f"/recommendations/{want}/feedback", json={"action": "want"}, headers=user_headers)
    client.post(f"/recommendations/{dismiss}/feedback", json={"action": "dismiss"}, headers=user_headers)
    lst = client.post("/lists", json={"name": "Minha"}, headers=user_headers).json()
    client.post(f"/lists/{lst['id']}/items", json={"media_id": in_list}, headers=user_headers)
    assert community(client, user_headers)["items"] == []

    client.post(f"/recommendations/{want}/feedback", json={"action": "seen"}, headers=user_headers)
    assert [i["media"]["id"] for i in community(client, user_headers)["items"]] == [want]


def test_community_hides_moderated_review_but_keeps_the_entry(client, user_headers, admin_headers):
    entry = see(client, user_headers, "Matrix", rating=3, review="texto ofensivo")
    client.patch(f"/admin/reviews/{entry['id']}", json={"hidden": True}, headers=admin_headers)

    item = community(client, user_headers)["items"][0]
    assert item["media"]["title"] == "Matrix" and item["review"] is None
    assert "texto ofensivo" not in client.get("/community", headers=user_headers).text


def test_editing_keeps_position_and_removing_leaves_the_community(client, user_headers):
    first = see(client, user_headers, "Matrix", rating=3)
    see(client, user_headers, "Dark", rating=3)

    client.patch(f"/diary/{first['id']}", json={"rating": 5}, headers=user_headers)
    items = community(client, user_headers)["items"]
    assert [i["media"]["title"] for i in items] == ["Dark", "Matrix"]
    assert items[1]["rating"] == 5

    client.delete(f"/diary/{first['id']}", headers=user_headers)
    assert [i["media"]["title"] for i in community(client, user_headers)["items"]] == ["Dark"]


def test_community_pages_do_not_repeat_entries(client, db, user_headers):
    for title in ("Matrix", "Dark", "Parasita"):
        see(client, user_headers, title)
    first = community(client, user_headers, limit=2)
    second = community(client, user_headers, limit=2, offset=2)
    assert first["total"] == 3 and len(first["items"]) == 2 and len(second["items"]) == 1
    assert not {i["id"] for i in first["items"]} & {i["id"] for i in second["items"]}


def test_community_queries_do_not_grow_with_items(client, db, user_headers):
    see(client, user_headers, "Matrix")
    few = count_queries(client, "/community", user_headers)
    ids = db.scalars(select(DiaryEntry.media_id)).all()
    others = [m["id"] for m in client.get("/media", params={"limit": 15}, headers=user_headers).json()["items"] if m["id"] not in ids]
    for mid in others:
        client.post("/diary", json={"media_id": mid}, headers=user_headers)
    assert count_queries(client, "/community", user_headers) == few


def test_community_shows_when_the_person_watched(client, user_headers):
    see(client, user_headers, "Matrix", consumed_at="2026-10-20")
    see(client, user_headers, "Dark")
    items = community(client, user_headers)["items"]
    assert [i["consumed_at"] for i in items] == [None, "2026-10-20"]


def test_reviewers_are_ranked_by_reviews_and_skip_moderated_ones(client, user_headers, admin_headers):
    other = register(client, name="Outra Pessoa", email="outra@teste.com")
    see(client, other, "Matrix", review="Boa")
    see(client, other, "Dark", review="Ótima")
    see(client, user_headers, "Matrix", review="Legal")
    see(client, user_headers, "Parasita")
    moderated = see(client, user_headers, "Dark", review="texto ofensivo")
    client.patch(f"/admin/reviews/{moderated['id']}", json={"hidden": True}, headers=admin_headers)
    see(client, admin_headers, "Dark", review="Do admin")

    ranking = client.get("/community/reviewers", headers=user_headers).json()
    assert ranking == [
        {"name": "Outra Pessoa", "titles": 2, "reviews": 2},
        {"name": "Fulano", "titles": 3, "reviews": 1},
    ]
    assert client.get("/community/reviewers").status_code == 401
