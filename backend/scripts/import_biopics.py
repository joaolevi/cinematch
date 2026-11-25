"""Traz para o catálogo os filmes e os discos da lista de cinebiografias e documentários (`data/cinebiografias.csv`)
e liga cada par (RFF26). Os que já estão no catálogo não são buscados de novo.

Uso: python -m scripts.import_biopics   (precisa da TASTORY_TMDB_API_KEY; o MusicBrainz pede uma consulta por segundo,
então leva uns 2 minutos)
"""

import json
import time

from app.config import settings
from app.db import SessionLocal
from app.services.bridges import biopic_rows, build_biopic_bridges
from app.services.importing import find_known, import_album, import_tmdb
from app.services.moods import fill_moods
from app.services.musicbrainz import MusicBrainzClient, MusicBrainzError
from app.services.tmdb import TmdbCatalogProvider, TmdbError


def main() -> None:
    if not settings.tmdb_api_key:
        raise SystemExit("Configure a TASTORY_TMDB_API_KEY no .env para buscar os filmes.")
    rows = biopic_rows()
    films = list(dict.fromkeys(r["filme"].strip() for r in rows))
    albums = list(dict.fromkeys(f"album-{r['mbid'].strip()}" for r in rows))
    tmdb = TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, pages=1)
    mb = MusicBrainzClient()
    brought, failed = [], []
    try:
        with SessionLocal() as db:
            for external_id in films:
                if find_known(db, external_id):
                    continue
                tmdb_type, tmdb_id = external_id.split("-", 1)
                try:
                    media, _ = import_tmdb(db, tmdb, "movie" if tmdb_type == "movie" else "series", int(tmdb_id))
                    brought.append(media.title)
                except TmdbError as e:
                    failed.append(f"{external_id}: {e}")
            for external_id in albums:
                if find_known(db, external_id):
                    continue
                try:
                    media, _ = import_album(db, mb, external_id.removeprefix("album-"))
                    brought.append(media.title)
                except MusicBrainzError as e:
                    failed.append(f"{external_id}: {e}")
                time.sleep(1)  # o MusicBrainz pede no máximo uma consulta por segundo
            fill_moods(db)
            result = {"trazidos": brought, "falhas": failed, "pontes": build_biopic_bridges(db)}
    finally:
        tmdb.close()
        mb.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
