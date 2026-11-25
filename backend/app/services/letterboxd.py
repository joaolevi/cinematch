"""Importar o histórico do Letterboxd a partir do arquivo exportado pela pessoa (RFF18).

O Letterboxd exporta um .zip com CSVs. A pessoa descompacta e envia os que quiser: `watched.csv` (o que viu),
`ratings.csv` (as notas), `diary.csv` (o diário, com a data em que viu), `reviews.csv` (as resenhas) e `watchlist.csv`
(o que quer ver). Não usamos coleta automática: os termos do Letterboxd proíbem.

O arquivo traz o nome original e o ano, mas não o ID do TMDB, e o catálogo está em português. Então cada filme é
procurado assim: primeiro no catálogo, por nome e ano; depois no TMDB, que acha pelo nome original, e aí pelo ID. O que
não está no catálogo é trazido do TMDB, até `MAX_NEW` por envio; importar de novo traz os próximos.

O que já está no diário da pessoa fica como está. A data do registro é a do Letterboxd, para o histórico importado não
aparecer como novo na Comunidade nem contar no desafio do mês.
"""

import csv
import io
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..models import DiaryEntry, Media, User
from .catalog import title_key
from .importing import find_known, import_tmdb, known_ids
from .tmdb import TmdbCatalogProvider, TmdbError

FILES = ("watched.csv", "ratings.csv", "diary.csv", "reviews.csv", "watchlist.csv")
MAX_ROWS = 5000
MAX_NEW = 50
TAG = re.compile(r"<[^>]+>")


@dataclass
class Film:
    name: str
    year: int | None
    seen: bool = False
    rating: float | None = None
    review: str | None = None
    watched_on: date | None = None  # quando viu (diário)
    logged_on: date | None = None  # quando registrou no Letterboxd
    watchlist: bool = False


def _date(value: str | None) -> date | None:
    try:
        return date.fromisoformat((value or "").strip())
    except ValueError:
        return None


def _year(value: str | None) -> int | None:
    return int(value) if (value or "").strip().isdigit() else None


def read_exports(files: dict[str, str]) -> tuple[dict[tuple[str, int | None], Film], list[str]]:
    """Junta os CSVs num filme por nome e ano. Devolve os filmes e os arquivos que não foram reconhecidos."""
    films: dict[tuple[str, int | None], Film] = {}
    ignored = []
    rows = 0
    # As notas do `ratings.csv` vêm por último: são as atuais, e as do diário são de quando a pessoa viu
    order = {name: i for i, name in enumerate(("watched.csv", "watchlist.csv", "diary.csv", "reviews.csv", "ratings.csv"))}
    for filename, content in sorted(files.items(), key=lambda f: order.get(f[0].rsplit("/", 1)[-1].lower(), 99)):
        kind = filename.rsplit("/", 1)[-1].lower()
        if kind not in FILES:
            ignored.append(filename)
            continue
        for row in csv.DictReader(io.StringIO(content.lstrip("﻿"))):
            rows += 1
            if rows > MAX_ROWS:
                break
            name = (row.get("Name") or "").strip()
            if not name:
                continue
            film = films.setdefault((name, _year(row.get("Year"))), Film(name, _year(row.get("Year"))))
            if kind == "watchlist.csv":
                film.watchlist = True
                continue
            film.seen = True
            logged = _date(row.get("Date"))
            film.logged_on = min(filter(None, (film.logged_on, logged)), default=None)
            try:
                rating = float((row.get("Rating") or "").strip() or 0)
            except ValueError:
                rating = 0
            if 0.5 <= rating <= 5:
                film.rating = round(rating * 2) / 2
            if watched := _date(row.get("Watched Date")):
                film.watched_on = max(filter(None, (film.watched_on, watched)))
            if review := TAG.sub("", row.get("Review") or "").strip():
                film.review = review[:5000]
    return films, ignored


def _tmdb_id(provider: TmdbCatalogProvider, film: Film) -> int | None:
    """O filme do TMDB com esse nome. O Letterboxd usa o título em inglês, então a busca é em inglês, e só vale o
    título (em inglês ou original) igual ao nome, no mesmo ano ou com um de diferença, porque a estreia muda de país
    para país. A busca também devolve parecidos ("Parasite" traz um curta com "Parasite" no nome), que ficam de fora."""
    try:
        results = provider._get("/search/movie", query=film.name, language="en-US").get("results", [])
    except TmdbError:
        return None
    wanted = title_key("movie", film.name, None)

    def year_gap(r: dict) -> int:
        released = (r.get("release_date") or "")[:4]
        return abs(int(released) - film.year) if film.year and released.isdigit() else 0 if not film.year else 99

    same_name = [r for r in results if wanted in {title_key("movie", r.get(k) or "", None) for k in ("title", "original_title")}]
    for gap in (0, 1):
        if found := next((r for r in same_name if year_gap(r) <= gap), None):
            return found["id"]
    return None


def match_films(
    db: Session, films: list[Film], provider: TmdbCatalogProvider | None
) -> tuple[dict[int, Media], int, set[int]]:
    """Acha cada filme no catálogo (pela posição na lista). Devolve os achados, quantos foram trazidos do TMDB e
    os que ficaram para o próximo envio."""
    _, by_key = known_ids(db)
    found: dict[int, Media] = {}
    missing = []
    for i, film in enumerate(films):
        media_id = by_key.get(title_key("movie", film.name, film.year))
        if media_id:
            found[i] = db.get(Media, media_id)
        else:
            missing.append(i)
    if provider is None or not missing:
        return found, 0, set()

    with ThreadPoolExecutor(max_workers=provider.max_workers) as pool:
        ids = list(pool.map(lambda i: _tmdb_id(provider, films[i]), missing))
    brought, later = 0, set()
    for i, tmdb_id in zip(missing, ids):
        if tmdb_id is None:
            continue
        media = find_known(db, f"movie-{tmdb_id}")
        if media is None:
            if brought >= MAX_NEW:
                later.add(i)
                continue
            try:
                media, _ = import_tmdb(db, provider, "movie", tmdb_id)
            except TmdbError:
                continue
            brought += 1
        found[i] = media
    return found, brought, later


def import_letterboxd(db: Session, user: User, files: dict[str, str], provider: TmdbCatalogProvider | None) -> dict:
    by_key, ignored = read_exports(files)
    films = list(by_key.values())
    found, brought, later = match_films(db, films, provider)
    in_diary = set(db.scalars(select(DiaryEntry.media_id).where(DiaryEntry.user_id == user.id)))
    watchlist = crud.get_or_create_watchlist(db, user)
    logged = wanted = kept = 0
    for i, film in enumerate(films):
        media = found.get(i)
        if media is None:
            continue
        if media.id in in_diary:
            kept += 1
            continue
        if film.seen:
            entry = crud.upsert_diary(db, user, media.id, film.rating, film.review, film.watched_on)
            when = film.logged_on or film.watched_on
            if when:
                entry.created_at = datetime(when.year, when.month, when.day, 12, tzinfo=timezone.utc)
            in_diary.add(media.id)
            logged += 1
        elif film.watchlist:
            crud.add_to_list(db, watchlist, media.id)
            wanted += 1
    db.commit()
    not_found = [f"{f.name} ({f.year})" if f.year else f.name for i, f in enumerate(films) if i not in found and i not in later]
    return {
        "registered": logged,
        "want_to_watch": wanted,
        "already_in_diary": kept,
        "brought": brought,
        "next_time": len(later),
        "not_found": not_found[:50],
        "not_found_total": len(not_found),
        "ignored_files": ignored,
    }
