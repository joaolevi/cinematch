"""Denunciar resenhas (spoiler, ofensa, spam ou outro) e a fila de denúncias da moderação."""

from sqlalchemy import select

from app.models import Media

from .conftest import register


def resenha(client, db, headers, title="Matrix", texto="No fim, o Neo é o escolhido."):
    media_id = db.scalar(select(Media.id).where(Media.title == title))
    return client.post("/diary", json={"media_id": media_id, "rating": 5, "review": texto}, headers=headers).json()["id"]


def test_denunciar_e_duas_denuncias_de_spoiler_escondem(client, user_headers, db, admin_headers):
    entrada = resenha(client, db, user_headers)
    ana, bia = register(client, "Ana", "ana@teste.com"), register(client, "Bia", "bia@teste.com")

    r = client.post(f"/community/{entrada}/report", json={"reason": "spoiler", "note": "Conta o final"}, headers=ana)
    assert r.status_code == 200 and r.json() == {"reported": True, "spoiler": False}
    item = next(i for i in client.get("/community", headers=ana).json()["items"] if i["id"] == entrada)
    assert item["reported"] is True and item["spoiler"] is False

    r = client.post(f"/community/{entrada}/report", json={"reason": "spoiler"}, headers=bia)
    assert r.json()["spoiler"] is True  # duas denúncias de spoiler: já aparece escondida

    fila = client.get("/admin/reports", headers=admin_headers).json()
    assert len(fila) == 1 and fila[0]["reports"] == 2 and fila[0]["reasons"] == {"spoiler": 2}
    assert fila[0]["notes"] == ["Conta o final"] and fila[0]["user_name"] == "Fulano"


def test_moderacao_decide_e_a_fila_esvazia(client, user_headers, db, admin_headers):
    entrada = resenha(client, db, user_headers)
    ana = register(client, "Ana", "ana@teste.com")
    client.post(f"/community/{entrada}/report", json={"reason": "spoiler"}, headers=ana)
    client.post(f"/community/{entrada}/report", json={"reason": "ofensa"}, headers=ana)  # trocar o motivo
    assert client.get("/admin/reports", headers=admin_headers).json()[0]["reasons"] == {"ofensa": 1}

    assert client.patch(f"/admin/reports/{entrada}", json={"action": "hide"}, headers=admin_headers).status_code == 204
    assert client.get("/admin/reports", headers=admin_headers).json() == []
    item = next(i for i in client.get("/community", headers=ana).json()["items"] if i["id"] == entrada)
    assert item["review"] is None  # oculta pela moderação

    outra = resenha(client, db, user_headers, "Interestelar", "Chorei.")
    client.post(f"/community/{outra}/report", json={"reason": "spoiler"}, headers=ana)
    client.patch(f"/admin/reports/{outra}", json={"action": "spoiler"}, headers=admin_headers)
    client.post(f"/community/{outra}/report", json={"reason": "spoiler"}, headers=ana)  # denúncia nova reabre
    client.patch(f"/admin/reports/{outra}", json={"action": "not_spoiler"}, headers=admin_headers)
    item = next(i for i in client.get("/community", headers=ana).json()["items"] if i["id"] == outra)
    assert item["spoiler"] is False


def test_denuncia_valida(client, user_headers, db, admin_headers):
    entrada = resenha(client, db, user_headers)
    ana = register(client, "Ana", "ana@teste.com")
    assert client.post(f"/community/{entrada}/report", json={"reason": "spoiler"}, headers=user_headers).status_code == 400
    assert client.post(f"/community/{entrada}/report", json={"reason": "chato"}, headers=ana).status_code == 422
    assert client.post(f"/community/{entrada}/report", json={"reason": "outro", "note": "x" * 301}, headers=ana).status_code == 422
    assert client.post("/community/99999/report", json={"reason": "spam"}, headers=ana).status_code == 404
    assert client.post(f"/community/{entrada}/report", json={"reason": "spam"}).status_code == 401
    assert client.get("/admin/reports", headers=ana).status_code == 403
    assert client.patch(f"/admin/reports/{entrada}", json={"action": "sumir"}, headers=admin_headers).status_code == 422
