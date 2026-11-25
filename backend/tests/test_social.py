"""Ver junto com mais gente e no momento (RFF28, RFF20), ver quem segue quem (RFF09) e curtir e comentar resenhas,
com moderação e o rank pelas curtidas (RFF30)."""

import pytest
from sqlalchemy import select

from app.models import Media

from .conftest import register


def media_id(db, title):
    return db.scalar(select(Media.id).where(Media.title == title))


def me(client, headers):
    return client.get("/me", headers=headers).json()["id"]


def curtir(client, headers, db, *titles):
    for title in titles:
        r = client.post("/diary", json={"media_id": media_id(db, title), "rating": 5}, headers=headers)
        assert r.status_code == 201, r.text


def resenhar(client, headers, db, title, review):
    r = client.post("/diary", json={"media_id": media_id(db, title), "rating": 4, "review": review}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------- RFF28 e RFF20
@pytest.fixture()
def turma(client, user_headers, db):
    """Fulano (quem pede), Levi e Bia, cada um com o que curtiu."""
    curtir(client, user_headers, db, "Interestelar", "A Origem", "Matrix")
    levi = register(client, "Levi Teste", "levi@teste.com")
    curtir(client, levi, db, "Interestelar", "Duna", "Blade Runner 2049")
    bia = register(client, "Bia Teste", "bia@teste.com")
    curtir(client, bia, db, "Matrix", "Duna", "Toy Story")
    return levi, bia


def test_junto_com_duas_pessoas_tira_o_que_qualquer_uma_ja_viu(client, user_headers, db, turma):
    levi, bia = turma
    ids = [me(client, levi), me(client, bia)]
    r = client.get("/recommendations/together", params={"with": ids, "limit": 15}, headers=user_headers)
    assert r.status_code == 200, r.text
    sugestoes = r.json()
    vistos = {"Interestelar", "A Origem", "Matrix", "Duna", "Blade Runner 2049", "Toy Story"}
    assert sugestoes and not vistos & {s["media"]["title"] for s in sugestoes}
    lados = [s["reason"].count("Para ") for s in sugestoes]
    assert lados == sorted(lados, reverse=True)  # primeiro o que aparece para mais gente
    assert lados[0] == 3 and "Para Levi: " in sugestoes[0]["reason"] and "Para Bia: " in sugestoes[0]["reason"]
    for s in sugestoes:  # o lado das outras pessoas não fala com "você"
        assert all("você" not in lado for lado in s["reason"].split(" · ")[1:]), s["reason"]


def test_junto_no_momento_e_nos_meus_servicos(client, user_headers, db, turma):
    levi, _ = turma
    for title in ("Blade Runner 2049", "Duna", "Toy Story", "Diário de uma Paixão"):
        db.scalar(select(Media).where(Media.title == title)).providers = [
            {"service": "Netflix", "kind": "flatrate", "logo": None, "link": None}
        ]
    db.commit()
    client.put("/me/services", json={"services": ["netflix"]}, headers=user_headers)
    params = {"with": [me(client, levi)], "only_mine": True}
    sugestoes = client.get("/recommendations/together", params=params, headers=user_headers).json()
    assert sugestoes and {s["media"]["title"] for s in sugestoes} <= {"Toy Story", "Diário de uma Paixão"}
    assert all(s["services"] == ["Netflix"] for s in sugestoes)

    familia = client.get("/recommendations/together", params={"with": [me(client, levi)], "occasion": "familia"},
                         headers=user_headers).json()
    assert familia and all("Família" in s["media"]["genres"] or "Animação" in s["media"]["genres"] or s["media"]["type"] == "album"
               for s in familia)


def test_junto_valida_quem_entra(client, user_headers, db, turma):
    levi, _ = turma
    url = "/recommendations/together"
    assert client.get(url, headers=user_headers).status_code == 422  # ninguém
    assert client.get(url, params={"with": [1, 2, 3, 4, 5]}, headers=user_headers).status_code == 422  # gente demais
    assert client.get(url, params={"with": [me(client, user_headers)]}, headers=user_headers).status_code == 404
    client.put("/me/visibility", json={"visibility": "followers"}, headers=levi)
    assert client.get(url, params={"with": [me(client, levi)]}, headers=user_headers).status_code == 403
    client.put(f"/users/{me(client, levi)}/follow", headers=user_headers)
    assert client.get(url, params={"with": [me(client, levi)]}, headers=user_headers).status_code == 200
    client.put("/me/visibility", json={"visibility": "private"}, headers=levi)
    assert client.get(url, params={"with": [me(client, levi)]}, headers=user_headers).status_code == 404


# ---------------------------------------------------------------- RFF09
def test_quem_segue_e_quem_e_seguido(client, user_headers):
    ana = register(client, "Ana", "ana@teste.com")
    bia = register(client, "Bia", "bia@teste.com")
    ana_id, bia_id, eu = me(client, ana), me(client, bia), me(client, user_headers)
    client.put(f"/users/{ana_id}/follow", headers=user_headers)
    client.put(f"/users/{ana_id}/follow", headers=bia)
    client.put(f"/users/{bia_id}/follow", headers=ana)

    nomes = lambda path: [p["name"] for p in client.get(path, headers=user_headers).json()]  # noqa: E731
    assert nomes(f"/users/{ana_id}/followers") == ["Bia", "Fulano"]
    assert nomes(f"/users/{ana_id}/follows") == ["Bia"]
    assert nomes(f"/users/{eu}/follows") == ["Ana"]

    client.put("/me/visibility", json={"visibility": "private"}, headers=bia)
    assert nomes(f"/users/{ana_id}/followers") == ["Fulano"]  # perfil privado sai da lista
    perfil = client.get(f"/users/{ana_id}", headers=user_headers).json()
    assert perfil["followers"] == 1 and perfil["follows"] == 0  # e dos números também
    assert client.get(f"/users/{bia_id}/followers", headers=user_headers).status_code == 404
    assert client.get(f"/users/{ana_id}/followers").status_code == 401


# ---------------------------------------------------------------- RFF30
@pytest.fixture()
def resenha(client, db):
    """Ana escreveu uma resenha de Interestelar; Bia vai curtir e comentar."""
    ana = register(client, "Ana", "ana@teste.com")
    bia = register(client, "Bia", "bia@teste.com")
    return ana, bia, resenhar(client, ana, db, "Interestelar", "Chorei no planeta da água")


def item(client, headers, entry_id):
    return next(i for i in client.get("/community", headers=headers).json()["items"] if i["id"] == entry_id)


def test_curtir_uma_resenha(client, resenha):
    ana, bia, entry = resenha
    assert client.put(f"/community/{entry}/like", headers=bia).status_code == 204
    assert client.put(f"/community/{entry}/like", headers=bia).status_code == 204  # repetir não conta duas vezes
    assert item(client, bia, entry).items() >= {"likes": 1, "liked": True}.items()
    assert item(client, ana, entry)["liked"] is False
    assert client.put(f"/community/{entry}/like", headers=ana).status_code == 400  # a própria
    assert client.delete(f"/community/{entry}/like", headers=bia).status_code == 204
    assert item(client, bia, entry)["likes"] == 0


def test_so_resenha_visivel_recebe_curtida(client, db, resenha, admin_headers):
    ana, bia, entry = resenha
    sem_texto = client.post("/diary", json={"media_id": media_id(db, "Matrix"), "rating": 3}, headers=ana).json()["id"]
    assert client.put(f"/community/{sem_texto}/like", headers=bia).status_code == 404
    client.put("/me/visibility", json={"visibility": "followers"}, headers=ana)
    assert client.put(f"/community/{entry}/like", headers=bia).status_code == 404  # Bia não segue Ana
    client.put("/me/visibility", json={"visibility": "all"}, headers=ana)
    client.patch(f"/admin/reviews/{entry}", json={"hidden": True}, headers=admin_headers)
    assert client.put(f"/community/{entry}/like", headers=bia).status_code == 404


def test_comentar_e_apagar(client, user_headers, resenha):
    ana, bia, entry = resenha
    r = client.post(f"/community/{entry}/comments", json={"text": "  Eu também!  "}, headers=bia)
    assert r.status_code == 201 and r.json()["text"] == "Eu também!" and r.json()["user_name"] == "Bia"
    comment = r.json()["id"]
    assert client.post(f"/community/{entry}/comments", json={"text": "   "}, headers=bia).status_code == 422
    assert client.post(f"/community/{entry}/comments", json={"text": "x" * 501}, headers=bia).status_code == 422

    vistos = client.get(f"/community/{entry}/comments", headers=user_headers).json()
    assert [c["text"] for c in vistos] == ["Eu também!"] and vistos[0]["can_delete"] is False
    assert client.get(f"/community/{entry}/comments", headers=ana).json()[0]["can_delete"] is True
    assert item(client, user_headers, entry)["comments"] == 1

    assert client.delete(f"/community/comments/{comment}", headers=user_headers).status_code == 403
    assert client.delete(f"/community/comments/{comment}", headers=ana).status_code == 204  # quem escreveu a resenha
    assert client.get(f"/community/{entry}/comments", headers=bia).json() == []
    assert client.delete(f"/community/comments/{comment}", headers=bia).status_code == 404


def test_moderacao_dos_comentarios(client, user_headers, resenha, admin_headers):
    _, bia, entry = resenha
    comment = client.post(f"/community/{entry}/comments", json={"text": "texto ofensivo"}, headers=bia).json()["id"]
    fila = client.get("/admin/comments", headers=admin_headers).json()
    assert fila[0].items() >= {"id": comment, "user_name": "Bia", "review_author": "Ana", "media_title": "Interestelar"}.items()
    r = client.patch(f"/admin/comments/{comment}", json={"hidden": True}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["hidden"] is True
    assert client.get(f"/community/{entry}/comments", headers=user_headers).json() == []
    assert item(client, user_headers, entry)["comments"] == 0
    assert [c["id"] for c in client.get("/admin/comments", params={"hidden": True}, headers=admin_headers).json()] == [comment]
    assert client.get("/admin/comments", headers=user_headers).status_code == 403
    assert client.patch("/admin/comments/999999", json={"hidden": True}, headers=admin_headers).status_code == 404


def test_rank_pelas_curtidas_recebidas(client, user_headers, db, resenha):
    ana, bia, entry = resenha
    resenhar(client, bia, db, "Matrix", "Clássico")
    resenhar(client, bia, db, "Duna", "Lindo")
    client.put(f"/community/{entry}/like", headers=bia)
    client.put(f"/community/{entry}/like", headers=user_headers)
    rank = client.get("/community/reviewers", headers=user_headers).json()
    assert [(r["name"], r["likes"], r["reviews"]) for r in rank[:2]] == [("Ana", 2, 1), ("Bia", 0, 2)]
    assert rank[0]["id"] == me(client, ana)
