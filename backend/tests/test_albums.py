"""Álbuns como terceira mídia (RFF01), SEM rede: as respostas do MusicBrainz, do Cover Art Archive e do ListenBrainz
são simuladas com httpx.MockTransport. Os formatos seguem respostas reais da API."""

import json
from collections import Counter

import httpx
import pytest

from app.config import settings
from app.routers import admin as admin_router
from app.seed import load_albums
from app.services.catalog import sync_catalog
from app.services.musicbrainz import (
    MusicBrainzClient,
    MusicBrainzError,
    album_from_musicbrainz,
    broad_genres,
    is_instrumental,
    listen_links,
    load_genre_map,
    lyrics_language,
    readable_name,
    popularity_from_listeners,
    representative_release,
)
from app.services.tmdb import StaticProvider

RG_ID = "f8630f31-cff7-3a7d-a67a-053bf5b869dd"
OST_ID = "4513c7b9-854e-457f-81d6-3dbeb001beb8"
CAETANO = "f07dbc2f-317b-470f-bad4-5f1b0eb6faf1"
ZIMMER = "e6de1f3b-6484-491c-88dd-6d619f142abc"
VARIOUS = "89ad4ac3-39f7-470e-963a-56509c546377"

GENRES = {"mpb": "MPB", "tropicália": "MPB", "rock": "Rock", "psychedelic rock": "Rock", "latin": "Latina",
          "classical": "Clássica", "ambient": "Eletrônica", "samba": "Samba e choro"}


def release(id_, date, lang, status="Official", country="BR"):
    return {"id": id_, "date": date, "status": status, "country": country,
            "text-representation": {"language": lang, "script": "Latn"}}


TROPICALIA = {
    "id": RG_ID, "title": "Tropicália: ou panis et circensis", "first-release-date": "1968-07",
    "primary-type": "Album", "secondary-types": [],
    "artist-credit": [{"name": "Caetano Veloso", "artist": {"id": CAETANO}}],
    "genres": [{"name": "rock", "count": 1}, {"name": "psychedelic rock", "count": 1}, {"name": "mpb", "count": 1}],
    "releases": [release("r-1993", "1993", "por"), release("r-1968", "1968", "por"), release("r-bootleg", "1960", "eng",
                                                                                            status="Bootleg")],
}
TROPICALIA_RELEASE = {
    "id": "r-1968", "country": "BR",
    "media": [{"tracks": [{"length": 180000}, {"length": 150000}]}, {"tracks": [{"length": None}]}],
    "relations": [
        {"type": "free streaming", "url": {"resource": "https://open.spotify.com/album/abc"}},
        {"type": "discogs", "url": {"resource": "https://www.discogs.com/master/199408"}},
    ],
}
CAETANO_ARTIST = {
    "id": CAETANO, "country": "BR", "genres": [{"name": "mpb", "count": 11}, {"name": "tropicália", "count": 5}],
    "relations": [
        {"type": "free streaming", "url": {"resource": "https://open.spotify.com/artist/7HG"}},
        {"type": "free streaming", "url": {"resource": "https://www.deezer.com/artist/232"}},
        {"type": "youtube", "url": {"resource": "https://www.youtube.com/channel/UCb"}},
        {"type": "allmusic", "url": {"resource": "https://www.allmusic.com/artist/x"}},
    ],
}
SOUNDTRACK = {
    "id": OST_ID, "title": "Interstellar: Original Motion Picture Soundtrack", "first-release-date": "2014-11-17",
    "primary-type": "Album", "secondary-types": ["Soundtrack"],
    "artist-credit": [{"name": "Hans Zimmer", "artist": {"id": ZIMMER}}],
    "genres": [{"name": "classical", "count": 3}, {"name": "ambient", "count": 1}],
    "releases": [release("r-ost", "2014-11-17", "zxx", country="XW")],
}
SOUNDTRACK_RELEASE = {"id": "r-ost", "country": "XW", "media": [{"tracks": [{"length": 4_320_000}]}], "relations": []}
ZIMMER_ARTIST = {"id": ZIMMER, "country": "DE", "genres": [], "relations": []}


