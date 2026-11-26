"""A tela Pessoas (como os membros do Letterboxd) e as resenhas de uma pessoa no perfil."""

from sqlalchemy import select

from app.models import Media, User

from .conftest import register


def mid(db, title):
    return db.scalar(select(Media.id).where(Media.title == title))


def uid(db, name):
    return db.scalar(select(User.id).where(User.name == name))


def test_pessoas_mais_ativas(client, user_headers, db):
    ana, bia = register(client, "Ana", "ana@teste.com"), register(client, "Bia", "bia@teste.com")
    register(client, "Caio Fechado", "caio@teste.com")
    for t in ("Matrix", "Interestelar", "Dark"):
        client.post("/diary", json={"media_id": mid(db, t), "rating": 5, "review": f"Gostei de {t}"}, headers=ana)
    client.post("/diary", json={"media_id": mid(db, "Matrix"), "rating": 4}, headers=bia)
    db.query(User).filter(User.name == "Caio Fechado").update({"visibility": "followers"})
    db.commit()
    entrada = client.get("/community", headers=bia).json()["items"][0]["id"]
    client.put(f"/community/{entrada}/like", headers=bia)

    pessoas = client.get("/users/popular", headers=user_headers).json()
    nomes = [p["name"] for p in pessoas]
    assert nomes[:2] == ["Ana", "Bia"]  # quem mais registrou na semana vem antes
    ana_out = pessoas[0]
    assert (ana_out["titles"], ana_out["active"], ana_out["reviews"]) == (3, 3, 3)
    assert len(ana_out["recent"]) == 3 and ana_out["following"] is False
    caio = next(p for p in pessoas if p["name"] == "Caio Fechado")
    assert caio["titles"] is None and caio["recent"] == []  # diário só para quem segue: sem números
    assert "Visitante" not in nomes  # a conta de demonstração fica de fora
    assert client.get("/users/popular", params={"period": "ano"}, headers=user_headers).status_code == 422


def test_resenhas_da_pessoa(client, user_headers, db):
    ana, bia = register(client, "Ana", "ana@teste.com"), register(client, "Bia", "bia@teste.com")
    for t in ("Matrix", "Interestelar"):
        client.post("/diary", json={"media_id": mid(db, t), "rating": 5, "review": f"Sobre {t}"}, headers=ana)
    client.post("/diary", json={"media_id": mid(db, "Dark"), "rating": 4}, headers=ana)  # sem resenha: não entra
    ana_id = uid(db, "Ana")
    recentes = client.get(f"/users/{ana_id}/reviews", headers=bia).json()
    assert [r["media"]["title"] for r in recentes] == ["Interestelar", "Matrix"]
    matrix = recentes[1]["id"]
    client.put(f"/community/{matrix}/like", headers=bia)
    populares = client.get(f"/users/{ana_id}/reviews", params={"sort": "populares"}, headers=bia).json()
    assert populares[0]["media"]["title"] == "Matrix" and populares[0]["liked"] is True

    db.query(User).filter(User.id == ana_id).update({"visibility": "followers"})
    db.commit()
    assert client.get(f"/users/{ana_id}/reviews", headers=bia).status_code == 403
    db.query(User).filter(User.id == ana_id).update({"visibility": "private"})
    db.commit()
    assert client.get(f"/users/{ana_id}/reviews", headers=bia).status_code == 404
    assert client.get(f"/users/{ana_id}/reviews", headers=ana).status_code == 200  # a própria pessoa sempre vê
