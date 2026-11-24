"""Climas (RNFF09, RFF23), sugestões pelo momento (RFF20), perfil de gosto (RFF07) e retorno sobre sugestões (RFF08)."""

from sqlalchemy import select

from app.models import Media
from app.services.moods import MOODS, moods_for
from app.services.recommender import user_signals

from .conftest import media_id_by_title, see_feed


def curtir(client, headers, *titles, rating=5):
    for t in titles:
        mid = media_id_by_title(client, headers, t)
        assert client.post("/diary", json={"media_id": mid, "rating": rating}, headers=headers).status_code == 201


def me_id(client, headers):
    return client.get("/me", headers=headers).json()["id"]


# ---------------------------------------------------------------- vocabulário
def test_climas_vem_de_generos_e_palavras_chave_das_tres_midias():
    toy = Media(type="movie", title="Toy", genres=["Animação", "Família", "Comédia"], tags=["pixar"])
    terror = Media(type="movie", title="Medo", genres=["Terror", "Comédia"], tags=["sobrenatural"])
    disco = Media(type="album", title="Bossa", genres=["Bossa nova", "MPB"], tags=["bossa nova", "jazz"])
    assert moods_for(toy)[0] == "familia" and "leve" in moods_for(toy)
    assert "assustador" in moods_for(terror) and "leve" not in moods_for(terror)  # terror não é leve
    assert "relaxante" in moods_for(disco) and "leve" in moods_for(disco)
    assert len(MOODS) == 20 and all(len(moods_for(m)) <= 3 for m in (toy, terror, disco))


def test_busca_por_clima(client, user_headers):
    moods = client.get("/media/moods", headers=user_headers).json()
    assert len(moods) == 20 and {"key", "label", "count"} <= set(moods[0])
    assustador = next(m for m in moods if m["key"] == "assustador")
    assert assustador["label"] == "Assustador" and assustador["count"] > 0
    items = client.get("/media", params={"mood": "assustador", "limit": 50}, headers=user_headers).json()["items"]
    assert items and all("assustador" in m["moods"] for m in items)


# ---------------------------------------------------------------- momento
def test_momento_filtra_por_clima_e_duracao(client, user_headers, db):
    curtir(client, user_headers, "Matrix", "Interestelar")
    feed = client.get("/recommendations", params={"mood": "tenso", "limit": 8}, headers=user_headers).json()["items"]
    assert feed and all("tenso" in r["media"]["moods"] for r in feed)
    # só os títulos com duração conhecida e até 100 minutos
    curtos = list(db.scalars(select(Media).where(Media.type == "movie").limit(6)))
    for m in curtos:
        m.duration_min = 95
    db.commit()
    feed = client.get("/recommendations", params={"max_minutes": 100, "limit": 10}, headers=user_headers).json()["items"]
    assert feed and all(r["media"]["duration_min"] and r["media"]["duration_min"] <= 100 for r in feed)


# ---------------------------------------------------------------- por que e "não por esse motivo"
def test_sugestao_traz_o_que_esta_por_tras_do_motivo(client, user_headers):
    curtir(client, user_headers, "Matrix", "Interestelar", "A Origem")
    items = see_feed(client, user_headers, limit=10)
    com_titulo = [r for r in items if r["because"] and r["because"]["kind"] == "title"]
    assert com_titulo
    r = com_titulo[0]
    assert r["because"]["label"] in r["reason"]  # "Porque você curtiu Matrix" -> label "Matrix"


def test_nao_por_esse_motivo_diminui_o_peso_do_titulo(client, user_headers, db):
    curtir(client, user_headers, "Matrix", "Interestelar", "A Origem")
    uid = me_id(client, user_headers)
    matrix = media_id_by_title(client, user_headers, "Matrix")
    antes = user_signals(db, uid)[matrix]
    r = client.put("/me/taste/adjustments", json={"kind": "title", "value": str(matrix), "weight": 0.5}, headers=user_headers)
    assert r.status_code == 204
    assert user_signals(db, uid)[matrix] == antes * 0.5
    perfil = client.get("/me/taste", headers=user_headers).json()
    assert next(t for t in perfil["titles"] if t["media"]["id"] == matrix)["weight"] == 0.5
    # peso 1 volta ao normal
    client.put("/me/taste/adjustments", json={"kind": "title", "value": str(matrix), "weight": 1}, headers=user_headers)
    assert user_signals(db, uid)[matrix] == antes


def test_tirar_um_genero_do_calculo_tira_do_feed(client, user_headers):
    curtir(client, user_headers, "Matrix", "Interestelar", "A Origem")
    feed = client.get("/recommendations", params={"limit": 15}, headers=user_headers).json()["items"]
    genero = next(g for r in feed for g in r["media"]["genres"])
    client.put("/me/taste/adjustments", json={"kind": "genre", "value": genero, "weight": 0}, headers=user_headers)
    feed = client.get("/recommendations", params={"limit": 15}, headers=user_headers).json()["items"]
    assert all(genero not in r["media"]["genres"] for r in feed)
    client.delete("/me/taste/adjustments", headers=user_headers)
    assert client.get("/me/taste", headers=user_headers).json()["adjusted"] == 0


# ---------------------------------------------------------------- perfil de gosto
def test_perfil_de_gosto_mostra_os_pesos_e_os_registros_fora_do_calculo(client, user_headers, db):
    curtir(client, user_headers, "Matrix", "Interestelar", "A Origem")
    perfil = client.get("/me/taste", headers=user_headers).json()
    assert perfil["genres"][0]["label"] and abs(sum(g["share"] for g in perfil["genres"]) - 1) < 0.2
    assert {t["media"]["title"] for t in perfil["titles"]} == {"Matrix", "Interestelar", "A Origem"}
    assert perfil["decades"][0]["label"].startswith("Anos")

    entry = next(t["entry_id"] for t in perfil["titles"] if t["media"]["title"] == "Matrix")
    r = client.patch(f"/diary/{entry}", json={"excluded": True}, headers=user_headers)
    assert r.status_code == 200 and r.json()["excluded"] is True
    perfil = client.get("/me/taste", headers=user_headers).json()
    assert [e["media"]["title"] for e in perfil["excluded"]] == ["Matrix"]
    assert "Matrix" not in {t["media"]["title"] for t in perfil["titles"]}
    matrix = media_id_by_title(client, user_headers, "Matrix")
    assert matrix not in user_signals(db, me_id(client, user_headers))
    # continua no diário e fora do feed
    assert any(e["media"]["title"] == "Matrix" for e in client.get("/diary", headers=user_headers).json())
    feed = client.get("/recommendations", params={"limit": 20}, headers=user_headers).json()["items"]
    assert all(r["media"]["id"] != matrix for r in feed)


def test_ajuste_aparece_no_perfil_mesmo_fora_do_topo(client, user_headers):
    curtir(client, user_headers, "Matrix")
    client.put("/me/taste/adjustments", json={"kind": "genre", "value": "Faroeste", "weight": 1.5}, headers=user_headers)
    perfil = client.get("/me/taste", headers=user_headers).json()
    faroeste = next(g for g in perfil["genres"] if g["value"] == "Faroeste")
    assert faroeste["weight"] == 1.5 and faroeste["share"] == 0
    assert client.put("/me/taste/adjustments", json={"kind": "outro", "value": "x", "weight": 1}, headers=user_headers).status_code == 422
