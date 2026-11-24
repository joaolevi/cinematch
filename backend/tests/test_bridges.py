"""Pontes entre mídias (RFF26) e álbuns no feed misto (RFF27, RFF02)."""

import pytest
from sqlalchemy import select

from app.models import Media, MediaBridge
from app.services.bridges import _phrase, _target_title, build_bridges, find_title, mix_albums, weak_link
from app.services.recommender import Recommendation
from .conftest import impressions_of


def album(db, title, creators, year, genres, mbid, countries=("US",)):
    m = Media(type="album", source="musicbrainz", external_id=f"album-{mbid}", title=title, year=year, overview="",
              genres=list(genres), tags=[], creators=list(creators), popularity=50, countries=list(countries))
    db.add(m)
    db.flush()
    return m


def title(db, name) -> Media:
    return db.scalar(select(Media).where(Media.title == name))


@pytest.fixture()
def albums(db, tmp_path):
    """Três discos de Hans Zimmer, a trilha de Cidade de Deus, um disco do Seu Jorge e um de MPB sem ponte forte."""
    a = {
        "interstellar": album(db, "Interstellar", ["Hans Zimmer"], 2014, ["Trilha sonora", "Clássica"], "a1"),
        "inception": album(db, "Inception", ["Hans Zimmer"], 2010, ["Trilha sonora"], "a2"),
        "dune": album(db, "Dune", ["Hans Zimmer"], 2021, ["Trilha sonora"], "a3"),
        "cdd": album(db, "Cidade de Deus", ["Antonio Pinto"], 2002, ["Trilha sonora"], "a4", ["BR"]),
        "seu_jorge": album(db, "Cru", ["Seu Jorge"], 2004, ["MPB"], "a5", ["BR"]),
        "eletronica": album(db, "Random Access Memories", ["Daft Punk"], 2013, ["Eletrônica"], "a6", ["FR"]),
        "sem_filme": album(db, "Sem Filme", ["Ninguém"], 2000, ["Trilha sonora"], "a7"),
    }
    db.commit()
    lista = tmp_path / "albuns.csv"
    lista.write_text(
        "mbid,artista,titulo,ano,motivo\n"
        "a1,Hans Zimmer,Interstellar,2014,trilha: Interestelar\n"
        "a2,Hans Zimmer,Inception,2010,trilha: A Origem\n"
        "a3,Hans Zimmer,Dune,2021,internacional\n"
        "a4,Antonio Pinto,Cidade de Deus,2002,trilha: Cidade de Deus\n"
        "a5,Seu Jorge,Cru,2004,\"mesma pessoa: Seu Jorge, de Cidade de Deus\"\n"
        "a6,Daft Punk,Random Access Memories,2013,internacional\n"
        "a7,Ninguém,Sem Filme,2000,trilha: Um Filme Que Não Existe\n"
        "zz,Fora do banco,Ignorado,2000,trilha: Interestelar\n",
        encoding="utf-8",
    )
    result = build_bridges(db, lista)
    return a, result


# ---------------------------------------------------------------- regras
def test_le_o_motivo_da_lista():
    assert _target_title("trilha: Interestelar") == ("trilha", "Interestelar")
    assert _target_title('trilha: Bacurau usa "Réquiem para Matraga"') == ("trilha", "Bacurau")
    assert _target_title("mesma pessoa: Seu Jorge, de Cidade de Deus") == ("mesma pessoa", "Cidade de Deus")
    assert _target_title("compositor: Django Livre usa Morricone") == ("compositor", "Django Livre")


def test_acha_o_titulo_pelo_nome_ou_pelo_comeco(db):
    videos = list(db.scalars(select(Media)))
    assert find_title(videos, "interestelar").title == "Interestelar"
    assert find_title(videos, "Ex Machina").title.startswith("Ex Machina:")  # o catálogo tem o subtítulo
    assert find_title(videos, "Um Filme Que Não Existe") is None


def test_genero_no_meio_da_frase_mantem_as_siglas():
    assert _phrase("Ficção Científica") == "ficção científica"
    assert _phrase("MPB") == "MPB" and _phrase("Soul, R&B e funk") == "soul, R&B e funk"


def test_ponte_fraca_precisa_de_dois_sinais(db, albums):
    a, _ = albums
    interestelar = title(db, "Interestelar")  # ficção científica, 2014
    assert weak_link(interestelar, a["eletronica"]).label == "ficção científica pede eletrônica, anos 2010"
    so_genero = Media(type="album", title="x", year=1980, genres=["Eletrônica"], countries=[])
    assert weak_link(interestelar, so_genero) is None


