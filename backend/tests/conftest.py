import os
import tempfile

# Banco isolado para os testes (antes de importar a aplicação)
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["TASTORY_DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["TASTORY_AUTO_SEED"] = "false"
os.environ["TASTORY_USE_EXTERNAL_NEIGHBORS"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import ADMIN_EMAIL, ADMIN_PASSWORD, create_demo_accounts, load_catalog  # noqa: E402


@pytest.fixture()
def db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session = SessionLocal()
    load_catalog(session)
    create_demo_accounts(session)
    yield session
    session.close()


@pytest.fixture()
def client(db):
    with TestClient(app) as c:
        yield c


def auth_headers(client: TestClient, email: str, password: str) -> dict:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def register(client: TestClient, name="Fulano", email="fulano@teste.com", password="segredo1") -> dict:
    r = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def user_headers(client):
    return register(client)


@pytest.fixture()
def admin_headers(client):
    return auth_headers(client, ADMIN_EMAIL, ADMIN_PASSWORD)


def media_id_by_title(client: TestClient, headers: dict, title: str) -> int:
    r = client.get("/media", params={"q": title}, headers=headers)
    items = [m for m in r.json()["items"] if m["title"] == title]
    assert items, f"título não encontrado: {title}"
    return items[0]["id"]
