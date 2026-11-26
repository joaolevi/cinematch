"""Busca de pessoas pelo nome."""

from sqlalchemy import select

from app.models import User

from .conftest import register


def test_busca_pelo_nome_sem_acento(client, user_headers, db):
    julia = register(client, "Júlia Prado", "julia@teste.com")
    register(client, "Ana Júlia", "ana@teste.com")
    register(client, "Bruno", "bruno@teste.com")
    r = client.get("/users/search", params={"q": "julia"}, headers=user_headers).json()
    assert [p["name"] for p in r] == ["Júlia Prado", "Ana Júlia"]  # quem começa com o nome vem antes
    assert r[0]["followers"] == 0 and r[0]["titles"] == 0 and r[0]["following"] is False

    eu_id = db.scalar(select(User.id).where(User.name == "Júlia Prado"))
    client.put(f"/users/{eu_id}/follow", headers=user_headers)
    r = client.get("/users/search", params={"q": "PRADO"}, headers=user_headers).json()
    assert r[0]["following"] is True and r[0]["followers"] == 1
    assert client.get("/users/search", params={"q": "julia"}, headers=julia).json()[0]["name"] == "Ana Júlia"  # não acha a si


def test_busca_respeita_a_privacidade(client, user_headers, db):
    register(client, "Carla Secreta", "carla@teste.com")
    register(client, "Carla Fechada", "fechada@teste.com")
    db.query(User).filter(User.name == "Carla Secreta").update({"visibility": "private"})
    db.query(User).filter(User.name == "Carla Fechada").update({"visibility": "followers"})
    db.commit()
    r = client.get("/users/search", params={"q": "carla"}, headers=user_headers).json()
    assert [(p["name"], p["titles"]) for p in r] == [("Carla Fechada", None)]  # privado some; fechado vem sem números
    assert client.get("/users/search", params={"q": "c"}, headers=user_headers).status_code == 422
    assert client.get("/users/search", params={"q": "carla"}).status_code == 401