def test_pontes_fortes_da_lista(db, albums):
    a, result = albums
    assert result["unmatched"] == ["Um Filme Que Não Existe"]
    pairs = {(b.media_id, b.other_id): (b.kind, b.label) for b in db.scalars(select(MediaBridge))}
    interestelar, origem, cdd = title(db, "Interestelar"), title(db, "A Origem"), title(db, "Cidade de Deus")
    assert pairs[(interestelar.id, a["interstellar"].id)] == ("soundtrack", "")
    assert pairs[(a["interstellar"].id, interestelar.id)] == ("soundtrack", "")  # nos dois sentidos
    assert pairs[(interestelar.id, a["dune"].id)] == ("composer", "Hans Zimmer")  # outro disco do compositor
    assert pairs[(origem.id, a["interstellar"].id)] == ("composer", "Hans Zimmer")
    assert pairs[(cdd.id, a["seu_jorge"].id)] == ("same_person", "Seu Jorge")


@pytest.fixture()
def lista_path(tmp_path):
    return tmp_path / "albuns.csv"


def test_refazer_as_pontes_nao_duplica(db, albums, lista_path):
    total = db.query(MediaBridge).count()
    build_bridges(db, lista_path)
    assert db.query(MediaBridge).count() == total


# ---------------------------------------------------------------- detalhe
def test_para_ouvir_depois_no_detalhe_do_filme(client, user_headers, db, albums):
    a, _ = albums
    cdd = title(db, "Cidade de Deus")
    found = client.get(f"/media/{cdd.id}/connections", headers=user_headers).json()
    assert found[0]["media"]["id"] == a["cdd"].id and found[0]["reason"] == "Trilha sonora deste filme"
    assert {"kind": "same_person", "reason": "Seu Jorge, do elenco, também canta"}.items() <= next(
        x for x in found if x["media"]["id"] == a["seu_jorge"].id).items()
    assert all(x["media"]["type"] == "album" for x in found)


def test_para_ver_depois_no_detalhe_do_album(client, user_headers, db, albums):
    a, _ = albums
    found = client.get(f"/media/{a['interstellar'].id}/connections", params={"limit": 3}, headers=user_headers).json()
    assert found[0]["media"]["title"] == "Interestelar" and found[0]["reason"] == "O filme desta trilha"
    assert found[1]["reason"] == "Hans Zimmer compôs a trilha" and len(found) == 3
    assert client.get("/media/999999/connections", headers=user_headers).status_code == 404


def test_parecidos_de_um_album_sao_albuns(client, user_headers, albums):
    a, _ = albums
    similar = client.get(f"/media/{a['inception'].id}/similar", headers=user_headers).json()
    assert similar and all(m["type"] == "album" for m in similar)


# ---------------------------------------------------------------- feed
def curtir(client, headers, db, *names):
    for name in names:
        assert client.post("/diary", json={"media_id": title(db, name).id, "rating": 5}, headers=headers).status_code == 201


def test_feed_misto_poe_albuns_ligados_em_lugares_fixos(client, user_headers, db, albums):
    a, _ = albums
    curtir(client, user_headers, db, "Interestelar", "A Origem", "Cidade de Deus")
    feed = client.get("/recommendations", params={"limit": 12}, headers=user_headers).json()["items"]
    assert len(feed) == 12
    slots = [i for i, r in enumerate(feed) if r["media"]["type"] == "album"]
    assert slots and slots == [2, 6, 10][: len(slots)]
    reasons = {r["media"]["title"]: r["reason"] for r in feed if r["media"]["type"] == "album"}
    assert reasons["Interstellar"] == "Trilha de Interestelar, que você curtiu"
    assert all(r["strategy"] == "bridge" for r in feed if r["media"]["type"] == "album")
    # os álbuns mostrados entram nas impressões, como os filmes
    assert client.post("/recommendations/impressions", json={"items": impressions_of(feed)}, headers=user_headers).status_code == 204


def test_filtro_de_musica_traz_so_albuns(client, user_headers, db, albums):
    curtir(client, user_headers, db, "Cidade de Deus")
    feed = client.get("/recommendations", params={"type": "album", "limit": 6}, headers=user_headers).json()["items"]
    assert len(feed) == 6 and all(r["media"]["type"] == "album" for r in feed)
    assert feed[0]["reason"] == "Trilha de Cidade de Deus, que você curtiu"
    assert feed[-1]["reason"] == "Em alta na música"  # sem ponte, completa com os mais ouvidos