# ---------------------------------------------------------------- conversão
def test_lista_de_generos_do_repositorio_carrega():
    genre_map = load_genre_map(settings.music_genres_path)
    assert genre_map["mpb"] == "MPB"
    assert genre_map["funk carioca"] == "Funk brasileiro"
    assert genre_map["funk"] == "Soul, R&B e funk"


def test_disco_brasileiro_poe_o_genero_brasileiro_na_frente():
    votos = Counter({"rock": 1, "psychedelic rock": 1, "mpb": 1})
    assert broad_genres(votos, GENRES) == ["Rock", "MPB"]
    assert broad_genres(votos, GENRES, brazilian=True) == ["MPB", "Rock"]


def test_disco_brasileiro_nao_vira_latina():
    votos = Counter({"mpb": 3, "latin": 2, "rock": 1})
    assert broad_genres(votos, GENRES) == ["MPB", "Latina"]
    assert broad_genres(votos, GENRES, brazilian=True) == ["MPB", "Rock"]


def test_sem_genero_oficial_usa_as_etiquetas_livres():
    rg = {**TROPICALIA, "genres": [], "tags": [{"name": "samba", "count": 2}, {"name": "vinil raro", "count": 5}]}
    album = album_from_musicbrainz(rg, TROPICALIA_RELEASE, [{**CAETANO_ARTIST, "genres": []}], 1, True, GENRES)
    assert album["genres"] == ["Samba e choro"] and album["tags"] == ["samba"]  # a etiqueta sem grupo fica de fora


def test_trilha_sonora_vem_sempre_primeiro():
    assert broad_genres(Counter({"classical": 3, "ambient": 1}), GENRES, soundtrack=True) == ["Trilha sonora", "Clássica"]


def test_empate_favorece_o_grupo_brasileiro_e_ignora_generos_sem_grupo():
    assert broad_genres(Counter({"latin": 1, "samba": 1, "genero-desconhecido": 9}), GENRES) == ["Samba e choro", "Latina"]


def test_idioma_das_letras():
    assert lyrics_language([release("a", "1", "por"), release("b", "2", "eng", status="Bootleg")]) == "pt"
    assert lyrics_language([release("a", "1", "zxx")]) is None
    assert lyrics_language([release("a", "1", "tup")]) == "tup"  # sem tradução: fica o código original
    assert lyrics_language([{"id": "a", "status": "Official"}]) is None
    # o lançamento mais antigo decide, mesmo com mais reedições em outro idioma ou um original sem idioma
    edicoes = [release("sem", "1997-07-02", None), release("orig", "1997-07-02", "jpn"), release("us", "2001", "eng"),
               release("uk", "2002", "eng")]
    assert lyrics_language(edicoes) == "ja"
    assert lyrics_language([{**r, "date": None} for r in edicoes]) == "en"  # sem datas: o mais comum
    assert is_instrumental([release("a", "1", "zxx")]) and not is_instrumental([release("a", "1", "por")])


def test_nomes_em_outro_alfabeto_viram_nomes_latinos():
    apelidos = [{"name": "Hisaishi Joe", "locale": "ja-Latn", "primary": True},
                {"name": "Joe Hisaishi", "locale": "en", "primary": True}]
    assert readable_name("久石譲", apelidos) == "Joe Hisaishi"
    assert readable_name("Caetano Veloso", apelidos) == "Caetano Veloso"  # já latino: fica como está
    assert readable_name("久石譲", [], "Hisaishi, Joe") == "Joe Hisaishi"
    assert readable_name("久石譲", []) == "久石譲"  # sem alternativa, mostra o original


def test_lancamento_representativo_e_o_oficial_mais_antigo():
    assert representative_release(TROPICALIA["releases"]) == "r-1968"


def test_links_para_ouvir():
    links = listen_links(CAETANO_ARTIST["relations"], "artist")
    assert [link["service"] for link in links] == ["spotify", "deezer", "youtube"]  # o allmusic não é para ouvir
    assert all(link["level"] == "artist" for link in links)


def test_popularidade_pelas_pessoas_que_ouviram():
    assert popularity_from_listeners(None) == 0
    assert 79 < popularity_from_listeners(10_000) < 81
    assert popularity_from_listeners(10**9) == 100


