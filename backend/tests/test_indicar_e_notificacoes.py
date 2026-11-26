"""Indicar títulos para quem você segue e as notificações."""

from sqlalchemy import select

from app.models import Media, User

from .conftest import register


def mid(db, title):
    return db.scalar(select(Media.id).where(Media.title == title))


def uid(db, name):
    return db.scalar(select(User.id).where(User.name == name))


def avisos(client, headers):
    return client.get("/me/notifications", headers=headers).json()


def test_indicar_para_quem_segue(client, user_headers, db):
    ana = register(client, "Ana", "ana@teste.com")
    ana_id = uid(db, "Ana")
    matrix = mid(db, "Matrix")
    # Só para quem você segue
    assert client.post(f"/media/{matrix}/suggest", json={"to": [ana_id]}, headers=user_headers).status_code == 400
    client.put(f"/users/{ana_id}/follow", headers=user_headers)
    r = client.post(f"/media/{matrix}/suggest", json={"to": [ana_id], "note": " Você vai amar "}, headers=user_headers)
    assert r.json() == {"sent": 1}

    recebidas = client.get("/me/suggestions", headers=ana).json()
    assert len(recebidas) == 1 and recebidas[0]["media"]["title"] == "Matrix"
    assert recebidas[0]["sender"]["name"] == "Fulano" and recebidas[0]["note"] == "Você vai amar"
    assert recebidas[0]["in_watchlist"] is False

    n = avisos(client, ana)
    assert n["unread"] == 2  # seguiu e indicou
    assert [i["kind"] for i in n["items"]] == ["indicou", "seguiu"]
    assert n["items"][0]["text"] == "Você vai amar" and n["items"][0]["media"]["title"] == "Matrix"

    # Indicar de novo só troca o recado; quem já viu não recebe
    client.post(f"/media/{matrix}/suggest", json={"to": [ana_id], "note": "Sério, veja"}, headers=user_headers)
    assert client.get("/me/suggestions", headers=ana).json()[0]["note"] == "Sério, veja"
    client.post("/diary", json={"media_id": matrix, "rating": 5}, headers=ana)
    assert client.get("/me/suggestions", headers=ana).json() == []
    assert client.post(f"/media/{matrix}/suggest", json={"to": [ana_id]}, headers=user_headers).json() == {"sent": 0}
    assert client.post(f"/media/{matrix}/suggest", json={"to": []}, headers=user_headers).status_code == 422


def test_avisos_de_curtida_comentario_e_quero_ver(client, user_headers, db):
    ana = register(client, "Ana", "ana@teste.com")
    ana_id, eu = uid(db, "Ana"), uid(db, "Fulano")
    matrix, dark = mid(db, "Matrix"), mid(db, "Dark")
    entrada = client.post("/diary", json={"media_id": matrix, "rating": 5, "review": "Clássico"}, headers=user_headers).json()["id"]
    client.put(f"/community/{entrada}/like", headers=ana)
    client.post(f"/community/{entrada}/comments", json={"text": "Concordo demais"}, headers=ana)
    tipos = [i["kind"] for i in avisos(client, user_headers)["items"]]
    assert tipos == ["comentou", "curtiu"]

    # Ana tem Dark no Quero ver e segue Fulano: quando ele registra Dark, ela fica sabendo
    client.put(f"/users/{eu}/follow", headers=ana)
    client.post(f"/recommendations/{dark}/feedback", json={"action": "want"}, headers=ana)
    client.post("/diary", json={"media_id": dark, "rating": 4}, headers=user_headers)
    ultimo = avisos(client, ana)["items"][0]
    assert ultimo["kind"] == "registrou" and ultimo["media"]["title"] == "Dark" and ultimo["actor"]["name"] == "Fulano"

    # Ler zera o contador; ninguém recebe aviso do que fez
    assert client.post("/me/notifications/read", headers=ana).status_code == 204
    assert avisos(client, ana)["unread"] == 0
    assert all(i["actor"]["id"] != ana_id for i in avisos(client, ana)["items"] if i["actor"])
    assert client.get("/me/notifications").status_code == 401


def test_criar_lembranca_juntos(client, user_headers, db):
    from datetime import date, timedelta

    ana = register(client, "Ana", "ana@teste.com")
    ana_id = uid(db, "Ana")
    dark = mid(db, "Dark")
    assert client.post(f"/media/{dark}/invite", json={"to": ana_id}, headers=user_headers).status_code == 400  # não segue
    client.put(f"/users/{ana_id}/follow", headers=user_headers)
    sabado = (date.today() + timedelta(days=2)).isoformat()
    r = client.post(f"/media/{dark}/invite", json={"to": ana_id, "day": sabado, "note": "Maratona?"}, headers=user_headers)
    assert r.status_code == 201 and r.json()["status"] == "pending" and r.json()["mine"] is True

    recebido = client.get("/me/invites", headers=ana).json()["items"][0]
    assert (recebido["sender"]["name"], recebido["day"], recebido["note"], recebido["mine"]) == ("Fulano", sabado, "Maratona?", False)
    assert avisos(client, ana)["items"][0]["kind"] == "convidou"

    # Só quem foi chamado responde; topar põe no Quero ver e avisa quem chamou
    assert client.put(f"/invites/{recebido['id']}", json={"answer": "accepted"}, headers=user_headers).status_code == 404
    r = client.put(f"/invites/{recebido['id']}", json={"answer": "accepted"}, headers=ana)
    assert r.json()["status"] == "accepted"
    assert any(i["media"]["title"] == "Dark" for i in client.get("/lists", headers=ana).json()[0]["items"])
    assert avisos(client, user_headers)["items"][0]["kind"] == "aceitou"

    # Agora não: sai das duas listas
    m = mid(db, "Matrix")
    outro = client.post(f"/media/{m}/invite", json={"to": ana_id}, headers=user_headers).json()
    client.put(f"/invites/{outro['id']}", json={"answer": "declined"}, headers=ana)
    assert {i["media"]["title"] for i in client.get("/me/invites", headers=ana).json()["items"]} == {"Dark"}
    ontem_de_semana_passada = (date.today() - timedelta(days=8)).isoformat()
    assert client.post(f"/media/{m}/invite", json={"to": ana_id, "day": ontem_de_semana_passada}, headers=user_headers).status_code == 422


def test_marcar_um_aviso_como_lido(client, user_headers, db):
    ana = register(client, "Ana", "ana@teste.com")
    client.put(f"/users/{uid(db, 'Ana')}/follow", headers=user_headers)
    client.put(f"/users/{uid(db, 'Fulano')}/follow", headers=ana)
    n = avisos(client, user_headers)
    assert n["unread"] == 1
    item = n["items"][0]
    assert client.post(f"/me/notifications/{item['id']}/read", headers=ana).status_code == 404  # o aviso é de outra pessoa
    assert client.post(f"/me/notifications/{item['id']}/read", headers=user_headers).status_code == 204
    n = avisos(client, user_headers)
    assert n["unread"] == 0 and n["items"][0]["read"] is True
