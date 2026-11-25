"""Guarda as séries parecidas de cada série do catálogo, pela rota de recomendações do TMDB (RNFF06).

Traz também as séries que o TMDB recomenda para várias séries do catálogo e que ainda faltam nele. Para o recomendador
usar os vizinhos, defina TASTORY_USE_EXTERNAL_NEIGHBORS=true.

Uso: python -m scripts.import_series_neighbors [--min-citacoes 2] [--max-novas 60]
     (precisa da TASTORY_TMDB_API_KEY; uma consulta por série, mais os detalhes de cada série trazida)
"""

import argparse
import json

from app.config import settings
from app.db import SessionLocal
from app.services.moods import fill_moods
from app.services.series_neighbors import import_series_neighbors
from app.services.tmdb import TmdbCatalogProvider


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-citacoes", type=int, default=2, help="traz a série recomendada para ao menos N séries")
    parser.add_argument("--max-novas", type=int, default=60, help="no máximo N séries novas no catálogo")
    args = parser.parse_args()
    if not settings.tmdb_api_key:
        raise SystemExit("Configure a TASTORY_TMDB_API_KEY no .env para buscar as séries.")
    provider = TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, pages=1)
    try:
        with SessionLocal() as db:
            result = import_series_neighbors(db, provider, args.min_citacoes, args.max_novas)
            fill_moods(db)
    finally:
        provider.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
