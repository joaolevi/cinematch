"""Quem seguir (RFF15), logos dos serviços nas sugestões (RFF19), o próprio histórico de atividades (RFF31) e o desafio
do tema do mês, com selo e troca mensal (RFF32)."""

import json
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import select

from app.models import Media, UserList
from app.services import theme as theme_service
from app.services.theme import all_themes, challenge, current_theme, load_theme

from .conftest import register


def media_id(db, title):
    return db.scalar(select(Media.id).where(Media.title == title))


def me(client, headers):
    return client.get("/me", headers=headers).json()["id"]


def curtir(client, headers, db, *titles):
    for title in titles:
        r = client.post("/diary", json={"media_id": media_id(db, title), "rating": 5}, headers=headers)
        assert r.status_code == 201, r.text


# ---------------------------------------------------------------- RFF15
def test_sugere_quem_seguir_pelo_gosto(client, user_headers, db):
    curtir(client, user_headers, db, "Interestelar", "A Origem", "Matrix")
    gemea = register(client, "Gêmea", "gemea@teste.com")
    curtir(client, gemea, db, "Interestelar", "A Origem", "Matrix")
    oposta = register(client, "Oposta", "oposta@teste.com")
    curtir(client, oposta, db, "Diário de uma Paixão")
    register(client, "Sem Nada", "nada@teste.com")
    privada = register(client, "Privada", "privada@teste.com")
    curtir(client, privada, db, "Interestelar", "A Origem")
    client.put("/me/visibility", json={"visibility": "followers"}, headers=privada)

    sugeridas = client.get("/users/suggestions", headers=user_headers).json()
    assert [s["name"] for s in sugeridas] == ["Gêmea"]  # sem a oposta, quem não registrou nada e quem não mostra
    assert sugeridas[0]["percent"] == 100 and sugeridas[0]["label"] == "Gostos quase gêmeos"
    client.put(f"/users/{sugeridas[0]['id']}/follow", headers=user_headers)
    assert client.get("/users/suggestions", headers=user_headers).json() == []  # quem já sigo sai
    assert client.get("/users/suggestions", headers=register(client, "Nova", "nova@teste.com")).json() == []
    assert client.get("/users/suggestions").status_code == 401


# ---------------------------------------------------------------- RFF19
def test_sugestao_traz_os_logos_dos_servicos(client, user_headers, db):
    curtir(client, user_headers, db, "A Origem")
    db.scalar(select(Media).where(Media.title == "Interestelar")).providers = [
        {"service": "Netflix Standard with Ads", "kind": "flatrate", "logo": "https://img/netflix.png", "link": None},
        {"service": "Max", "kind": "flatrate", "logo": "https://img/max.png", "link": None},
        {"service": "Apple TV Store", "kind": "rent", "logo": "https://img/apple.png", "link": None},
        {"service": "Oldflix", "kind": "flatrate", "logo": "https://img/oldflix.png", "link": None},
    ]
    db.commit()
    feed = client.get("/recommendations", params={"limit": 50}, headers=user_headers).json()["items"]
    inter = next(r for r in feed if r["media"]["title"] == "Interestelar")
    assert inter["streaming"] == [  # só assinatura e só os serviços da lista, na ordem dela
        {"key": "netflix", "label": "Netflix", "logo": "https://img/netflix.png"},
        {"key": "max", "label": "Max", "logo": "https://img/max.png"},
    ]


# ---------------------------------------------------------------- RFF31
def test_historico_de_atividades(client, user_headers, db):
    outra = register(client, "Ana", "ana@teste.com")
    resenha = client.post("/diary", json={"media_id": media_id(db, "Matrix"), "rating": 4, "review": "Clássico"},
                          headers=outra).json()["id"]
    client.post("/diary", json={"media_id": media_id(db, "Interestelar"), "rating": 5, "review": "Lindo"},
                headers=user_headers)
    client.post("/diary", json={"media_id": media_id(db, "Dark")}, headers=user_headers)
    client.post(f"/recommendations/{media_id(db, 'Duna')}/feedback", json={"action": "want"}, headers=user_headers)
    client.put(f"/community/{resenha}/like", headers=user_headers)
    client.post(f"/community/{resenha}/comments", json={"text": "Concordo"}, headers=user_headers)
    client.put(f"/users/{me(client, outra)}/follow", headers=user_headers)

    tudo = client.get("/me/activity", headers=user_headers).json()
    assert [a["kind"] for a in tudo] == ["seguiu", "comentario", "curtida", "lista", "registro", "registro"]
    assert tudo[0]["person"]["name"] == "Ana" and tudo[1]["text"] == "Concordo"
    assert tudo[2]["media"]["title"] == "Matrix" and tudo[2]["person"]["name"] == "Ana"
    assert tudo[3]["list_name"] == "Quero ver" and tudo[3]["media"]["title"] == "Duna"
    datas = [a["at"] for a in tudo]
    assert datas == sorted(datas, reverse=True)

    so = lambda kind: [a["media"]["title"] for a in client.get("/me/activity", params={"kind": kind}, headers=user_headers).json()]  # noqa: E731
    assert so("registros") == ["Dark", "Interestelar"]
    assert so("notas") == ["Interestelar"] and so("resenhas") == ["Interestelar"]
    assert so("listas") == ["Duna"] and so("curtidas") == ["Matrix"]
    assert len(client.get("/me/activity", params={"limit": 2, "offset": 1}, headers=user_headers).json()) == 2
    assert client.get("/me/activity", params={"kind": "outra"}, headers=user_headers).status_code == 422
    assert client.get("/me/activity").status_code == 401


