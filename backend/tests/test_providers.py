"""Onde assistir no Brasil (RFF19), sem rede: o TMDB é simulado."""

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.config import settings
from app.models import Media
from app.services import providers as providers_service
from app.services.tmdb import TmdbCatalogProvider

RESPOSTA = {"results": {"BR": {
    "link": "https://www.themoviedb.org/movie/157336/watch?locale=BR",
    "flatrate": [{"provider_name": "Max", "logo_path": "/max.jpg", "display_priority": 2},
                 {"provider_name": "Netflix", "logo_path": "/nf.jpg", "display_priority": 1}],
    "rent": [{"provider_name": "Apple TV", "logo_path": None, "display_priority": 5}],
}, "US": {"flatrate": [{"provider_name": "Hulu"}]}}}


@pytest.fixture()
def filme_do_tmdb(db):
    m = Media(type="movie", source="tmdb", external_id="movie-157336", title="Interestelar (TMDB)", overview="x",
              genres=[], tags=[], creators=[], popularity=90)
    db.add(m)
    db.commit()
    return m


@pytest.fixture()
def tmdb_falso(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(200, json=RESPOSTA)

    def factory():
        return TmdbCatalogProvider("chave-teste", region="BR", client=httpx.Client(
            transport=httpx.MockTransport(handler), base_url="https://api.themoviedb.org/3"))

    monkeypatch.setattr(providers_service, "_client", factory)
    monkeypatch.setattr(providers_service, "settings", type(settings)(tmdb_api_key="chave-teste"))
    return calls


def test_busca_no_tmdb_e_guarda(client, user_headers, filme_do_tmdb, tmdb_falso):
    found = client.get(f"/media/{filme_do_tmdb.id}/providers", headers=user_headers).json()
    assert [(p["service"], p["kind"]) for p in found] == [("Netflix", "flatrate"), ("Max", "flatrate"), ("Apple TV", "rent")]
    assert found[0]["logo"].endswith("/nf.jpg") and found[0]["link"].startswith("https://www.themoviedb.org/")
    assert tmdb_falso == ["/3/movie/157336/watch/providers"]
    client.get(f"/media/{filme_do_tmdb.id}/providers", headers=user_headers)
    assert len(tmdb_falso) == 1  # guardado: não busca de novo


def test_busca_de_novo_depois_de_uma_semana(client, user_headers, db, filme_do_tmdb, tmdb_falso):
    filme_do_tmdb.providers = [{"service": "Antigo", "kind": "buy", "logo": None, "link": None}]
    filme_do_tmdb.providers_updated_at = datetime.now(timezone.utc) - timedelta(days=8)
    db.commit()
    found = client.get(f"/media/{filme_do_tmdb.id}/providers", headers=user_headers).json()
    assert found[0]["service"] == "Netflix" and len(tmdb_falso) == 1


def test_fora_do_tmdb_ou_album_vem_vazio(client, user_headers, db, tmdb_falso):
    offline = db.query(Media).filter_by(title="Interestelar").one()  # catálogo offline do seed
    assert client.get(f"/media/{offline.id}/providers", headers=user_headers).json() == []
    assert tmdb_falso == []
    assert client.get("/media/999999/providers", headers=user_headers).status_code == 404
