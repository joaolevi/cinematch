"""Quem vê meus registros (RFF10), consentimento no cadastro (RNFF08), créditos das fontes (RNFF02) e adicionar
títulos sem o admin (RFF13)."""

import httpx
import pytest
from sqlalchemy import select

from app.models import Media, User
from app.routers import external as external_router
from app.services import add_quota
from app.services.tmdb import TmdbCatalogProvider

from .conftest import register
from .test_albums import GENRES, RG_ID, FakeServer, make_client
from .test_tmdb_unit import fake_tmdb


def media_id(db, title):
    return db.scalar(select(Media.id).where(Media.title == title))


def me(client, headers):
    return client.get("/me", headers=headers).json()["id"]


@pytest.fixture()
def tres_pessoas(client, db):
    """Ana registra Interestelar com resenha; Bia e Caio olham."""
    ana = register(client, "Ana", "ana@teste.com")
    bia = register(client, "Bia", "bia@teste.com")
    caio = register(client, "Caio", "caio@teste.com")
    r = client.post("/diary", json={"media_id": media_id(db, "Interestelar"), "rating": 5, "review": "Lindo"}, headers=ana)
    assert r.status_code == 201
    return ana, bia, caio


def na_comunidade(client, headers):
    return [e["user_name"] for e in client.get("/community", headers=headers).json()["items"]]


def resenhas(client, headers, db):
    return [r["user_name"] for r in client.get(f"/media/{media_id(db, 'Interestelar')}", headers=headers).json()["reviews"]]


# ---------------------------------------------------------------- RFF10
def test_quem_me_segue_ve_e_quem_nao_segue_nao(client, db, tres_pessoas):
    ana, bia, caio = tres_pessoas
    assert "Ana" in na_comunidade(client, bia)
    r = client.put("/me/visibility", json={"visibility": "followers"}, headers=ana)
    assert r.status_code == 200 and r.json()["visibility"] == "followers"

    client.put(f"/users/{me(client, ana)}/follow", headers=bia)
    assert "Ana" in na_comunidade(client, bia) and "Ana" in resenhas(client, bia, db)
    assert "Ana" not in na_comunidade(client, caio) and "Ana" not in resenhas(client, caio, db)
    assert "Ana" in na_comunidade(client, ana)  # a própria pessoa sempre vê o que é dela

    perfil = client.get(f"/users/{me(client, ana)}", headers=caio).json()
    assert perfil["restricted"] and perfil["recent"] == [] and perfil["compatibility"] is None
    assert perfil["followers"] == 1  # o nome e os números continuam
    assert not client.get(f"/users/{me(client, ana)}", headers=bia).json()["restricted"]
    assert client.get(f"/users/{me(client, ana)}/together", headers=caio).status_code == 403


def test_so_eu_esconde_de_todo_mundo(client, db, tres_pessoas):
    ana, bia, _ = tres_pessoas
    client.put(f"/users/{me(client, ana)}/follow", headers=bia)
    client.put("/me/visibility", json={"visibility": "private"}, headers=ana)
    assert "Ana" not in na_comunidade(client, bia) and "Ana" not in resenhas(client, bia, db)
    assert client.get(f"/users/{me(client, ana)}", headers=bia).status_code == 404
    assert "Ana" not in [r["name"] for r in client.get("/community/reviewers", headers=bia).json()]

    client.put("/me/visibility", json={"visibility": "all"}, headers=ana)
    assert "Ana" in na_comunidade(client, bia)


def test_visibilidade_invalida_da_422(client, user_headers):
    assert client.put("/me/visibility", json={"visibility": "amigos"}, headers=user_headers).status_code == 422
    assert client.get("/me", headers=user_headers).json()["visibility"] == "all"


# ---------------------------------------------------------------- RNFF08
def test_cadastro_guarda_o_consentimento_dos_experimentos(client, db):
    r = client.post("/auth/register", json={"name": "Sem", "email": "sem@teste.com", "password": "segredo1",
                                            "in_experiments": False})
    assert r.status_code == 201 and r.json()["user"]["in_experiments"] is False
    assert db.scalar(select(User.in_experiments).where(User.email == "sem@teste.com")) is False
    r = client.post("/auth/register", json={"name": "Com", "email": "com@teste.com", "password": "segredo1",
                                            "in_experiments": True})
    assert r.json()["user"]["in_experiments"] is True


