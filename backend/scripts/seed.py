"""Recria o banco do zero com os dados de demonstração.

Uso (a partir de backend/):
    python -m scripts.seed            # apaga e recria tudo (catálogo + usuários + simulação A/B)
    python -m scripts.seed --no-sim   # sem simular interações A/B
"""

import argparse
import json

from app.db import Base, SessionLocal, engine
from app.seed import seed_all


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-sim", action="store_true", help="não simula o teste A/B")
    parser.add_argument("--no-synthetic", action="store_true", help="não cria usuários sintéticos")
    args = parser.parse_args()

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        summary = seed_all(db, synthetic=not args.no_synthetic, simulate=not args.no_sim)
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