def test_sem_nada_curtido_o_feed_misto_nao_poe_album_sem_motivo(client, user_headers, albums):
    feed = client.get("/recommendations", params={"limit": 12}, headers=user_headers).json()["items"]
    assert all(r["media"]["type"] != "album" for r in feed)
    musica = client.get("/recommendations", params={"type": "album", "limit": 3}, headers=user_headers).json()["items"]
    assert [r["reason"] for r in musica] == ["Em alta na música"] * 3


def test_album_ja_registrado_nao_volta(client, user_headers, db, albums):
    a, _ = albums
    curtir(client, user_headers, db, "Interestelar")
    client.post("/diary", json={"media_id": a["interstellar"].id, "rating": 4}, headers=user_headers)
    feed = client.get("/recommendations", params={"type": "album", "limit": 10}, headers=user_headers).json()["items"]
    assert a["interstellar"].id not in {r["media"]["id"] for r in feed}


def test_mix_albums_respeita_o_limite_e_ignora_os_sem_ponte():
    feed = [Recommendation(Media(id=i), 1.0, "", "hybrid") for i in range(5)]
    albums = [Recommendation(Media(id=100 + i), 1.0, "", "bridge") for i in range(3)]
    albums.append(Recommendation(Media(id=200), 1.0, "Em alta na música", "trending"))
    out = mix_albums(feed, albums, 6)
    assert [r.media.id for r in out] == [0, 1, 100, 2, 3, 4]


def test_artistas_e_generos_do_onboarding_viram_sugestoes(client, user_headers, albums):
    r = client.put("/me/preferences", json={"genres": ["MPB"], "artists": ["Daft Punk"]}, headers=user_headers)
    assert r.status_code == 200 and r.json()["artists"] == ["Daft Punk"]
    feed = client.get("/recommendations", params={"type": "album", "limit": 6}, headers=user_headers).json()["items"]
    reasons = {f["media"]["title"]: f["reason"] for f in feed}
    assert reasons["Random Access Memories"] == "Porque você curte Daft Punk"
    assert reasons["Cru"] == "Porque você curte MPB"
    assert feed[0]["media"]["title"] == "Random Access Memories"  # artista vale mais que gênero
    # no feed misto, os álbuns com motivo também entram nos lugares fixos
    misto = client.get("/recommendations", params={"limit": 12}, headers=user_headers).json()["items"]
    assert any(m["media"]["type"] == "album" for m in misto)


def test_um_artista_nao_toma_a_lista_de_musica(client, user_headers, db, albums):
    # Os três discos de Hans Zimmer têm ponte com o que a pessoa curtiu, mas só dois ficam no começo
    curtir(client, user_headers, db, "Interestelar", "A Origem", "Duna")
    feed = client.get("/recommendations", params={"type": "album", "limit": 50}, headers=user_headers).json()["items"]
    artistas = [f["media"]["creators"][0] for f in feed]
    assert artistas[:4].count("Hans Zimmer") == 2
    assert artistas.count("Hans Zimmer") == 3 and artistas[-1] == "Hans Zimmer"  # o terceiro vai para o fim, não some


def test_fora_da_bolha_traz_generos_que_a_pessoa_nao_ouve(client, user_headers, db, albums):
    curtir(client, user_headers, db, "Interestelar", "A Origem")
    client.put("/me/preferences", json={"genres": ["Trilha sonora"]}, headers=user_headers)
    params = {"type": "album", "limit": 6}
    no_gosto = client.get("/recommendations", params=params, headers=user_headers).json()["items"]
    fora = client.get("/recommendations", params={**params, "discovery": "outside"}, headers=user_headers).json()["items"]
    novos = [f for f in fora if f["strategy"] == "discovery"]
    assert novos and len(novos) > len([f for f in no_gosto if f["strategy"] == "discovery"])
    assert all(f["reason"].startswith("Fora da sua bolha: ") and "Trilha sonora" not in f["media"]["genres"] for f in novos)
    assert {f["reason"] for f in novos} >= {"Fora da sua bolha: MPB, um gênero que você ainda não ouve"}
    # no feed misto, os discos de fora da bolha também entram nos lugares fixos
    misto = client.get("/recommendations", params={"limit": 12, "discovery": "outside"}, headers=user_headers).json()["items"]
    assert any(m["strategy"] == "discovery" for m in misto)
    assert client.post("/recommendations/impressions", json={"items": impressions_of(misto)}, headers=user_headers).status_code == 204
