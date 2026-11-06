from app.models import RecEvent
from app.seed import create_synthetic_users

from .conftest import media_id_by_title, register


def test_cold_start_returns_trending(client, user_headers):
    feed = client.get("/recommendations", headers=user_headers).json()
    assert feed["strategy"] == "trending"
    assert len(feed["items"]) == 20  # usuário novo nunca vê a tela vazia
    assert all(i["reason"] == "Em alta no Tastory" for i in feed["items"])


def test_preferences_personalize_feed(client, user_headers):
    liked = [media_id_by_title(client, user_headers, t) for t in ("O Iluminado", "Hereditário", "Corra!")]
    r = client.put(
        "/me/preferences", json={"genres": ["Terror"], "liked_media_ids": liked}, headers=user_headers
    )
    assert r.status_code == 200 and r.json()["onboarded"] is True

    feed = client.get("/recommendations", params={"limit": 10}, headers=user_headers).json()
    assert feed["strategy"] in {"content", "hybrid"}
    ids = {i["media"]["id"] for i in feed["items"]}
    assert not ids & set(liked)  # já registrados não voltam
    top5_genres = [g for i in feed["items"][:5] for g in i["media"]["genres"]]
    assert "Terror" in top5_genres
    assert all(i["reason"] for i in feed["items"])


def test_type_filter(client, user_headers):
    feed = client.get("/recommendations", params={"type": "series"}, headers=user_headers).json()
    assert feed["items"] and all(i["media"]["type"] == "series" for i in feed["items"])


def test_feedback_actions_remove_from_feed(client, user_headers):
    items = client.get("/recommendations", headers=user_headers).json()["items"]
    want, seen, dismiss = (i["media"]["id"] for i in items[:3])

    assert client.post(f"/recommendations/{want}/feedback", json={"action": "want"}, headers=user_headers).status_code == 201
    assert client.post(f"/recommendations/{seen}/feedback", json={"action": "seen", "rating": 5}, headers=user_headers).status_code == 201
    assert client.post(f"/recommendations/{dismiss}/feedback", json={"action": "dismiss"}, headers=user_headers).status_code == 201

    watchlist = client.get("/lists", headers=user_headers).json()[0]
    assert [it["media"]["id"] for it in watchlist["items"]] == [want]
    diary = client.get("/diary", headers=user_headers).json()
    assert diary[0]["media"]["id"] == seen and diary[0]["rating"] == 5

    new_ids = {i["media"]["id"] for i in client.get("/recommendations", headers=user_headers).json()["items"]}
    assert not new_ids & {want, seen, dismiss}


def test_shown_events_are_unique_per_title(client, db, user_headers):
    client.get("/recommendations", headers=user_headers)
    client.get("/recommendations", headers=user_headers)
    shown = db.query(RecEvent).filter(RecEvent.action == "shown").count()
    assert shown == 20


def test_hybrid_strategy_with_collaborative_data(client, db):
    create_synthetic_users(db, per_persona=3)
    headers = register(client, email="grupo-a@teste.com")
    me = client.get("/me", headers=headers).json()
    if me["ab_group"] != "A":  # garante um usuário do grupo A (híbrido)
        headers = register(client, email="grupo-a2@teste.com")
    mid = media_id_by_title(client, headers, "Toy Story")
    client.post("/diary", json={"media_id": mid, "rating": 5}, headers=headers)
    feed = client.get("/recommendations", headers=headers).json()
    assert feed["variant"] == "A"
    assert feed["strategy"] == "hybrid"


def test_group_b_uses_content_only(client, db):
    create_synthetic_users(db, per_persona=3)
    headers = None
    for i in range(3):
        h = register(client, email=f"b{i}@teste.com")
        if client.get("/me", headers=h).json()["ab_group"] == "B":
            headers = h
            break
    assert headers is not None
    mid = media_id_by_title(client, headers, "Toy Story")
    client.post("/diary", json={"media_id": mid, "rating": 5}, headers=headers)
    feed = client.get("/recommendations", headers=headers).json()
    assert feed["variant"] == "B" and feed["strategy"] == "content"


def test_preferred_creator_guides_feed_and_reason(client, user_headers):
    r = client.put("/me/preferences", json={"creators": ["Christopher Nolan"]}, headers=user_headers)
    assert r.status_code == 200 and r.json()["creators"] == ["Christopher Nolan"]

    feed = client.get("/recommendations", params={"limit": 5}, headers=user_headers).json()
    assert feed["strategy"] in {"content", "hybrid"}
    first = feed["items"][0]
    assert "Christopher Nolan" in first["media"]["creators"]
    assert first["reason"] == "Porque você curte Christopher Nolan"


def test_preferred_decade_guides_feed(client, user_headers):
    r = client.put("/me/preferences", json={"decades": [1990]}, headers=user_headers)
    assert r.json()["decades"] == [1990]

    feed = client.get("/recommendations", params={"limit": 5}, headers=user_headers).json()
    assert feed["strategy"] in {"content", "hybrid"}
    assert any(1990 <= i["media"]["year"] < 2000 for i in feed["items"])
    assert any(i["reason"] == "Porque você curte os anos 90" for i in feed["items"])


def test_redoing_preferences_replaces_interests(client, user_headers):
    client.put("/me/preferences", json={"decades": [1990], "creators": ["David Fincher"]}, headers=user_headers)
    r = client.put("/me/preferences", json={"decades": [2010]}, headers=user_headers)
    assert r.json()["decades"] == [2010] and r.json()["creators"] == []
