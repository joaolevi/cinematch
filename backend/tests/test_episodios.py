"""Nota e anotação por episódio (RFF24) e curtir e comentar resenhas na página do título (RFF30)."""

from sqlalchemy import select

from app.models import Media

from .conftest import register


def serie(db, title="Dark"):
    m = db.scalar(select(Media).where(Media.title == title))
    m.seasons = [{"number": 1, "name": "Temporada 1", "episodes": 3, "year": 2017},
                 {"number": 2, "name": "Temporada 2", "episodes": 2, "year": 2019}]
    db.commit()
    return m


def test_episodios_da_temporada_com_nota_e_anotacao(client, user_headers, db):
    dark = serie(db)
    lista = client.get(f"/media/{dark.id}/seasons/1/episodes", headers=user_headers).json()
    assert [e["number"] for e in lista] == [1, 2, 3] and all(e["rating"] is None for e in lista)

    r = client.put(f"/media/{dark.id}/seasons/1/episodes/2", json={"rating": 4.5, "note": " Que reviravolta "},
                   headers=user_headers)
    assert r.status_code == 200 and r.json() == {"number": 2, "seen": True, "rating": 4.5, "note": "Que reviravolta"}
    ep2 = client.get(f"/media/{dark.id}/seasons/1/episodes", headers=user_headers).json()[1]
    assert (ep2["rating"], ep2["note"]) == (4.5, "Que reviravolta")

    status = client.get(f"/media/{dark.id}", headers=user_headers).json()["my_status"]
    assert status["episodes"] == {"1": 1}
    assert (status["status"], status["season"]) == ("watching", 1)  # o primeiro episódio põe a série no diário

    client.put(f"/media/{dark.id}/seasons/2/episodes/1", json={"rating": 5}, headers=user_headers)
    status = client.get(f"/media/{dark.id}", headers=user_headers).json()["my_status"]
    assert status["season"] == 2 and status["episodes"] == {"1": 1, "2": 1}

    client.put(f"/media/{dark.id}/seasons/1/episodes/2", json={}, headers=user_headers)  # sem nada: volta a não visto
    assert client.get(f"/media/{dark.id}", headers=user_headers).json()["my_status"]["episodes"] == {"2": 1}


def test_anotacao_do_episodio_e_so_da_pessoa(client, user_headers, db):
    dark = serie(db)
    client.put(f"/media/{dark.id}/seasons/1/episodes/1", json={"note": "Só minha"}, headers=user_headers)
    outra = register(client, "Ana", "ana@teste.com")
    ep1 = client.get(f"/media/{dark.id}/seasons/1/episodes", headers=outra).json()[0]
    assert ep1["note"] is None and ep1["rating"] is None


def test_episodio_valida_serie_temporada_e_nota(client, user_headers, db):
    dark = serie(db)
    filme = db.scalar(select(Media.id).where(Media.title == "Matrix"))
    assert client.get(f"/media/{filme}/seasons/1/episodes", headers=user_headers).status_code == 404
    assert client.get(f"/media/{dark.id}/seasons/9/episodes", headers=user_headers).status_code == 404
    assert client.put(f"/media/{dark.id}/seasons/1/episodes/1", json={"rating": 0.3}, headers=user_headers).status_code == 422
    assert client.put(f"/media/{dark.id}/seasons/1/episodes/1", json={"note": "x" * 1001},
                      headers=user_headers).status_code == 422
    assert client.get(f"/media/{dark.id}/seasons/1/episodes").status_code == 401


def test_temporada_ja_vista_continua_vista(client, user_headers, db):
    dark = serie(db)
    client.post("/diary", json={"media_id": dark.id, "rating": 5}, headers=user_headers)
    client.put(f"/media/{dark.id}/seasons/2/episodes/1", json={"rating": 4}, headers=user_headers)
    status = client.get(f"/media/{dark.id}", headers=user_headers).json()["my_status"]
    assert status["status"] == "seen" and status["rating"] == 5  # nota de episódio não mexe no registro da série


def test_resenha_na_pagina_do_titulo_tem_curtidas_e_comentarios(client, user_headers, db):
    ana = register(client, "Ana", "ana@teste.com")
    matrix = db.scalar(select(Media.id).where(Media.title == "Matrix"))
    entry = client.post("/diary", json={"media_id": matrix, "rating": 5, "review": "Clássico"}, headers=ana).json()["id"]
    client.put(f"/community/{entry}/like", headers=user_headers)
    client.post(f"/community/{entry}/comments", json={"text": "Concordo"}, headers=user_headers)
    resenha = client.get(f"/media/{matrix}", headers=user_headers).json()["reviews"][0]
    assert (resenha["likes"], resenha["liked"], resenha["comments"]) == (1, True, 1)
    assert resenha["user_id"] == client.get("/me", headers=ana).json()["id"]
    assert client.get(f"/media/{matrix}", headers=ana).json()["reviews"][0]["liked"] is False
