"""Ideias de outros sistemas: continuar assistindo (Netflix), Top 10 da semana (Netflix), trailer (HBO) e mixes de
música (Spotify)."""

import dataclasses
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app import crud
from app.config import settings
from app.models import DiaryEntry, Media, User
from app.services import trailers

from .conftest import register
from .test_bridges import albums  # noqa: F401  (o fixture com as pontes dos filmes)
from .test_episodios import serie
from .test_musica_pela_musica import mpb


def test_continuar_assistindo(client, user_headers, db):
    dark = serie(db)
    assert client.get("/me/watching", headers=user_headers).json() == []
    for e in (1, 2):
        client.put(f"/media/{dark.id}/seasons/1/episodes/{e}", json={"seen": True}, headers=user_headers)
    w = client.get("/me/watching", headers=user_headers).json()
    assert len(w) == 1 and w[0]["media"]["title"] == "Dark"
    assert (w[0]["season"], w[0]["seen"], w[0]["total"], w[0]["next_episode"]) == (1, 2, 3, 3)

    client.put(f"/media/{dark.id}/seasons/1/episodes/3", json={"seen": True}, headers=user_headers)
    assert client.get("/me/watching", headers=user_headers).json()[0]["next_episode"] is None  # temporada acabou
    client.post("/diary", json={"media_id": dark.id, "rating": 5}, headers=user_headers)  # Terminei
    assert client.get("/me/watching", headers=user_headers).json() == []
    assert client.get("/me/watching").status_code == 401


def test_top_10_da_semana(client, user_headers, db):
    ids = {t: db.scalar(select(Media.id).where(Media.title == t)) for t in ("Matrix", "Interestelar", "Dark")}
    ana, bia = register(client, "Ana", "ana@teste.com"), register(client, "Bia", "bia@teste.com")
    for h in (user_headers, ana, bia):
        client.post("/diary", json={"media_id": ids["Matrix"], "rating": 5}, headers=h)
    for h in (ana, bia):
        client.post("/diary", json={"media_id": ids["Interestelar"], "rating": 4}, headers=h)
    client.post("/diary", json={"media_id": ids["Dark"]}, headers=ana)
    # Um registro antigo não conta
    old = db.scalar(select(DiaryEntry).where(DiaryEntry.media_id == ids["Dark"]))
    old.created_at = datetime.now(timezone.utc) - timedelta(days=60)
    db.commit()

    top = client.get("/media/top", headers=user_headers).json()
    assert top["days"] == 30  # poucos títulos na semana: vale o mês
    assert [(i["media"]["title"], i["count"]) for i in top["items"]] == [("Matrix", 3), ("Interestelar", 2)]
    assert top["items"][0]["average"] == 5
    assert client.get("/media/top", params={"type": "series"}, headers=user_headers).json()["items"] == []


def test_trailer_do_tmdb(client, user_headers, db, monkeypatch):
    filme = Media(type="movie", source="tmdb", external_id="movie-27205", title="A Origem (TMDB)", year=2010,
                  overview="", genres=[], tags=[], creators=[], popularity=1)
    db.add(filme)
    db.commit()
    monkeypatch.setattr(trailers, "settings", dataclasses.replace(settings, tmdb_api_key="chave-de-teste"))
    trailers._cache.clear()
    videos = [
        {"site": "YouTube", "key": "teaser", "type": "Teaser", "official": True, "iso_639_1": "pt"},
        {"site": "YouTube", "key": "en", "type": "Trailer", "official": True, "iso_639_1": "en"},
        {"site": "YouTube", "key": "pt", "type": "Trailer", "official": True, "iso_639_1": "pt"},
        {"site": "Vimeo", "key": "x", "type": "Trailer", "official": True, "iso_639_1": "pt"},
    ]
    monkeypatch.setattr(trailers, "_fetch", lambda external_id: videos)
    r = client.get(f"/media/{filme.id}/trailer", headers=user_headers).json()
    assert r["key"] == "pt" and r["embed_url"].startswith("https://www.youtube-nocookie.com/embed/pt")

    mock = db.scalar(select(Media.id).where(Media.title == "Matrix", Media.source == "mock"))
    assert client.get(f"/media/{mock}/trailer", headers=user_headers).status_code == 404  # fora do TMDB
    assert trailers.pick_trailer([{"site": "YouTube", "key": "c", "type": "Clip"}]) is None


def test_mixes_de_musica(client, user_headers, db, albums):  # noqa: F811
    discos = mpb(db)
    user = db.scalar(select(User).where(User.email == "demo@tastory.dev"))
    for key in ("construcao", "clube"):
        crud.upsert_diary(db, user, discos[key].id, rating=5)
    for name in ("Interestelar", "Cidade de Deus", "A Origem"):
        crud.upsert_diary(db, user, db.scalar(select(Media.id).where(Media.title == name, Media.type == "movie")), rating=5)
    db.commit()
    from app.auth import create_token

    headers = {"Authorization": f"Bearer {create_token(user)}"}
    mixes = client.get("/recommendations/mixes", headers=headers).json()
    titles = [m["title"] for m in mixes]
    assert "Trilhas do que você viu" in titles
    trilhas = next(m for m in mixes if m["title"] == "Trilhas do que você viu")
    assert {"Interstellar", "Inception", "Cidade de Deus"} <= {a["title"] for a in trilhas["items"]}
    assert trilhas["subtitle"].startswith("De ")
    every = [a["id"] for m in mixes for a in m["items"]]
    assert len(every) == len(set(every))  # cada disco em um mix só


def test_trilha_nao_entra_no_mix_de_genero(db, albums):  # noqa: F811
    from app.services.bridges import music_mixes

    discos = mpb(db)
    discos["wave"].tags = ["bossa nova", "jazz"]
    trilha = db.scalar(select(Media).where(Media.title == "Interstellar", Media.type == "album"))
    trilha.tags = ["jazz", "film score"]
    user = db.scalar(select(User).where(User.email == "demo@tastory.dev"))
    crud.upsert_diary(db, user, discos["wave"].id, rating=5)
    db.commit()
    for mix in music_mixes(db, user.id):
        if mix["title"].startswith("Mix "):
            assert trilha not in mix["items"]
