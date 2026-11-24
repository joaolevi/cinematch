"""Meus serviços (RFF21), a ocasião e o "Hoje à noite" (RFF20) e o Quero ver ordenado pelo que combina agora (RFF22)."""

from datetime import datetime, timezone

import httpx
import pytest
from sqlalchemy import select

from app.models import Media
from app.services.moods import DARK, HEAVY_MOODS, OCCASIONS_BY_KEY, fits_occasion
from app.services.providers import fill_providers
from app.services.streaming import service_key
from app.services.tmdb import TmdbCatalogProvider

NETFLIX = [{"service": "Netflix Standard with Ads", "kind": "flatrate", "logo": None, "link": None}]
MAX = [{"service": "HBO Max Amazon Channel", "kind": "flatrate", "logo": None, "link": None}]
ALUGUEL = [{"service": "Netflix", "kind": "rent", "logo": None, "link": None}]


def media(db, title) -> Media:
    return db.scalar(select(Media).where(Media.title == title))


@pytest.fixture()
def onde_assistir(db):
    """Alguns títulos do catálogo de exemplo, com onde assistir já guardado."""
    for title, providers in (
        ("Interestelar", NETFLIX), ("A Origem", NETFLIX), ("Breaking Bad", NETFLIX + MAX), ("Matrix", MAX),
        ("Blade Runner 2049", ALUGUEL),
    ):
        media(db, title).providers = providers
    db.commit()


def test_nomes_do_tmdb_viram_os_servicos_da_lista():
    assert service_key("Netflix Standard with Ads") == "netflix"
    assert service_key("Amazon Prime Video with Ads") == "prime"
    assert service_key("HBO Max Amazon Channel") == "max"
    assert service_key("Telecine Amazon Channel") == "telecine"  # canal: conta o serviço do canal
    assert service_key("Paramount+ Amazon Channel") == "paramount"
    assert service_key("Disney Plus") == "disney"
    assert service_key("Apple TV Store") is None  # loja: aluguel e compra
    assert service_key("Amazon Video") is None
    assert service_key("Serviço Desconhecido") is None


def test_marcar_meus_servicos(client, user_headers, onde_assistir):
    lista = {s["key"]: s for s in client.get("/media/services", headers=user_headers).json()}
    assert lista["netflix"]["label"] == "Netflix" and lista["netflix"]["count"] == 3  # aluguel não conta
    assert lista["max"]["count"] == 2

    r = client.put("/me/services", json={"services": ["max", "netflix", "max"]}, headers=user_headers)
    assert r.status_code == 200 and r.json()["services"] == ["netflix", "max"]  # sem repetir, na ordem da lista
    assert client.put("/me/services", json={"services": ["orkut"]}, headers=user_headers).status_code == 422
    assert client.put("/me/services", json={"services": []}, headers=user_headers).json()["services"] == []


def test_so_o_que_eu_tenho(client, user_headers, onde_assistir):
    client.put("/me/services", json={"services": ["netflix"]}, headers=user_headers)
    feed = client.get("/recommendations", params={"only_mine": True, "limit": 50}, headers=user_headers).json()["items"]
    assert {r["media"]["title"] for r in feed} == {"Interestelar", "A Origem", "Breaking Bad"}
    assert all(r["services"] == ["Netflix"] for r in feed)

    tudo = client.get("/recommendations", params={"limit": 50}, headers=user_headers).json()["items"]
    matrix = [r for r in tudo if r["media"]["title"] == "Matrix"]
    assert matrix and matrix[0]["services"] == []  # está no Max, que a pessoa não marcou

    client.put("/me/services", json={"services": []}, headers=user_headers)
    vazio = client.get("/recommendations", params={"only_mine": True}, headers=user_headers).json()["items"]
    assert vazio == []


def test_ocasiao_em_familia_tira_o_que_e_pesado(client, user_headers):
    assert [o["key"] for o in client.get("/media/occasions", headers=user_headers).json()] == ["a-dois", "amigos", "familia"]
    feed = client.get("/recommendations", params={"occasion": "familia", "limit": 50}, headers=user_headers).json()["items"]
    assert feed
    familia = OCCASIONS_BY_KEY["familia"]
    for r in feed:
        assert not set(r["media"]["genres"]) & set(DARK)
        assert not set(r["media"]["moods"]) & HEAVY_MOODS
        assert "Família" in r["media"]["genres"] or "Animação" in r["media"]["genres"] or r["media"]["type"] == "album"
    assert client.get("/recommendations", params={"occasion": "festa"}, headers=user_headers).json()["items"] == []


