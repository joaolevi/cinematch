"""Música e cruzamento entre mídias: sessão dupla (RFF27), cinebiografias e documentários (RFF26), ponte fraca de idioma
(RFF26) e a aceitação por tipo de ponte (EXP03)."""

import pytest
from sqlalchemy import select

from app.models import Media, MediaBridge
from app.services.bridges import build_biopic_bridges, weak_link
from app.services.tmdb import countries_of

from .test_bridges import album, albums, curtir, title  # noqa: F401  (albums é fixture)


# ---------------------------------------------------------------- RFF27: sessão dupla
def test_sessao_dupla_junta_filme_e_disco_por_ponte_forte(client, user_headers, db, albums):  # noqa: F811
    a, _ = albums
    curtir(client, user_headers, db, "Ex Machina: Instinto Artificial")  # leva a Interestelar e A Origem
    pares = client.get("/recommendations/pairs", params={"limit": 5}, headers=user_headers).json()
    assert pares
    assert all(p["video"]["media"]["type"] in ("movie", "series") and p["album"]["type"] == "album" for p in pares)
    assert len({p["album"]["id"] for p in pares}) == len(pares)  # cada disco uma vez
    assert "Ex Machina: Instinto Artificial" not in {p["video"]["media"]["title"] for p in pares}
    inter = next(p for p in pares if p["video"]["media"]["title"] == "Interestelar")
    assert inter["album"]["title"] == "Interstellar" and inter["kind"] == "soundtrack"  # a trilha vence o compositor
    assert inter["reason"] == "A trilha sonora de Interestelar"

    sem = client.get("/recommendations/pairs", params={"exclude": [title(db, "Interestelar").id]}, headers=user_headers)
    assert "Interestelar" not in {p["video"]["media"]["title"] for p in sem.json()}


def test_sessao_dupla_nao_traz_disco_ja_ouvido(client, user_headers, db, albums):  # noqa: F811
    a, _ = albums
    curtir(client, user_headers, db, "Ex Machina: Instinto Artificial", "Interstellar")  # o disco já está no diário
    pares = client.get("/recommendations/pairs", params={"limit": 10}, headers=user_headers).json()
    assert "Interstellar" not in {p["album"]["title"] for p in pares}
    assert client.get("/recommendations/pairs").status_code == 401


# ---------------------------------------------------------------- RFF26: cinebiografias
@pytest.fixture()
def elis(db, tmp_path):
    filme = Media(type="movie", source="tmdb", external_id="movie-360139", title="Elis", year=2016, overview="",
                  genres=["Drama", "Música"], tags=[], creators=[], popularity=40)
    db.add(filme)
    disco = album(db, "Elis & Tom", ["Elis Regina"], 1974, ["MPB", "Bossa Nova"], "e1", ["BR"])
    db.commit()
    lista = tmp_path / "cinebio.csv"
    lista.write_text(
        "filme,titulo_filme,mbid,titulo_album,pessoa,tipo\n"
        "movie-360139,Elis,e1,Elis & Tom,Elis Regina,cinebiografia\n"
        "movie-331781,Amy,b2b,Back to Black,Amy Winehouse,documentario\n",
        encoding="utf-8",
    )
    return filme, disco, lista


def test_cinebiografia_liga_o_filme_ao_disco(client, user_headers, db, elis):
    filme, disco, lista = elis
    result = build_biopic_bridges(db, lista)
    assert result == {"bridges": 1, "missing": ["Amy e Back to Black"]}
    assert build_biopic_bridges(db, lista)["bridges"] == 1  # rodar de novo não duplica
    pontes = {(b.media_id, b.other_id): (b.kind, b.label) for b in db.scalars(select(MediaBridge))}
    assert pontes[(filme.id, disco.id)] == pontes[(disco.id, filme.id)] == ("biopic", "Elis Regina")

    no_disco = client.get(f"/media/{disco.id}/connections", headers=user_headers).json()
    assert no_disco[0]["media"]["title"] == "Elis" and no_disco[0]["reason"] == "Filme sobre Elis Regina"
    no_filme = client.get(f"/media/{filme.id}/connections", headers=user_headers).json()
    assert no_filme[0]["media"]["title"] == "Elis & Tom" and no_filme[0]["reason"] == "A música de Elis Regina"

    curtir(client, user_headers, db, "Elis")
    musica = client.get("/recommendations", params={"type": "album"}, headers=user_headers).json()["items"]
    assert musica[0]["media"]["title"] == "Elis & Tom"
    assert musica[0]["reason"] == "Elis, que você curtiu, conta a história de Elis Regina"


def test_lista_de_cinebiografias_do_repositorio_esta_bem_formada():
    from app.services.bridges import biopic_rows

    rows = biopic_rows()
    assert len(rows) >= 15
    for r in rows:
        assert r["filme"].startswith("movie-") and len(r["mbid"]) == 36 and r["tipo"] in ("cinebiografia", "documentario")


# ---------------------------------------------------------------- RFF26: idioma
def test_idioma_conta_como_sinal_da_ponte_fraca():
    filme = Media(type="movie", title="Filme", year=2015, genres=["Drama"], countries=["MX"], language="es")
    disco = Media(type="album", title="Disco", year=2012, genres=["Rock"], countries=["AR"], language="es")
    assert weak_link(filme, disco).label == "anos 2010, em espanhol"
    disco.language = filme.language = "en"
    assert weak_link(filme, disco) is None  # inglês é comum demais para ligar dois títulos
    br_filme = Media(type="movie", title="F", year=1975, genres=[], countries=["BR"], language="pt")
    br_disco = Media(type="album", title="D", year=1980, genres=[], countries=["BR"], language="pt")
    assert weak_link(br_filme, br_disco) is None  # "feito no Brasil" já diz o idioma: sozinho não basta


def test_pais_do_tmdb():
    assert countries_of({"origin_country": ["BR"]}) == ["BR"]
    assert countries_of({"production_countries": [{"iso_3166_1": "US"}, {"iso_3166_1": "GB"}]}) == ["US", "GB"]
    assert countries_of({}) == []


# ---------------------------------------------------------------- EXP03
def test_aceitacao_por_tipo_de_ponte(client, user_headers, admin_headers, db, albums):  # noqa: F811
    a, _ = albums
    curtir(client, user_headers, db, "Interestelar")
    shown = [{"media_id": a[k].id, "strategy": "bridge", "score": 1} for k in ("interstellar", "dune", "eletronica")]
    assert client.post("/recommendations/impressions", json={"items": shown}, headers=user_headers).status_code == 204
    client.post(f"/recommendations/{a['interstellar'].id}/feedback", json={"action": "want"}, headers=user_headers)
    by = {b["kind"]: b for b in client.get("/admin/metrics", headers=admin_headers).json()["by_bridge"]}
    assert (by["soundtrack"]["shown"], by["soundtrack"]["accepted"]) == (1, 1)
    assert (by["composer"]["shown"], by["composer"]["accepted"]) == (1, 0)
    assert by["weak"]["shown"] == 1 and by["soundtrack"]["label"] == "Trilha sonora"
