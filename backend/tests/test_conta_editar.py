"""Minha conta: nome, e-mail, senha e foto de perfil."""

import base64

from .conftest import register

JPEG = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0" + b"0" * 100).decode()
PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 100).decode()


def test_muda_nome_e_email(client, user_headers):
    r = client.patch("/me", json={"name": "  Novo Nome ", "email": "Novo@Teste.com"}, headers=user_headers)
    assert r.status_code == 200 and r.json()["name"] == "Novo Nome" and r.json()["email"] == "novo@teste.com"
    register(client, "Outra", "outra@teste.com")
    assert client.patch("/me", json={"email": "OUTRA@teste.com"}, headers=user_headers).status_code == 409
    assert client.patch("/me", json={"name": " a "}, headers=user_headers).status_code == 422
    assert client.patch("/me", json={"email": "sem-arroba"}, headers=user_headers).status_code == 422
    assert client.patch("/me", json={"name": "X Y"}).status_code == 401


def test_troca_a_senha(client, user_headers):
    email = client.get("/me", headers=user_headers).json()["email"]
    errada = client.put("/me/password", json={"current_password": "errada", "new_password": "nova-senha"}, headers=user_headers)
    assert errada.status_code == 403
    assert client.put("/me/password", json={"current_password": "segredo1", "new_password": "123"},
                      headers=user_headers).status_code == 422
    ok = client.put("/me/password", json={"current_password": "segredo1", "new_password": "nova-senha"}, headers=user_headers)
    assert ok.status_code == 204
    assert client.post("/auth/login", json={"email": email, "password": "nova-senha"}).status_code == 200
    assert client.post("/auth/login", json={"email": email, "password": "segredo1"}).status_code == 401


def test_foto_de_perfil(client, user_headers):
    me = client.get("/me", headers=user_headers).json()["id"]
    assert client.get("/users/avatars", headers=user_headers).json() == {}
    assert client.put("/me/avatar", json={"image": JPEG}, headers=user_headers).status_code == 204
    token = client.get("/users/avatars", headers=user_headers).json()[str(me)]
    foto = client.get(f"/users/{me}/avatar/{token}")  # sem login: é uma imagem
    assert foto.status_code == 200 and foto.headers["content-type"] == "image/jpeg" and foto.content.startswith(b"\xff\xd8")
    assert client.get(f"/users/{me}/avatar/outro-codigo").status_code == 404

    client.put("/me/avatar", json={"image": PNG}, headers=user_headers)
    novo = client.get("/users/avatars", headers=user_headers).json()[str(me)]
    assert novo != token and client.get(f"/users/{me}/avatar/{token}").status_code == 404  # o endereço muda com a foto

    assert client.delete("/me/avatar", headers=user_headers).status_code == 204
    assert client.get("/users/avatars", headers=user_headers).json() == {}


def test_foto_recusa_o_que_nao_e_imagem(client, user_headers):
    falso = "data:image/jpeg;base64," + base64.b64encode(b"<html>oi</html>").decode()
    assert client.put("/me/avatar", json={"image": falso}, headers=user_headers).status_code == 422
    assert client.put("/me/avatar", json={"image": "data:image/gif;base64,R0lG"}, headers=user_headers).status_code == 422
    grande = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + b"0" * 310_000).decode()
    assert client.put("/me/avatar", json={"image": grande}, headers=user_headers).status_code == 422
    assert client.put("/me/avatar", json={"image": JPEG}).status_code == 401


def test_foto_de_perfil_privado_so_para_a_dona(client, user_headers):
    ana = register(client, "Ana", "ana@teste.com")
    ana_id = client.get("/me", headers=ana).json()["id"]
    client.put("/me/avatar", json={"image": JPEG}, headers=ana)
    assert str(ana_id) in client.get("/users/avatars", headers=user_headers).json()
    client.put("/me/visibility", json={"visibility": "private"}, headers=ana)
    assert str(ana_id) not in client.get("/users/avatars", headers=user_headers).json()
    assert str(ana_id) in client.get("/users/avatars", headers=ana).json()
    client.request("DELETE", "/me", json={"password": "segredo1"}, headers=ana)  # a foto sai com a conta
    assert client.get("/users/avatars", headers=user_headers).json() == {}
