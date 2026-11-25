"""Aviso do Quero ver (RFF29): o título guardado que chegou a um serviço da pessoa."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import ListItem, Media
from app.services.providers import merge_providers

NETFLIX = {"service": "Netflix", "kind": "flatrate", "logo": "https://img/n.png", "link": None}
MAX = {"service": "Max", "kind": "flatrate", "logo": None, "link": None}
ALUGUEL = {"service": "Apple TV", "kind": "rent", "logo": None, "link": None}


def media(db, title):
    return db.scalar(select(Media).where(Media.title == title))


def test_guarda_desde_quando_o_titulo_esta_no_servico():
    now = datetime(2026, 11, 25, tzinfo=timezone.utc)
    nunca = Media(type="movie", title="x", providers=[], providers_updated_at=None)
    assert [p["since"] for p in merge_providers(nunca, [NETFLIX], now)] == [None]  # primeira busca: não sabe quando

    antes = Media(type="movie", title="y", providers=[{**NETFLIX, "since": None}], providers_updated_at=now)
    found = merge_providers(antes, [NETFLIX, MAX], now + timedelta(days=7))
    assert found[0]["since"] is None  # já estava: fica a data de antes
    assert found[1]["since"] == (now + timedelta(days=7)).isoformat()  # chegou agora


def test_avisa_o_que_chegou_depois_de_guardar(client, user_headers, db):
    client.put("/me/services", json={"services": ["netflix"]}, headers=user_headers)
    now = datetime.now(timezone.utc)
    titulos = {t: media(db, t) for t in ("Interestelar", "Duna", "Matrix", "Dark", "A Origem")}
    for m in titulos.values():
        client.post(f"/recommendations/{m.id}/feedback", json={"action": "want"}, headers=user_headers)
    for item in db.scalars(select(ListItem)):
        item.added_at = now - timedelta(days=10)
    titulos["Interestelar"].providers = [{**NETFLIX, "since": (now - timedelta(days=2)).isoformat()}]  # chegou
    titulos["Duna"].providers = [{**NETFLIX, "since": (now - timedelta(days=20)).isoformat()}]  # já estava ao guardar
    titulos["Matrix"].providers = [{**MAX, "since": (now - timedelta(days=1)).isoformat()}]  # serviço que não é dela
    titulos["Dark"].providers = [{**NETFLIX, "since": None}]  # não se sabe quando chegou
    titulos["A Origem"].providers = [{**ALUGUEL, "since": (now - timedelta(days=1)).isoformat()}]  # só aluguel
    db.commit()

    avisos = client.get("/me/watchlist/arrivals", headers=user_headers).json()
    assert [a["media"]["title"] for a in avisos] == ["Interestelar"]
    assert avisos[0]["service"] == {"key": "netflix", "label": "Netflix", "logo": "https://img/n.png"}

    client.post(f"/recommendations/{titulos['Interestelar'].id}/feedback", json={"action": "seen"}, headers=user_headers)
    assert client.get("/me/watchlist/arrivals", headers=user_headers).json() == []  # viu: sai do Quero ver e do aviso
    assert client.get("/me/watchlist/arrivals").status_code == 401


def test_sem_servicos_marcados_nao_ha_aviso(client, user_headers, db):
    m = media(db, "Interestelar")
    client.post(f"/recommendations/{m.id}/feedback", json={"action": "want"}, headers=user_headers)
    m.providers = [{**NETFLIX, "since": datetime.now(timezone.utc).isoformat()}]
    db.commit()
    assert client.get("/me/watchlist/arrivals", headers=user_headers).json() == []
