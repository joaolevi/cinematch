"""Séries por temporada e com o estado "assistindo" (RFF24)."""

from sqlalchemy import select

from app.models import Media
from app.services.tmdb import seasons_of


def serie(db, title="Dark"):
    m = db.scalar(select(Media).where(Media.title == title))
    m.seasons = [{"number": n, "name": f"Temporada {n}", "episodes": 10, "year": 2016 + n} for n in (1, 2, 3)]
    db.commit()
    return m


def test_temporadas_do_tmdb_sem_os_especiais():
    details = {"seasons": [{"season_number": 0, "name": "Especiais", "episode_count": 3},
                           {"season_number": 1, "name": "Temporada 1", "episode_count": 10, "air_date": "2017-12-01"}]}
    assert seasons_of(details) == [{"number": 1, "name": "Temporada 1", "episodes": 10, "year": 2017}]
    assert seasons_of({}) == []


def test_assistindo_uma_temporada_e_depois_terminar(client, user_headers, db):
    dark = serie(db)
    detalhe = client.get(f"/media/{dark.id}", headers=user_headers).json()
    assert [t["number"] for t in detalhe["seasons"]] == [1, 2, 3] and detalhe["my_status"]["status"] is None

    r = client.post("/diary", json={"media_id": dark.id, "status": "watching", "season": 2}, headers=user_headers)
    assert r.status_code == 201 and (r.json()["status"], r.json()["season"]) == ("watching", 2)
    status = client.get(f"/media/{dark.id}", headers=user_headers).json()["my_status"]
    assert (status["status"], status["season"]) == ("watching", 2)

    entry = r.json()["id"]
    assert client.patch(f"/diary/{entry}", json={"season": 3}, headers=user_headers).json()["season"] == 3
    fim = client.post("/diary", json={"media_id": dark.id, "rating": 5}, headers=user_headers).json()
    assert fim["id"] == entry and fim["status"] == "seen" and fim["season"] == 3 and fim["rating"] == 5

    comunidade = client.get("/community", params={"limit": 5}, headers=user_headers).json()["items"]
    assert comunidade[0]["status"] == "seen" and comunidade[0]["season"] == 3


def test_temporada_e_assistindo_so_em_serie_que_existe(client, user_headers, db):
    dark = serie(db)
    filme = db.scalar(select(Media.id).where(Media.title == "Matrix"))
    assert client.post("/diary", json={"media_id": filme, "status": "watching"}, headers=user_headers).status_code == 422
    assert client.post("/diary", json={"media_id": dark.id, "status": "watching", "season": 7},
                       headers=user_headers).status_code == 422
    assert client.post("/diary", json={"media_id": dark.id, "season": 0}, headers=user_headers).status_code == 422
    sem_temporadas = db.scalar(select(Media).where(Media.title == "Breaking Bad"))
    sem_temporadas.seasons = []
    db.commit()
    r = client.post("/diary", json={"media_id": sem_temporadas.id, "status": "watching", "season": 4}, headers=user_headers)
    assert r.status_code == 201  # sem a lista de temporadas, aceita o número que a pessoa disser
    entry = client.post("/diary", json={"media_id": filme}, headers=user_headers).json()["id"]
    assert client.patch(f"/diary/{entry}", json={"status": "watching"}, headers=user_headers).status_code == 422


def test_assistindo_sai_do_quero_ver_e_do_feed(client, user_headers, db):
    dark = serie(db)
    client.post(f"/recommendations/{dark.id}/feedback", json={"action": "want"}, headers=user_headers)
    client.post("/diary", json={"media_id": dark.id, "status": "watching", "season": 1}, headers=user_headers)
    detalhe = client.get(f"/media/{dark.id}", headers=user_headers).json()
    assert not detalhe["my_status"]["in_watchlist"]
    feed = client.get("/recommendations", params={"type": "series", "limit": 50}, headers=user_headers).json()
    assert dark.id not in {i["media"]["id"] for i in feed["items"]}
