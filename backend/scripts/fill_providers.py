"""Busca no TMDB onde assistir cada filme e série (RFF19), para o filtro "só nos meus serviços" (RFF21).

Uso: python -m scripts.fill_providers   (precisa da TASTORY_TMDB_API_KEY; uma consulta por título, uns 2 minutos)
Os dados de onde assistir são da JustWatch: a interface mostra o crédito. Pula o que foi buscado há menos de 7 dias.
"""

import json

from app.config import settings
from app.db import SessionLocal
from app.services.providers import fill_providers
from app.services.tmdb import TmdbCatalogProvider


def main() -> None:
    if not settings.tmdb_api_key:
        raise SystemExit("Configure a TASTORY_TMDB_API_KEY no .env para buscar onde assistir.")
    provider = TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, 1)
    try:
        with SessionLocal() as db:
            print(json.dumps(fill_providers(db, provider), ensure_ascii=False))
    finally:
        provider.close()


if __name__ == "__main__":
    main()
