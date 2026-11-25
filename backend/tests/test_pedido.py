"""Pedido em português (RFF25): o texto vira os filtros do momento, sem IA."""

import pytest

from app.services.wish import PHRASES, understand
from app.services.moods import BY_KEY as MOODS, OCCASIONS_BY_KEY


def filtros(pedido):
    r = understand(pedido)
    return {k: v for k, v in r.items() if v and k not in ("understood", "ignored")}


@pytest.mark.parametrize("pedido, esperado", [
    ("Algo leve para a Sessão da Tarde", {"mood": "leve", "occasion": "familia", "type": "movie"}),
    ("um terror pra ver com a galera, até 1h30", {"mood": "assustador", "occasion": "amigos", "max_minutes": 90}),
    ("não quero nada pesado, só uma série curtinha", {"mood": "leve", "type": "series", "max_minutes": 90}),
    ("disco pra dançar", {"type": "album", "mood": "dancante"}),
    ("algo diferente até 2 horas e meia", {"discovery": "outside", "max_minutes": 150}),
    ("um filme de 100 minutos", {"type": "movie", "max_minutes": 100}),
    ("hoje à noite com o mozão", {"max_minutes": 150, "only_mine": True, "occasion": "a-dois"}),
    ("QUALQUER COISA", {}),
])
def test_pedido_vira_filtros(pedido, esperado):
    assert filtros(pedido) == esperado


def test_mostra_o_trecho_como_foi_escrito():
    r = understand("Algo leve para a Sessão da Tarde")
    assert r["understood"] == [{"text": "leve", "labels": ["Leve"]},
                               {"text": "Sessão da Tarde", "labels": ["Em família", "Filmes"]}]


def test_negacao_tira_o_clima_mas_nao_passa_do_e():
    r = understand("filme sem terror e divertido")
    assert r["mood"] == "divertido"
    assert r["ignored"] == ["terror: o pedido só escolhe climas, não tira"]


def test_um_valor_por_filtro_vale_o_primeiro():
    r = understand("um suspense e um terror")
    assert r["mood"] == "tenso" and r["ignored"] == ["terror: já escolhi Tenso, e o filtro aceita um só"]


def test_expressao_mais_longa_vence():
    assert filtros("filme cabeça") == {"mood": "reflexivo", "type": "movie"}
    assert filtros("sem pensar") == {"mood": "leve"}  # não é "pensar" negado


def test_dicionario_so_usa_climas_e_ocasioes_que_existem():
    for wish in PHRASES.values():
        assert wish.fields
        assert wish.mood is None or wish.mood in MOODS
        assert wish.occasion is None or wish.occasion in OCCASIONS_BY_KEY


def test_rota_do_pedido(client, user_headers):
    r = client.get("/recommendations/understand", params={"q": "uma comédia curtinha"}, headers=user_headers)
    assert r.status_code == 200
    assert r.json()["mood"] == "divertido" and r.json()["max_minutes"] == 90
    assert client.get("/recommendations/understand", params={"q": ""}, headers=user_headers).status_code == 422
    assert client.get("/recommendations/understand", params={"q": "x" * 201}, headers=user_headers).status_code == 422
    assert client.get("/recommendations/understand", params={"q": "leve"}).status_code == 401