# ---------------------------------------------------------------- RFF32
def temas(tmp_path, *themes):
    path = tmp_path / "temas.json"
    path.write_text(json.dumps({"temas": list(themes)}), encoding="utf-8")
    return path


def tema(mes, titulo, itens, meta=2, selo="Selo"):
    return {"mes": mes, "titulo": titulo, "descricao": "x", "desafio": {"meta": meta, "selo": selo},
            "itens": [{"tipo": "movie", "titulo": t} for t in itens]}


def test_tema_troca_com_o_mes(tmp_path):
    path = temas(tmp_path, tema("2026-12", "Dezembro", []), tema("2026-11", "Novembro", []))
    assert [t["titulo"] for t in all_themes(path)] == ["Novembro", "Dezembro"]
    assert current_theme(path, date(2026, 11, 30))["titulo"] == "Novembro"
    assert current_theme(path, date(2026, 12, 1))["titulo"] == "Dezembro"
    assert current_theme(path, date(2027, 3, 1))["titulo"] == "Dezembro"  # sem tema novo, fica o último
    assert current_theme(path, date(2026, 1, 1))["titulo"] == "Novembro"  # antes de todos, o primeiro


def test_prateleira_troca_sozinha_quando_o_mes_vira(client, user_headers, db, tmp_path, monkeypatch):
    hoje = datetime.now(timezone.utc).date()
    path = temas(tmp_path, tema("2000-01", "Antigo", ["Matrix"]), tema(hoje.strftime("%Y-%m"), "Atual", ["Bacurau"]))
    load_theme(db, path, date(2000, 1, 15))
    assert db.scalar(select(UserList.name).where(UserList.featured.is_(True))) == "Antigo"
    monkeypatch.setattr(theme_service, "THEME_PATH", path)
    shelf = client.get("/lists/featured", headers=user_headers).json()[0]
    assert shelf["name"] == "Atual" and [i["media"]["title"] for i in shelf["items"]] == ["Bacurau"]


def test_desafio_do_mes_e_selo(client, user_headers, db, tmp_path, monkeypatch):
    mes = datetime.now(timezone.utc).strftime("%Y-%m")
    path = temas(tmp_path, tema(mes, "Feito no Nordeste", ["Bacurau", "Central do Brasil", "Cidade de Deus"], meta=2,
                                selo="Nordeste no coração"))
    monkeypatch.setattr(theme_service, "THEME_PATH", path)
    antes = client.get("/lists/featured/challenge", headers=user_headers).json()
    assert antes["goal"] == 2 and antes["done"] == [] and not antes["earned"] and antes["badge"] == "Nordeste no coração"
    assert [m["title"] for m in antes["next"]] == ["Bacurau", "Central do Brasil", "Cidade de Deus"]

    curtir(client, user_headers, db, "Bacurau", "Matrix")
    meio = client.get("/lists/featured/challenge", headers=user_headers).json()
    assert [m["title"] for m in meio["done"]] == ["Bacurau"] and not meio["earned"]
    assert [m["title"] for m in meio["next"]] == ["Central do Brasil", "Cidade de Deus"]  # o que já está no diário sai
    curtir(client, user_headers, db, "Central do Brasil")
    assert client.get("/lists/featured/challenge", headers=user_headers).json()["earned"]

    perfil = client.get(f"/users/{me(client, user_headers)}", headers=user_headers).json()
    assert perfil["badges"] == [{"badge": "Nordeste no coração", "title": "Feito no Nordeste", "month": mes}]


def test_registro_fora_do_mes_nao_conta(db, client, user_headers, tmp_path):
    path = temas(tmp_path, tema("2000-01", "Antigo", ["Bacurau"], meta=1))
    curtir(client, user_headers, db, "Bacurau")  # registrado hoje, não em janeiro de 2000
    result = challenge(db, me(client, user_headers), path, date(2000, 1, 20))
    assert result["done"] == [] and not result["earned"]


@pytest.mark.parametrize("theme", all_themes(), ids=lambda t: t["mes"])
def test_temas_do_repositorio_batem_com_o_catalogo_de_demonstracao(db, tmp_path, theme):
    from app.seed import load_albums

    load_albums(db)
    path = temas(tmp_path, theme)
    assert load_theme(db, path, date.fromisoformat(theme["mes"] + "-15"))["missing"] == []
    assert theme["desafio"]["meta"] <= len(theme["itens"])
