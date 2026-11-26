"""Página do episódio e da faixa, com "visto" ou "ouvi" além das estrelas."""

import pytest
from sqlalchemy import select

from app.models import DiaryEntry, Media
from app.services import tracks as tracks_service

from .conftest import register
from .test_episodios import serie

FAIXAS = {
    "media": [
        {"position": 1, "tracks": [
            {"position": 1, "title": "Tudo que você podia ser", "length": 176400,
             "artist-credit": [{"name": "Milton Nascimento", "artist": {"id": "a"}}]},
            {"position": 2, "title": "Cais", "length": 165333,
             "artist-credit": [{"name": "Milton Nascimento", "artist": {"id": "a"}}]},
        ]},
        {"position": 2, "tracks": [
            {"position": 1, "title": "Paisagem da janela", "recording": {"length": 178000},
             "artist-credit": [{"name": "Lô Borges", "artist": {"id": "b"}}]},
        ]},
    ]
}


@pytest.fixture()
def album(db, monkeypatch):
    """Um álbum do MusicBrainz, com as faixas fixas em vez da rede."""
    media = Media(type="album", title="Clube da Esquina", year=1972, source="musicbrainz",
                  external_id="album-b29e94e7-0b0b-3a66-ab06-e02f", genres=["MPB"])
    db.add(media)
    db.commit()
    tracks_service._cache.clear()
    calls = []
    monkeypatch.setattr(tracks_service, "_fetch", lambda mbid: calls.append(mbid) or
                        tracks_service.tracks_from_release(FAIXAS))
    media.calls = calls
    return media


def test_episodio_visto_sem_nota_e_desmarcar(client, user_headers, db):
    dark = serie(db)
    r = client.put(f"/media/{dark.id}/seasons/1/episodes/1", json={"seen": True}, headers=user_headers)
    assert r.json() == {"number": 1, "seen": True, "rating": None, "note": None}
    ep1 = client.get(f"/media/{dark.id}/seasons/1/episodes", headers=user_headers).json()[0]
    assert ep1["seen"] and ep1["rating"] is None
    assert client.get(f"/media/{dark.id}", headers=user_headers).json()["my_status"]["status"] == "watching"

    client.put(f"/media/{dark.id}/seasons/1/episodes/1", json={"rating": 4}, headers=user_headers)
    r = client.put(f"/media/{dark.id}/seasons/1/episodes/1", json={"seen": False, "rating": 4}, headers=user_headers)
    assert r.json() == {"number": 1, "seen": False, "rating": None, "note": None}  # desmarcar apaga a nota


def test_pagina_do_episodio_com_vizinhos_e_media(client, user_headers, db):
    dark = serie(db)
    ana = register(client, "Ana", "ana@teste.com")
    client.put(f"/media/{dark.id}/seasons/1/episodes/3", json={"rating": 5, "note": "Só minha"}, headers=user_headers)
    client.put(f"/media/{dark.id}/seasons/1/episodes/3", json={"rating": 4}, headers=ana)

    ep = client.get(f"/media/{dark.id}/seasons/1/episodes/3", headers=ana).json()
    assert (ep["season"], ep["number"], ep["series"]["title"]) == (1, 3, "Dark")
    assert (ep["seen_by"], ep["ratings"], ep["average"]) == (2, 2, 4.5)
    assert ep["note"] is None and ep["rating"] == 4  # a anotação de outra pessoa não aparece
    assert ep["previous"]["number"] == 2 and ep["next"] == {"season": 2, "number": 1, "name": None}

    primeiro_da_2 = client.get(f"/media/{dark.id}/seasons/2/episodes/1", headers=ana).json()
    assert primeiro_da_2["previous"] == {"season": 1, "number": 3, "name": None}
    assert client.get(f"/media/{dark.id}/seasons/1/episodes/9", headers=ana).status_code == 404


