"""Importar o histórico do Letterboxd pelo arquivo exportado (RFF18)."""

from datetime import date

import httpx
from sqlalchemy import select

from app.models import DiaryEntry, ListItem, Media, UserList
from app.routers import account
from app.services import letterboxd
from app.services.letterboxd import read_exports
from app.services.tmdb import TmdbCatalogProvider

WATCHED = "Date,Name,Year,Letterboxd URI\n2024-03-01,Matrix,1999,https://boxd.it/a\n2024-03-02,Interstellar,2014,https://boxd.it/b\n"
RATINGS = "Date,Name,Year,Letterboxd URI,Rating\n2024-03-01,Matrix,1999,https://boxd.it/a,4.5\n2024-03-02,Interstellar,2014,https://boxd.it/b,5\n"
DIARY = ("Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n"
         "2024-03-02,Interstellar,2014,https://boxd.it/c,3,,,2024-02-28\n")
REVIEWS = ("Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n"
           '2024-03-02,Interstellar,2014,https://boxd.it/d,5,,"<i>Lindo</i>, chorei",,2024-02-28\n')
WATCHLIST = "Date,Name,Year,Letterboxd URI\n2024-01-10,Dune,2021,https://boxd.it/e\n2024-01-11,Filme Inexistente,1950,https://boxd.it/f\n"

# No TMDB: "Interstellar" é o 157336, que já está no catálogo; "Dune" é o 438631, que não está
# (no TMDB, Interstellar aparece com um ano de diferença, como acontece com estreias em datas diferentes)
TMDB_IDS = {"Interstellar": (157336, 2015), "Dune": (438631, 2021)}


def fake_tmdb(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/search/movie"):
        name = request.url.params["query"]
        assert request.url.params["language"] == "en-US"  # o Letterboxd usa o título em inglês
        found, year = TMDB_IDS.get(name, (None, 1950))
        # Um parecido do mesmo ano vem antes do certo, como na busca de verdade
        decoy = {"id": 1, "title": f"Making of {name}", "original_title": f"Making of {name}", "release_date": f"{year}-01-01"}
        right = {"id": found, "title": name, "original_title": "Outro nome", "release_date": f"{year}-06-01"}
        return httpx.Response(200, json={"results": [decoy, right] if found else [decoy]})
    assert request.url.path.endswith("/movie/438631")
    return httpx.Response(200, json={"id": 438631, "title": "Duna", "release_date": "2021-09-15", "overview": "Paul.",
                                     "poster_path": "/d.jpg", "genres": [{"id": 878}], "popularity": 90,
                                     "vote_average": 8, "credits": {"crew": [], "cast": []}, "keywords": {"keywords": []}})


def provider():
    client = httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(fake_tmdb))
    return TmdbCatalogProvider("chave-teste", pages=1, client=client, max_workers=2)


def test_junta_os_csvs_num_filme_por_nome_e_ano():
    films, ignored = read_exports({"watched.csv": WATCHED, "ratings.csv": RATINGS, "diary.csv": DIARY,
                                   "reviews.csv": REVIEWS, "watchlist.csv": WATCHLIST, "profile.csv": "x"})
    inter = films[("Interstellar", 2014)]
    assert inter.seen and inter.rating == 5  # a nota atual (ratings.csv) vence a do diário
    assert inter.watched_on == date(2024, 2, 28) and inter.logged_on == date(2024, 3, 2)
    assert inter.review == "Lindo, chorei"  # sem as marcações
    assert films[("Dune", 2021)].watchlist and not films[("Dune", 2021)].seen
    assert ignored == ["profile.csv"]


def test_importa_para_o_diario_e_o_quero_ver(client, user_headers, db, monkeypatch):
    monkeypatch.setattr(account, "tmdb_provider", provider)
    inter = db.scalar(select(Media).where(Media.title == "Interestelar"))
    inter.source, inter.external_id = "tmdb", "movie-157336"
    db.commit()
    files = [{"name": n, "content": c} for n, c in
             (("watched.csv", WATCHED), ("ratings.csv", RATINGS), ("diary.csv", DIARY), ("reviews.csv", REVIEWS),
              ("watchlist.csv", WATCHLIST))]
    r = client.post("/me/import/letterboxd", json={"files": files}, headers=user_headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert (out["registered"], out["want_to_watch"], out["brought"]) == (2, 1, 1)  # Matrix pelo nome; Interestelar pelo TMDB
    assert out["not_found"] == ["Filme Inexistente (1950)"] and out["ignored_files"] == []  # o parecido não entra

    diario = {e.media.title: e for e in db.scalars(select(DiaryEntry))}
    assert diario["Interestelar"].rating == 5 and diario["Interestelar"].review == "Lindo, chorei"
    assert diario["Interestelar"].consumed_at == date(2024, 2, 28)
    assert diario["Interestelar"].created_at.date() == date(2024, 3, 2)  # não aparece como novo na Comunidade
    assert diario["Matrix"].rating == 4.5
    quero_ver = db.scalars(select(Media.title).join(ListItem).join(UserList).where(UserList.is_watchlist.is_(True)))
    assert list(quero_ver) == ["Duna"]

    again = client.post("/me/import/letterboxd", json={"files": files}, headers=user_headers).json()
    assert again["registered"] == 0 and again["already_in_diary"] == 2 and again["brought"] == 0  # não duplica


def test_limite_de_filmes_novos_por_envio(client, user_headers, monkeypatch):
    monkeypatch.setattr(account, "tmdb_provider", provider)
    monkeypatch.setattr(letterboxd, "MAX_NEW", 0)
    out = client.post("/me/import/letterboxd", json={"files": [{"name": "watchlist.csv", "content": WATCHLIST}]},
                      headers=user_headers).json()
    assert out["brought"] == 0 and out["next_time"] == 1 and out["not_found"] == ["Filme Inexistente (1950)"]


def test_sem_tmdb_acha_so_pelo_nome(client, user_headers, monkeypatch):
    monkeypatch.setattr(account, "tmdb_provider", lambda: None)
    out = client.post("/me/import/letterboxd", json={"files": [{"name": "watched.csv", "content": WATCHED}]},
                      headers=user_headers).json()
    assert out["registered"] == 1 and out["not_found"] == ["Interstellar (2014)"]
    assert client.post("/me/import/letterboxd", json={"files": []}, headers=user_headers).status_code == 422
    assert client.post("/me/import/letterboxd", json={"files": [{"name": "a.csv", "content": ""}]}).status_code == 401
