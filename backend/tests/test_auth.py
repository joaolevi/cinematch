from .conftest import register


def test_register_and_me(client):
    headers = register(client, email="nova@teste.com")
    r = client.get("/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "nova@teste.com"
    assert body["role"] == "user"
    assert body["ab_group"] in {"A", "B"}


def test_register_creates_watchlist(client):
    headers = register(client)
    lists = client.get("/lists", headers=headers).json()
    assert [lst["is_watchlist"] for lst in lists] == [True]


def test_duplicate_email(client):
    register(client, email="dup@teste.com")
    r = client.post("/auth/register", json={"name": "Xis", "email": "DUP@teste.com", "password": "segredo1"})
    assert r.status_code == 409


def test_login_wrong_password(client):
    register(client, email="a@teste.com", password="certa123")
    r = client.post("/auth/login", json={"email": "a@teste.com", "password": "errada"})
    assert r.status_code == 401


def test_protected_route_requires_token(client):
    assert client.get("/me").status_code == 401
    assert client.get("/recommendations").status_code == 401


def test_ab_groups_alternate(client):
    groups = set()
    for i in range(4):
        h = register(client, email=f"ab{i}@teste.com")
        groups.add(client.get("/me", headers=h).json()["ab_group"])
    assert groups == {"A", "B"}


def test_password_limit_is_72_bytes(client):
    payload = {"name": "Longa", "email": "longa@teste.com"}
    assert client.post("/auth/register", json={**payload, "password": "a" * 73}).status_code == 422
    assert client.post("/auth/register", json={**payload, "password": "é" * 37}).status_code == 422
    assert client.post("/auth/register", json={**payload, "password": "a" * 72}).status_code == 201
