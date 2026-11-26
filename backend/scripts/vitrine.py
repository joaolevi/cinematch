"""Preenche um banco que já existe com a vitrine (app/vitrine.py), sem apagar nada.

Uso (a partir de backend/):
    python -m scripts.vitrine

A conta demo ganha diário, listas, favoritos e episódios, e cinco pessoas de exemplo entram com resenhas, curtidas e
comentários. Pode rodar de novo: nada se repete.
"""

import json

from app.db import SessionLocal
from app.vitrine import build_vitrine


def main() -> None:
    with SessionLocal() as db:
        print(json.dumps(build_vitrine(db), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
