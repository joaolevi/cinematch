"""Ideias do Letterboxd: distribuição das notas e quem eu sigo na página do título, abas das resenhas (seguindo),
aviso de spoiler e os cinco favoritos do perfil."""

from sqlalchemy import select

from app.models import Media

from .conftest import register


def mid(db, title):
    return db.scalar(select(Media.id).where(Media.title == title))


def me(client, headers):
    return client.get("/me", headers=headers).json()["id"]


def test_distribuicao_das_notas_e_quem_eu_sigo(client, user_headers, db):
    matrix = mid(db, "Matrix")
    ana, bia = register(client, "Ana", "ana@teste.com"), register(client, "Bia", "bia@teste.com")
    client.post("/diary", json={"media_id": matrix, "rating": 5}, headers=ana)
    client.post("/diary", json={"media_id": matrix, "rating": 3.5}, headers=bia)
    client.put(f"/users/{me(client, ana)}/follow", headers=user_headers)

    detalhe = client.get(f"/media/{matrix}", headers=user_headers).json()
    assert detalhe["histogram"][9] == 1 and detalhe["histogram"][6] == 1 and sum(detalhe["histogram"]) == 2
    assert [(f["name"], f["rating"]) for f in detalhe["friends"]] == [("Ana", 5)]  # só quem eu sigo

    client.put("/me/visibility", json={"visibility": "private"}, headers=ana)
    assert client.get(f"/media/{matrix}", headers=user_headers).json()["friends"] == []  # quem não mostra sai


def test_resenha_com_spoiler_e_de_quem_eu_sigo(client, user_headers, db):
    matrix = mid(db, "Matrix")
    ana = register(client, "Ana", "ana@teste.com")
    r = client.post("/diary", json={"media_id": matrix, "rating": 5, "review": "Ele é o escolhido", "spoiler": True},
                    headers=ana)
    assert r.json()["spoiler"] is True
    client.put(f"/users/{me(client, ana)}/follow", headers=user_headers)
    resenha = client.get(f"/media/{matrix}", headers=user_headers).json()["reviews"][0]
    assert resenha["spoiler"] is True and resenha["following"] is True
    assert client.get("/community", headers=user_headers).json()["items"][0]["spoiler"] is True
    assert client.patch(f"/diary/{r.json()['id']}", json={"spoiler": False}, headers=ana).json()["spoiler"] is False


def test_cinco_favoritos_do_perfil(client, user_headers, db):
    ids = [mid(db, t) for t in ("Matrix", "Interestelar", "Dark", "A Origem", "Duna", "Cidade de Deus", "Breaking Bad")]
    for i in ids:
        client.post("/diary", json={"media_id": i, "rating": 5}, headers=user_headers)
    eu = me(client, user_headers)
    r = client.put("/me/favorites", json={"media_ids": [ids[2], ids[0], ids[2]]}, headers=user_headers)
    assert [m["title"] for m in r.json()] == ["Dark", "Matrix"]  # na ordem escolhida, sem repetir
    assert [m["title"] for m in client.get(f"/users/{eu}", headers=user_headers).json()["pinned"]] == ["Dark", "Matrix"]

    r = client.put("/me/favorites", json={"media_ids": ids[:5]}, headers=user_headers)
    assert r.status_code == 200 and len(r.json()) == 5  # cinco cabem
    assert client.put("/me/favorites", json={"media_ids": ids[:6]}, headers=user_headers).status_code == 422  # no máximo 5
    client.put("/me/favorites", json={"media_ids": [ids[2], ids[0]]}, headers=user_headers)
    fora = mid(db, "Toy Story")
    assert client.put("/me/favorites", json={"media_ids": [fora]}, headers=user_headers).status_code == 422  # fora do diário

    entrada = client.get("/diary", headers=user_headers).json()
    dark = next(e["id"] for e in entrada if e["media"]["title"] == "Dark")
    client.delete(f"/diary/{dark}", headers=user_headers)
    assert [m["title"] for m in client.get(f"/users/{eu}", headers=user_headers).json()["pinned"]] == ["Matrix"]
    assert client.put("/me/favorites", json={"media_ids": []}).status_code == 401
