from sqlalchemy import select

from app.config import Settings
from app.models import ItemNeighbor, Media, RecEvent
from app.seed import create_synthetic_users
from app.services import recommender

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


def external_neighbors_on(monkeypatch):
    monkeypatch.setattr(recommender, "settings", Settings(use_external_neighbors=True))


def group_a_user(client):
    for i in range(3):
        headers = register(client, email=f"vizinho{i}@teste.com")
        if client.get("/me", headers=headers).json()["ab_group"] == "A":
            return headers
    raise AssertionError("nenhum usuário caiu no grupo A")


def add_neighbor(db, media_id, neighbor_id, score=0.9):
    db.add(ItemNeighbor(media_id=media_id, neighbor_id=neighbor_id, source="movielens", score=score))
    db.commit()


def test_external_neighbors_guide_feed_when_enabled(client, db, monkeypatch):
    external_neighbors_on(monkeypatch)
    headers = group_a_user(client)
    liked = media_id_by_title(client, headers, "Toy Story")
    neighbor = media_id_by_title(client, headers, "Titanic")
    add_neighbor(db, liked, neighbor)
    client.post("/diary", json={"media_id": liked, "rating": 5}, headers=headers)

    feed = client.get("/recommendations", params={"limit": 5}, headers=headers).json()
    assert feed["strategy"] == "hybrid"
    first = feed["items"][0]
    assert first["media"]["id"] == neighbor
    assert first["reason"] == "Quem curtiu Toy Story também curtiu"


def test_external_neighbors_are_ignored_when_disabled(client, db):
    headers = group_a_user(client)
    liked = media_id_by_title(client, headers, "Toy Story")
    neighbor = media_id_by_title(client, headers, "Titanic")
    add_neighbor(db, liked, neighbor)
    client.post("/diary", json={"media_id": liked, "rating": 5}, headers=headers)

    feed = client.get("/recommendations", params={"limit": 5}, headers=headers).json()
    assert neighbor not in [i["media"]["id"] for i in feed["items"]]


def test_series_stay_in_feed_with_external_neighbors(client, db, monkeypatch):
    external_neighbors_on(monkeypatch)
    headers = group_a_user(client)
    liked = media_id_by_title(client, headers, "Toy Story")
    add_neighbor(db, liked, media_id_by_title(client, headers, "Titanic"))
    client.post("/diary", json={"media_id": liked, "rating": 5}, headers=headers)

    feed = client.get("/recommendations", params={"type": "series", "limit": 5}, headers=headers).json()
    assert feed["items"] and all(i["media"]["type"] == "series" for i in feed["items"])


def test_undo_dismiss_brings_title_back(client, admin_headers, user_headers):
    items = client.get("/recommendations", params={"limit": 5}, headers=user_headers).json()["items"]
    mid = items[0]["media"]["id"]
    client.post(f"/recommendations/{mid}/feedback", json={"action": "dismiss"}, headers=user_headers)
    assert client.get(f"/media/{mid}", headers=user_headers).json()["my_status"]["dismissed"] is True

    assert client.delete(f"/recommendations/{mid}/feedback", headers=user_headers).status_code == 204

    assert client.get(f"/media/{mid}", headers=user_headers).json()["my_status"]["dismissed"] is False
    feed = client.get("/recommendations", params={"limit": 5}, headers=user_headers).json()
    assert mid in [i["media"]["id"] for i in feed["items"]]
    assert client.get("/admin/metrics", headers=admin_headers).json()["overall"]["dismiss"] == 0


def test_feed_brings_next_titles_without_repeating(client, user_headers, db):
    def feed(exclude):
        r = client.get("/recommendations", params={"limit": 5, "exclude": exclude}, headers=user_headers)
        return [i["media"]["id"] for i in r.json()["items"]]

    # sem histórico (em alta)
    first = feed([])
    second = feed(first)
    assert len(second) == 5 and not set(first) & set(second)

    # com histórico (personalizado)
    client.post(f"/recommendations/{first[0]}/feedback", json={"action": "seen", "rating": 5}, headers=user_headers)
    first = feed([])
    second = feed(first)
    assert len(second) == 5 and not set(first) & set(second)
    assert first[0] not in second

    # o que foi carregado depois também conta como exibido
    shown = db.scalars(select(RecEvent.media_id).where(RecEvent.action == "shown")).all()
    assert set(first + second) <= set(shown)


def test_feed_ends_when_nothing_is_left(client, user_headers, db):
    every_title = list(db.scalars(select(Media.id)))
    r = client.get("/recommendations", params={"exclude": every_title}, headers=user_headers)
    assert r.status_code == 200 and r.json()["items"] == []


def test_seen_feedback_keeps_chosen_date(client, user_headers):
    mid = client.get("/recommendations", params={"limit": 1}, headers=user_headers).json()["items"][0]["media"]["id"]
    client.post(
        f"/recommendations/{mid}/feedback",
        json={"action": "seen", "rating": 4, "consumed_at": "2026-01-15"},
        headers=user_headers,
    )
    assert client.get("/diary", headers=user_headers).json()[0]["consumed_at"] == "2026-01-15"
    assert client.get(f"/media/{mid}", headers=user_headers).json()["my_status"]["consumed_at"] == "2026-01-15"


def test_seen_feedback_without_date_stays_without_date(client, user_headers):
    mid = client.get("/recommendations", params={"limit": 1}, headers=user_headers).json()["items"][0]["media"]["id"]
    client.post(f"/recommendations/{mid}/feedback", json={"action": "seen", "rating": 4}, headers=user_headers)
    assert client.get("/diary", headers=user_headers).json()[0]["consumed_at"] is None


def test_preferences_without_history_do_not_use_collaborative(client, monkeypatch):
    external_neighbors_on(monkeypatch)
    headers = group_a_user(client)
    client.put("/me/preferences", json={"genres": ["Terror"]}, headers=headers)

    feed = client.get("/recommendations", params={"limit": 10}, headers=headers).json()
    assert feed["strategy"] == "content"
    assert any(i["media"]["type"] == "movie" for i in feed["items"])


def test_reasons_do_not_repeat_the_same_title(client, db, monkeypatch):
    external_neighbors_on(monkeypatch)
    headers = group_a_user(client)
    first = media_id_by_title(client, headers, "Toy Story")
    second = media_id_by_title(client, headers, "Matrix")
    neighbors = [media_id_by_title(client, headers, t) for t in ("Titanic", "Parasita", "Interestelar", "Corra!")]
    for neighbor in neighbors:
        add_neighbor(db, first, neighbor, score=0.9)
        add_neighbor(db, second, neighbor, score=0.8)
    for mid in (first, second):
        client.post("/diary", json={"media_id": mid, "rating": 5}, headers=headers)

    feed = client.get("/recommendations", params={"limit": 4}, headers=headers).json()
    reasons = {i["reason"] for i in feed["items"]}
    assert "Quem curtiu Toy Story também curtiu" in reasons
    assert "Quem curtiu Matrix também curtiu" in reasons