def test_album_completo():
    album = album_from_musicbrainz(TROPICALIA, TROPICALIA_RELEASE, [CAETANO_ARTIST], 83, True, GENRES)
    assert album["external_id"] == f"album-{RG_ID}" and album["type"] == "album"
    assert album["year"] == 1968 and album["creators"] == ["Caetano Veloso"]
    assert album["overview"] == "Álbum de Caetano Veloso, lançado em 1968."
    assert album["genres"] == ["MPB", "Rock"]  # o artista soma votos de MPB, com peso menor
    assert album["tags"][0] == "mpb" and "tropicália" in album["tags"]
    assert album["duration_min"] == 6 and album["countries"] == ["BR"] and album["language"] == "pt"
    assert album["poster_url"].endswith(f"/release-group/{RG_ID}/front-500")
    # o Spotify do disco vale mais que o do artista; os outros serviços vêm da página do artista
    assert [(link["service"], link["level"]) for link in album["links"]] == [
        ("spotify", "album"), ("deezer", "artist"), ("youtube", "artist")]
    assert album["links"][0]["url"] == "https://open.spotify.com/album/abc"


def test_trilha_sonora_instrumental_sem_capa():
    album = album_from_musicbrainz(SOUNDTRACK, SOUNDTRACK_RELEASE, [ZIMMER_ARTIST], 11936, False, GENRES)
    assert album["overview"] == "Trilha sonora de Hans Zimmer, lançada em 2014."
    assert album["genres"] == ["Trilha sonora", "Clássica"]
    assert album["language"] is None and "instrumental" in album["tags"]
    assert album["countries"] == ["DE"]  # o país vem do artista; XW (mundo todo) não é país
    assert album["duration_min"] == 72 and album["poster_url"] is None


def test_trilha_japonesa_aparece_com_nomes_latinos():
    rg = {**SOUNDTRACK, "title": "ハウルの動く城 サウンドトラック",
          "aliases": [{"name": "Howl's Moving Castle Soundtrack", "locale": "en", "primary": True}],
          "artist-credit": [{"name": "久石譲", "artist": {"id": "hisaishi"}}]}
    artist = {"id": "hisaishi", "country": "JP", "genres": [], "relations": [], "sort-name": "Hisaishi, Joe",
              "aliases": [{"name": "Joe Hisaishi", "locale": "en", "primary": True}]}
    album = album_from_musicbrainz(rg, SOUNDTRACK_RELEASE, [artist], 1, True, GENRES)
    assert album["title"] == "Howl's Moving Castle Soundtrack" and album["creators"] == ["Joe Hisaishi"]
    assert album["overview"] == "Trilha sonora de Joe Hisaishi, lançada em 2014."


def test_varios_artistas_nao_entram_como_criador():
    rg = {**TROPICALIA, "artist-credit": [{"name": "Various Artists", "artist": {"id": VARIOUS}}]}
    album = album_from_musicbrainz(rg, TROPICALIA_RELEASE, [], None, True, GENRES)
    assert album["creators"] == [] and album["overview"] == "Álbum, lançado em 1968."
    assert album["countries"] == ["BR"]  # sem artista, o país vem do lançamento


