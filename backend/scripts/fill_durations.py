"""Completa a duração dos filmes e séries do TMDB que ainda não têm (RFF20: "até 2 horas").

Uso: python -m scripts.fill_durations   (precisa da TASTORY_TMDB_API_KEY; uma consulta por título, uns 2 minutos)
"""

import json

from app.config import settings
from app.db import SessionLocal
from app.services.tmdb import TmdbCatalogProvider, fill_durations


def main() -> None:
    if not settings.tmdb_api_key:
        raise SystemExit("Configure a TASTORY_TMDB_API_KEY no .env para buscar as durações.")
    provider = TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, 1)
    try:
        with SessionLocal() as db:
            print(json.dumps(fill_durations(db, provider), ensure_ascii=False))
    finally:
        provider.close()


if __name__ == "__main__":
    main()
