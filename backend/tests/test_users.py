"""Perfil e compatibilidade de gosto (RFF15)."""

from sqlalchemy import select

from app.models import Media, User

from .conftest import register


def ids(db, *titles):
    return [db.scalar(select(Media.id).where(Media.title == t)) for t in titles]


def curtir(client, headers, db, *titles, rating=5):
    for mid in ids(db, *titles):
        assert client.post("/diary", json={"media_id": mid, "rating": rating}, headers=headers).status_code == 201


def me(client, headers):
    return client.get("/me", headers=headers).json()["id"]


def test_perfil_mostra_contagens_favoritos_e_recentes(client, user_headers, db):
    curtir(client, user_headers, db, "Interestelar", "Breaking Bad")
    client.post("/diary", json={"media_id": ids(db, "Matrix")[0]}, headers=user_headers)  # sem nota
    p = client.get(f"/users/{me(client, user_headers)}", headers=user_headers).json()
    assert p["is_me"] and p["compatibility"] is None
    assert p["counts"] == {"movie": 2, "series": 1, "album": 0}
    assert len(p["recent"]) == 3 and p["recent"][0]["media"]["title"] == "Matrix"
    assert [f["media"]["title"] for f in p["favorites"]] == ["Breaking Bad", "Interestelar"]  # só com nota


def test_quem_curtiu_as_mesmas_coisas_combina_mais(client, user_headers, db):
    curtir(client, user_headers, db, "Interestelar", "A Origem", "Matrix")
    parecida = register(client, "Parecida", "parecida@teste.com")
    curtir(client, parecida, db, "Interestelar", "A Origem", "Blade Runner 2049")
    diferente = register(client, "Diferente", "diferente@teste.com")
    curtir(client, diferente, db, "Diário de uma Paixão", "Orgulho e Preconceito")

    com_parecida = client.get(f"/users/{me(client, parecida)}", headers=user_headers).json()["compatibility"]
    com_diferente = client.get(f"/users/{me(client, diferente)}", headers=user_headers).json()["compatibility"]
    assert com_parecida["percent"] > com_diferente["percent"]
    assert {m["title"] for m in com_parecida["shared"]} == {"Interestelar", "A Origem"}
    assert "Ficção Científica" in com_parecida["genres"]
    assert com_diferente["shared"] == [] and com_diferente["label"] == "Gostos bem diferentes"


def test_sem_registros_nao_da_para_comparar(client, user_headers, db):
    outra = register(client, "Outra", "outra@teste.com")
    c = client.get(f"/users/{me(client, outra)}", headers=user_headers).json()["compatibility"]
    assert c["percent"] is None and c["label"] == "Você ainda não registrou o que curte"


def test_perfil_privado_ou_inexistente_da_404(client, user_headers, db):
    outra = register(client, "Reservada", "reservada@teste.com")
    other_id = me(client, outra)
    db.get(User, other_id).visibility = "private"
    db.commit()
    assert client.get(f"/users/{other_id}", headers=user_headers).status_code == 404
    assert client.get(f"/users/{other_id}", headers=outra).status_code == 200  # a própria pessoa vê
    assert client.get("/users/999999", headers=user_headers).status_code == 404


def test_comunidade_traz_o_id_de_quem_registrou(client, user_headers, db):
    curtir(client, user_headers, db, "Interestelar")
    item = client.get("/community", headers=user_headers).json()["items"][0]
    assert item["user_id"] == me(client, user_headers)


def test_junto_prioriza_o_que_agrada_as_duas_e_tira_o_que_alguma_ja_viu(client, user_headers, db):
    curtir(client, user_headers, db, "Interestelar", "A Origem", "Matrix")
    outra = register(client, "Levi Teste", "levi@teste.com")
    curtir(client, outra, db, "Interestelar", "Duna", "Blade Runner 2049")
    other_id = me(client, outra)
    sugestoes = client.get(f"/users/{other_id}/together", params={"limit": 10}, headers=user_headers).json()
    assert len(sugestoes) == 10
    vistos = {"Interestelar", "A Origem", "Matrix", "Duna", "Blade Runner 2049"}
    assert not vistos & {s["media"]["title"] for s in sugestoes}
    primeira = sugestoes[0]["reason"]
    assert primeira.startswith("Para você: ") and " · Para Levi: " in primeira  # agrada às duas
    assert client.get(f"/users/{me(client, user_headers)}/together", headers=user_headers).status_code == 404
    assert client.get("/users/999999/together", headers=user_headers).status_code == 404


def test_seguir_e_deixar_de_seguir(client, user_headers, db):
    outra = register(client, "Levi Teste", "levi@teste.com")
    other_id = me(client, outra)
    assert client.put(f"/users/{other_id}/follow", headers=user_headers).status_code == 204
    assert client.put(f"/users/{other_id}/follow", headers=user_headers).status_code == 204  # repetir não duplica
    p = client.get(f"/users/{other_id}", headers=user_headers).json()
    assert p["following"] is True and p["followers"] == 1 and p["follows"] == 0
    assert client.get("/users/following", headers=user_headers).json() == [{"id": other_id, "name": "Levi Teste"}]
    eu = client.get(f"/users/{me(client, user_headers)}", headers=user_headers).json()
    assert eu["follows"] == 1 and eu["following"] is False

    assert client.delete(f"/users/{other_id}/follow", headers=user_headers).status_code == 204
    assert client.delete(f"/users/{other_id}/follow", headers=user_headers).status_code == 204  # quem não segue, segue sem seguir
    p = client.get(f"/users/{other_id}", headers=user_headers).json()
    assert p["following"] is False and p["followers"] == 0
    assert client.get("/users/following", headers=user_headers).json() == []


def test_nao_segue_a_si_mesmo_nem_perfil_privado(client, user_headers, db):
    assert client.put(f"/users/{me(client, user_headers)}/follow", headers=user_headers).status_code == 400
    assert client.put("/users/999999/follow", headers=user_headers).status_code == 404
    reservada = register(client, "Reservada", "reservada@teste.com")
    rid = me(client, reservada)
    assert client.put(f"/users/{rid}/follow", headers=user_headers).status_code == 204
    db.get(User, rid).visibility = "private"
    db.commit()
    assert client.put(f"/users/{rid}/follow", headers=user_headers).status_code == 404
    assert client.get("/users/following", headers=user_headers).json() == []  # perfil que ficou privado sai da lista


def test_comunidade_filtra_por_quem_eu_sigo(client, user_headers, db):
    seguida = register(client, "Seguida", "seguida@teste.com")
    outra = register(client, "Outra", "outra@teste.com")
    curtir(client, seguida, db, "Interestelar")
    curtir(client, outra, db, "Matrix")
    client.put(f"/users/{me(client, seguida)}/follow", headers=user_headers)
    todos = client.get("/community", headers=user_headers).json()["items"]
    sigo = client.get("/community", params={"following": True}, headers=user_headers).json()["items"]
    assert {i["user_name"] for i in todos} >= {"Seguida", "Outra"}
    assert [i["media"]["title"] for i in sigo] == ["Interestelar"]