# ---------------------------------------------------------------- cliente HTTP
class FakeServer:
    def __init__(self, busy: int = 0):
        self.calls: list[str] = []
        self.busy = busy

    def __call__(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        self.calls.append(f"{request.method} {request.url.path}")
        if "listenbrainz" in url:
            mbids = json.loads(request.content)["release_group_mbids"]
            return httpx.Response(200, json=[{"release_group_mbid": m, "total_user_count": 83} for m in mbids])
        if "coverartarchive" in url:
            return httpx.Response(307, headers={"Location": "https://archive.org/capa.jpg"})
        if self.busy:
            self.busy -= 1
            return httpx.Response(503, headers={"Retry-After": "1"})
        path = request.url.path.removeprefix("/ws/2/")
        routes = {
            f"release-group/{RG_ID}": TROPICALIA, "release/r-1968": TROPICALIA_RELEASE, f"artist/{CAETANO}": CAETANO_ARTIST,
            "release-group": {"release-groups": [
                {**TROPICALIA, "score": 100}, {**SOUNDTRACK, "score": 90}]},
        }
        if path in routes:
            return httpx.Response(200, json=routes[path])
        return httpx.Response(404, json={"error": "Not Found"})


def make_client(server: FakeServer, sleeps: list[float] | None = None) -> MusicBrainzClient:
    clock = iter(range(0, 10_000))
    return MusicBrainzClient(
        client=httpx.Client(transport=httpx.MockTransport(server)),
        sleep=(sleeps.append if sleeps is not None else lambda _s: None),
        clock=lambda: float(next(clock)) / 100,  # o relógio anda 0,01 s por consulta: sempre precisa esperar
    )


def test_cliente_importa_um_album_inteiro(monkeypatch):
    monkeypatch.setattr("app.services.musicbrainz.load_genre_map", lambda path=None: GENRES)
    server = FakeServer()
    album = make_client(server).get_album(RG_ID)
    assert album["title"].startswith("Tropicália") and album["genres"] == ["MPB", "Rock"]
    assert album["popularity"] == popularity_from_listeners(83) and album["poster_url"]
    assert "GET /ws/2/release/r-1968" in server.calls and "HEAD " + f"/release-group/{RG_ID}/front-500" in server.calls


def test_cliente_respeita_o_limite_e_tenta_de_novo_quando_o_servidor_esta_ocupado(monkeypatch):
    monkeypatch.setattr("app.services.musicbrainz.load_genre_map", lambda path=None: GENRES)
    sleeps: list[float] = []
    server = FakeServer(busy=2)
    album = make_client(server, sleeps).get_album(RG_ID)
    assert album["title"].startswith("Tropicália")
    assert sleeps.count(1.0) == 2  # esperou o Retry-After das duas respostas 503
    assert all(s > 0 for s in sleeps)


def test_cliente_desiste_depois_das_tentativas():
    with pytest.raises(MusicBrainzError) as e:
        make_client(FakeServer(busy=99)).get_album(RG_ID)
    assert e.value.status_code == 503


def test_album_inexistente_da_404():
    with pytest.raises(MusicBrainzError) as e:
        make_client(FakeServer()).get_album("00000000-0000-0000-0000-000000000000")
    assert e.value.status_code == 404


def test_busca_traz_o_basico():
    results = make_client(FakeServer()).search("tropicalia")
    assert [r["title"][:10] for r in results] == ["Tropicália", "Interstell"]
    assert results[1]["genres"] == ["Trilha sonora"] and results[0]["creators"] == ["Caetano Veloso"]


# ---------------------------------------------------------------- API
@pytest.fixture()
def album(db):
    data = album_from_musicbrainz(TROPICALIA, TROPICALIA_RELEASE, [CAETANO_ARTIST], 83, True, GENRES)
    sync_catalog(db, StaticProvider([data], "MusicBrainz"), source="musicbrainz")
    return db.query(admin_router.Media).filter_by(external_id=data["external_id"]).one()


def test_album_aparece_na_busca_e_no_detalhe_com_os_campos_novos(client, user_headers, album):
    page = client.get("/media", params={"type": "album"}, headers=user_headers).json()
    assert [m["id"] for m in page["items"]] == [album.id]
    item = page["items"][0]
    assert item["type"] == "album" and item["language"] == "pt" and item["duration_min"] == 6
    assert item["links"][0] == {"service": "spotify", "url": "https://open.spotify.com/album/abc", "level": "album"}
    detail = client.get(f"/media/{album.id}", headers=user_headers).json()
    assert detail["creators"] == ["Caetano Veloso"] and detail["countries"] == ["BR"]
    assert client.get("/media", params={"q": "caetano"}, headers=user_headers).json()["total"] == 1


def test_generos_e_facetas_separam_filmes_de_musica(client, user_headers, album):
    assert "MPB" not in client.get("/media/genres").json()
    assert client.get("/media/genres", params={"type": "album"}).json() == ["MPB", "Rock"]
    assert "Caetano Veloso" not in client.get("/media/facets", params={"limit": 50}).json()["creators"]
    assert client.get("/media/facets", params={"type": "album"}).json()["creators"] == ["Caetano Veloso"]


def test_album_vai_para_o_diario_e_para_as_listas(client, user_headers, album):
    r = client.post("/diary", json={"media_id": album.id, "rating": 5}, headers=user_headers)
    assert r.status_code == 201 and r.json()["media"]["type"] == "album"
    watchlist = client.get("/lists", headers=user_headers).json()[0]
    r = client.post(f"/lists/{watchlist['id']}/items", json={"media_id": album.id}, headers=user_headers)
    assert r.status_code == 201


def test_album_fica_fora_do_feed_e_do_em_alta_ate_o_feed_misto(client, user_headers, album):
    client.post("/diary", json={"media_id": album.id, "rating": 5}, headers=user_headers)
    feed = client.get("/recommendations", params={"limit": 50}, headers=user_headers).json()["items"]
    assert all(r["media"]["type"] != "album" for r in feed)
    assert all(m["type"] != "album" for m in client.get("/media/trending", params={"limit": 100}).json())


def test_admin_busca_e_importa_album(client, admin_headers, user_headers, monkeypatch):
    monkeypatch.setattr("app.services.musicbrainz.load_genre_map", lambda path=None: GENRES)
    monkeypatch.setattr(admin_router, "musicbrainz_client", lambda: make_client(FakeServer()))
    found = client.get("/admin/musicbrainz/search", params={"q": "tropicalia"}, headers=admin_headers).json()
    assert found[0]["media_id"] is None
    r = client.post("/admin/musicbrainz/import", json={"mbid": RG_ID}, headers=admin_headers)
    assert r.status_code == 201 and r.json()["result"]["created"] == 1
    assert r.json()["media"]["genres"] == ["MPB", "Rock"]
    again = client.get("/admin/musicbrainz/search", params={"q": "tropicalia"}, headers=admin_headers).json()
    assert again[0]["media_id"] == r.json()["media"]["id"]
    r = client.post("/admin/musicbrainz/import", json={"mbid": RG_ID}, headers=admin_headers)  # reimportar atualiza
    assert r.json()["result"]["created"] == 0
    assert client.post("/admin/musicbrainz/import", json={"mbid": "nao-e-um-id"}, headers=admin_headers).status_code == 422
    assert client.post("/admin/musicbrainz/import", json={"mbid": RG_ID}, headers=user_headers).status_code == 403


def test_admin_recebe_o_erro_do_musicbrainz(client, admin_headers, monkeypatch):
    monkeypatch.setattr(admin_router, "musicbrainz_client", lambda: make_client(FakeServer(busy=99)))
    r = client.post("/admin/musicbrainz/import", json={"mbid": RG_ID}, headers=admin_headers)
    assert r.status_code == 503 and "ocupado" in r.json()["detail"]


def test_tmdb_nao_aceita_album(client, admin_headers):
    r = client.post("/admin/tmdb/import", json={"type": "album", "tmdb_id": 1}, headers=admin_headers)
    assert r.status_code == 422


def test_seed_carrega_o_retrato_dos_albuns(db, tmp_path, monkeypatch):
    data = album_from_musicbrainz(SOUNDTRACK, SOUNDTRACK_RELEASE, [ZIMMER_ARTIST], 11936, True, GENRES)
    snapshot = tmp_path / "albums.json"
    snapshot.write_text(json.dumps([data], ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr("app.seed.settings", type(settings)(albums_catalog_path=snapshot))
    assert load_albums(db)["created"] == 1
    assert load_albums(db)["created"] == 0  # rodar de novo não duplica
    monkeypatch.setattr("app.seed.settings", type(settings)(albums_catalog_path=tmp_path / "nao-existe.json"))
    assert load_albums(db) is None


def test_curadoria_de_generos_da_lista():
    from scripts.import_albums import apply_curation

    albums = [{"external_id": f"album-{RG_ID}", "genres": []}, {"external_id": f"album-{OST_ID}", "genres": ["Clássica"]}]
    rows = [{"mbid": RG_ID, "generos": "Samba e choro; MPB"}, {"mbid": OST_ID, "generos": ""}]
    apply_curation(albums, rows)
    assert albums[0]["genres"] == ["Samba e choro", "MPB"] and albums[1]["genres"] == ["Clássica"]
