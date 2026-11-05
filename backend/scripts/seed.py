"""Recria o banco do zero com os dados de demonstração.

Uso (a partir de backend/):
    python -m scripts.seed            # apaga e recria tudo (catálogo + usuários + simulação A/B)
    python -m scripts.seed --no-sim   # sem simular interações A/B
    python -m scripts.seed --tmdb     # além do mock, importa os populares do TMDB e completa pôsteres (precisa da chave)
"""

import argparse
import json

from app.config import settings
from app.db import Base, SessionLocal, engine
from app.seed import seed_all
from app.services.catalog import sync_catalog
from app.services.tmdb import TmdbCatalogProvider, TmdbError, enrich_catalog


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-sim", action="store_true", help="não simula o teste A/B")
    parser.add_argument("--no-synthetic", action="store_true", help="não cria usuários sintéticos")
    parser.add_argument("--tmdb", action="store_true", help="importa também os populares do TMDB")
    args = parser.parse_args()

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        summary = seed_all(db, synthetic=not args.no_synthetic, simulate=not args.no_sim)
        if args.tmdb:
            if not settings.tmdb_api_key:
                print("Aviso: CINEMATCH_TMDB_API_KEY não configurada; pulando o TMDB.")
            else:
                provider = TmdbCatalogProvider(
                    settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, settings.tmdb_sync_pages
                )
                try:
                    summary["tmdb"] = sync_catalog(db, provider, source="tmdb")
                    summary["tmdb_enrich"] = enrich_catalog(db, provider)
                except TmdbError as e:
                    print(f"Aviso: falha ao sincronizar com o TMDB ({e}); seguindo só com o mock.")
                finally:
                    provider.close()
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
