"""O diário de uma pessoa no perfil (RFF11), com as mesmas regras de quem pode ver."""

from sqlalchemy import select

from app.models import DiaryEntry, Media

from .conftest import register


def media_id(db, title):
    return db.scalar(select(Media.id).where(Media.title == title))


def me(client, headers):
    return client.get("/me", headers=headers).json()["id"]


def test_diario_de_outra_pessoa_no_perfil(client, user_headers, db):
    ana = register(client, "Ana", "ana@teste.com")
    client.post("/diary", json={"media_id": media_id(db, "Matrix"), "rating": 5, "review": "Clássico"}, headers=ana)
    client.post("/diary", json={"media_id": media_id(db, "Dark"), "rating": 4, "review": "Spoiler"}, headers=ana)
    escondida = db.scalar(select(DiaryEntry).where(DiaryEntry.review == "Spoiler"))
    escondida.review_hidden = True
    db.commit()

    diario = client.get(f"/users/{me(client, ana)}/diary", headers=user_headers).json()
    assert {e["media"]["title"]: e["review"] for e in diario} == {"Matrix": "Clássico", "Dark": None}
    proprio = client.get(f"/users/{me(client, ana)}/diary", headers=ana).json()
    assert {e["media"]["title"]: e["review"] for e in proprio}["Dark"] == "Spoiler"  # a dona vê a própria resenha


def test_diario_segue_quem_pode_ver(client, user_headers, db):
    ana = register(client, "Ana", "ana@teste.com")
    ana_id = me(client, ana)
    client.post("/diary", json={"media_id": media_id(db, "Matrix"), "rating": 5}, headers=ana)

    client.put("/me/visibility", json={"visibility": "followers"}, headers=ana)
    assert client.get(f"/users/{ana_id}/diary", headers=user_headers).status_code == 403
    client.put(f"/users/{ana_id}/follow", headers=user_headers)
    assert len(client.get(f"/users/{ana_id}/diary", headers=user_headers).json()) == 1

    client.put("/me/visibility", json={"visibility": "private"}, headers=ana)
    assert client.get(f"/users/{ana_id}/diary", headers=user_headers).status_code == 404
    assert client.get("/users/999999/diary", headers=user_headers).status_code == 404
    assert client.get(f"/users/{ana_id}/diary").status_code == 401