# ---------------------------------------------------------------- RNFF02
def test_detalhe_traz_a_fonte_e_a_licenca(client, user_headers, db):
    mock = client.get(f"/media/{media_id(db, 'Interestelar')}", headers=user_headers).json()["credit"]
    assert mock["name"] == "Catálogo de exemplo do Tastory" and mock["url"] is None

    tmdb = Media(type="series", source="tmdb", external_id="tv-1396", title="Série do TMDB", overview="x",
                 genres=[], tags=[], creators=[], popularity=1)
    album = Media(type="album", source="musicbrainz", external_id=f"album-{RG_ID}", title="Disco", overview="x",
                  genres=[], tags=[], creators=[], popularity=1)
    db.add_all([tmdb, album])
    db.commit()
    credit = client.get(f"/media/{tmdb.id}", headers=user_headers).json()["credit"]
    assert credit["url"] == "https://www.themoviedb.org/tv/1396" and "não é endossado" in credit["license"]
    credit = client.get(f"/media/{album.id}", headers=user_headers).json()["credit"]
    assert credit["url"] == f"https://musicbrainz.org/release-group/{RG_ID}" and "CC0" in credit["license"]


# ---------------------------------------------------------------- RFF13
@pytest.fixture()
def fontes_falsas(monkeypatch):
    def tmdb():
        client = httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(fake_tmdb))
        return TmdbCatalogProvider("chave-teste", pages=1, client=client, max_workers=2)

    monkeypatch.setattr("app.services.musicbrainz.load_genre_map", lambda path=None: GENRES)
    monkeypatch.setattr(external_router, "tmdb_client", tmdb)
    monkeypatch.setattr(external_router, "musicbrainz_client", lambda: make_client(FakeServer()))


def test_pessoa_busca_e_traz_um_filme_do_tmdb(client, user_headers, fontes_falsas):
    found = client.get("/external/search", params={"q": "batman"}, headers=user_headers).json()
    assert found[0]["external_id"] == "movie-155"
    r = client.post("/external/import", json={"external_id": "movie-155"}, headers=user_headers)
    assert r.status_code == 201, r.text
    assert r.json()["source"] == "tmdb" and r.json()["title"] == "Batman: O Cavaleiro das Trevas"
    again = client.post("/external/import", json={"external_id": "movie-155"}, headers=user_headers)
    assert again.status_code == 200 and again.json()["id"] == r.json()["id"]  # já estava: não importa de novo
    assert client.get("/external/search", params={"q": "batman"}, headers=user_headers).json()[0]["media_id"] == r.json()["id"]


def test_pessoa_traz_um_album_do_musicbrainz(client, user_headers, fontes_falsas):
    found = client.get("/external/search", params={"q": "tropicalia", "type": "album"}, headers=user_headers).json()
    assert found[0]["external_id"] == f"album-{RG_ID}" and found[0]["media_id"] is None
    r = client.post("/external/import", json={"external_id": f"album-{RG_ID}"}, headers=user_headers)
    assert r.status_code == 201 and r.json()["type"] == "album"


def test_limite_de_titulos_por_dia(client, user_headers, fontes_falsas, monkeypatch):
    monkeypatch.setattr(add_quota, "MAX_PER_DAY", 1)
    assert client.post("/external/import", json={"external_id": "tv-1396"}, headers=user_headers).status_code == 201
    r = client.post("/external/import", json={"external_id": "movie-603"}, headers=user_headers)
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 0
    # o que já está no catálogo não gasta o limite
    assert client.post("/external/import", json={"external_id": "tv-1396"}, headers=user_headers).status_code == 200
    outra = register(client, "Outra", "outra@teste.com")
    assert client.post("/external/import", json={"external_id": "movie-603"}, headers=outra).status_code == 201


def test_id_externo_invalido_ou_inexistente(client, user_headers, fontes_falsas):
    assert client.post("/external/import", json={"external_id": "person-1"}, headers=user_headers).status_code == 422
    assert client.post("/external/import", json={"external_id": "movie-424242"}, headers=user_headers).status_code == 404
    assert client.get("/external/search", params={"q": "x"}, headers=user_headers).status_code == 422  # curto demais
    assert client.get("/external/search", params={"q": "batman"}).status_code == 401