def test_hoje_a_noite_junta_servicos_e_duracao(client, user_headers, onde_assistir, db):
    for title, minutes in (("Interestelar", 169), ("A Origem", 148), ("Breaking Bad", 47)):
        media(db, title).duration_min = minutes
    db.commit()
    client.put("/me/services", json={"services": ["netflix"]}, headers=user_headers)
    feed = client.get("/recommendations", params={"only_mine": True, "max_minutes": 150}, headers=user_headers).json()
    assert {r["media"]["title"] for r in feed["items"]} == {"A Origem", "Breaking Bad"}


def test_quero_ver_ordenado_pelo_que_combina_agora(client, user_headers, onde_assistir, db):
    for title in ("Interestelar", "A Origem"):
        client.post("/diary", json={"media_id": media(db, title).id, "rating": 5}, headers=user_headers)
    salvos = ("Matrix", "Blade Runner 2049", "Diário de uma Paixão", "Breaking Bad")
    for title in salvos:
        client.post("/recommendations/" + str(media(db, title).id) + "/feedback", json={"action": "want"}, headers=user_headers)

    agora = client.get("/recommendations/watchlist", headers=user_headers).json()
    assert {r["media"]["title"] for r in agora["items"]} == set(salvos) and agora["later"] == []
    ordem = [r["media"]["title"] for r in agora["items"]]
    for r in agora["items"]:  # nenhum título explica a si mesmo
        assert r["media"]["title"] not in r["reason"]
    assert ordem.index("Blade Runner 2049") < ordem.index("Diário de uma Paixão")  # ficção como o que ela curtiu

    media(db, "Matrix").duration_min = 136
    media(db, "Breaking Bad").duration_min = 47
    db.commit()
    curto = client.get("/recommendations/watchlist", params={"max_minutes": 60}, headers=user_headers).json()
    assert [r["media"]["title"] for r in curto["items"]] == ["Breaking Bad"]
    assert len(curto["later"]) == 3

    client.put("/me/services", json={"services": ["max"]}, headers=user_headers)
    meus = client.get("/recommendations/watchlist", params={"only_mine": True}, headers=user_headers).json()
    assert {r["media"]["title"] for r in meus["items"]} == {"Matrix", "Breaking Bad"}
    assert all(r["services"] == ["Max"] for r in meus["items"])


def test_buscar_onde_assistir_de_todo_o_catalogo(db):
    filme = Media(type="movie", source="tmdb", external_id="movie-157336", title="Do TMDB", overview="x",
                  genres=[], tags=[], creators=[], popularity=1)
    fresco = Media(type="movie", source="tmdb", external_id="movie-1", title="Fresco", overview="x", genres=[],
                   tags=[], creators=[], popularity=1, providers=MAX, providers_updated_at=datetime.now(timezone.utc))
    db.add_all([filme, fresco])
    db.commit()
    resposta = {"results": {"BR": {"flatrate": [{"provider_name": "Netflix", "display_priority": 1}]}}}
    client = httpx.Client(base_url="https://api.themoviedb.org/3",
                          transport=httpx.MockTransport(lambda r: httpx.Response(200, json=resposta)))
    result = fill_providers(db, TmdbCatalogProvider("chave-teste", region="BR", client=client))
    assert result["atualizados"] == 1 and result["falhas"] == 0  # o fresco e os do catálogo offline ficam
    assert filme.providers[0]["service"] == "Netflix" and fresco.providers == MAX


def test_em_familia_barra_o_que_e_adulto_mesmo_sem_genero_de_terror():
    from app.services.moods import moods_for

    def titulo(genres, tags=(), moods=None, type="series"):
        m = Media(type=type, title="x", genres=list(genres), tags=list(tags))
        m.moods = moods_for(m) if moods is None else moods
        return m

    familia = OCCASIONS_BY_KEY["familia"]
    assert fits_occasion(titulo(["Animação", "Família", "Comédia"]), familia)
    adulta = titulo(["Animação", "Comédia", "Ficção Científica"], ["humor ácido"])
    assert "familia" not in adulta.moods and not fits_occasion(adulta, familia)
    zumbis = titulo(["Ação", "Aventura", "Drama"], ["zumbis"], moods=["aventureiro", "sombrio"])
    assert not fits_occasion(zumbis, familia)
    assert not fits_occasion(titulo(["Ação", "Aventura"], moods=["aventureiro"]), familia)  # nem família nem animação
    # série animada sem o gênero Família fica de fora; filme de animação entra
    assert not fits_occasion(titulo(["Animação", "Comédia", "Drama"]), familia)
    assert fits_occasion(titulo(["Animação", "Aventura"], type="movie"), familia)