def test_marcar_a_temporada_inteira(client, user_headers, db):
    dark = serie(db)
    client.put(f"/media/{dark.id}/seasons/1/episodes/2", json={"rating": 3, "note": "Lento"}, headers=user_headers)
    lista = client.post(f"/media/{dark.id}/seasons/1/seen", headers=user_headers).json()
    assert [e["seen"] for e in lista] == [True, True, True]
    assert (lista[1]["rating"], lista[1]["note"]) == (3, "Lento")  # quem já tinha nota continua com ela
    assert client.post(f"/media/{dark.id}/seasons/1/seen", headers=user_headers).status_code == 200  # de novo, sem erro
    assert client.get(f"/media/{dark.id}", headers=user_headers).json()["my_status"]["episodes"] == {"1": 3}


def test_faixas_do_album_e_pagina_da_faixa(client, user_headers, db, album):
    faixas = client.get(f"/media/{album.id}/tracks", headers=user_headers).json()
    assert [(f["disc"], f["number"], f["title"]) for f in faixas] == [
        (1, 1, "Tudo que você podia ser"), (1, 2, "Cais"), (2, 1, "Paisagem da janela")]
    assert faixas[0]["length_sec"] == 176 and faixas[2]["length_sec"] == 178
    assert faixas[2]["artists"] == ["Lô Borges"]

    r = client.put(f"/media/{album.id}/tracks/1/2", json={"seen": True, "rating": 5}, headers=user_headers)
    assert r.json() == {"number": 2, "seen": True, "rating": 5, "note": None}
    pagina = client.get(f"/media/{album.id}/tracks/1/2", headers=user_headers).json()
    assert (pagina["position"], pagina["total"], pagina["discs"]) == (2, 3, 2)
    assert pagina["previous"]["title"] == "Tudo que você podia ser" and pagina["next"]["disc"] == 2
    assert pagina["seen"] and (pagina["seen_by"], pagina["average"]) == (1, 5)
    assert pagina["album"]["title"] == "Clube da Esquina"

    # Ouvir uma faixa não põe o álbum no diário, e a lista vem do cache: uma busca só no MusicBrainz
    assert db.scalar(select(DiaryEntry).where(DiaryEntry.media_id == album.id)) is None
    assert len(album.calls) == 1


def test_faixas_validam_album_e_faixa(client, user_headers, db, album):
    filme = db.scalar(select(Media.id).where(Media.title == "Matrix"))
    assert client.get(f"/media/{filme}/tracks", headers=user_headers).status_code == 404
    assert client.get(f"/media/{album.id}/tracks/1/9", headers=user_headers).status_code == 404
    assert client.put(f"/media/{album.id}/tracks/3/1", json={"seen": True}, headers=user_headers).status_code == 404
    assert client.put(f"/media/{album.id}/tracks/1/1", json={"rating": 7}, headers=user_headers).status_code == 422
    assert client.get(f"/media/{album.id}/tracks").status_code == 401


def test_album_sem_musicbrainz_tem_lista_vazia(client, user_headers, db):
    media = Media(type="album", title="Disco do mock", year=2000, source="mock", external_id="mock-a-1", genres=[])
    db.add(media)
    db.commit()
    assert client.get(f"/media/{media.id}/tracks", headers=user_headers).json() == []


def test_continuar_ouvindo(client, user_headers, db, album):
    assert client.get("/me/listening", headers=user_headers).json() == []
    client.put(f"/media/{album.id}/tracks/1/1", json={"seen": True}, headers=user_headers)
    item = client.get("/me/listening", headers=user_headers).json()[0]
    assert (item["media"]["title"], item["heard"], item["total"]) == ("Clube da Esquina", 1, 3)
    assert item["next_track"] == {"disc": 1, "number": 2, "title": "Cais"}

    # Sem a lista na memória da API, o disco continua aparecendo, só sem o total
    tracks_service._cache.clear()
    item = client.get("/me/listening", headers=user_headers).json()[0]
    assert item["heard"] == 1 and item["total"] is None and item["next_track"] is None

    client.post("/diary", json={"media_id": album.id, "rating": 5}, headers=user_headers)  # Já ouvi
    assert client.get("/me/listening", headers=user_headers).json() == []
    assert client.get("/me/listening").status_code == 401
