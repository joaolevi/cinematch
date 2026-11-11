"""Carrega os álbuns de demonstração do MusicBrainz (RFF01).

Lê a lista curada (`data/albuns_demo.csv`, coluna `mbid`), busca cada álbum no MusicBrainz, no Cover Art Archive e no
ListenBrainz, grava o retrato em `data/albums_catalog.json` e coloca os álbuns no banco. O seed lê esse retrato, então
o catálogo de álbuns funciona sem internet. O MusicBrainz aceita uma consulta por segundo: 200 álbuns levam uns 10 min.

Uso (a partir de backend/):
    python -m scripts.import_albums                  # lista padrão; grava o retrato e o banco
    python -m scripts.import_albums --sem-banco      # só grava o retrato
    python -m scripts.import_albums --limite 5       # só os 5 primeiros, para testar
    python -m scripts.import_albums --do-retrato     # só coloca no banco o retrato já gerado, sem internet
"""

import argparse
import csv
import json
import sys
from pathlib import Path

from app.config import DATA_DIR, settings
from app.db import SessionLocal, engine
from app.migrations import atualizar_banco
from app.services.catalog import sync_catalog
from app.services.musicbrainz import MusicBrainzClient, MusicBrainzError
from app.services.tmdb import StaticProvider


def read_list(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [row for row in csv.DictReader(f) if row.get("mbid", "").strip()]


def apply_curation(albums: list[dict], rows: list[dict]) -> list[dict]:
    """A coluna `generos` da lista (separados por ;) substitui os gêneros que vieram do MusicBrainz.

    Serve para os discos que o MusicBrainz não classifica, como "Samba 808", do Wado.
    """
    chosen = {f"album-{r['mbid'].strip()}": [g.strip() for g in r.get("generos", "").split(";") if g.strip()] for r in rows}
    for album in albums:
        if chosen.get(album["external_id"]):
            album["genres"] = chosen[album["external_id"]]
    return albums


def fetch_albums(rows: list[dict], client: MusicBrainzClient) -> tuple[list[dict], list[str]]:
    mbids = [r["mbid"].strip() for r in rows]
    listeners = client.listeners(mbids)
    albums, failed = [], []
    for i, mbid in enumerate(mbids, 1):
        try:
            album = client.get_album(mbid, listeners.get(mbid, 0))
        except MusicBrainzError as e:
            failed.append(f"{mbid}: {e}")
            print(f"{i:3}/{len(mbids)} ERRO {mbid}: {e}", file=sys.stderr, flush=True)
            continue
        albums.append(album)
        print(f"{i:3}/{len(mbids)} {', '.join(album['creators']) or '(vários)'} - {album['title']} {album['genres']}",
              flush=True)
    return albums, failed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lista", nargs="?", type=Path, default=DATA_DIR / "albuns_demo.csv")
    parser.add_argument("--saida", type=Path, default=settings.albums_catalog_path)
    parser.add_argument("--sem-banco", action="store_true", help="só grava o retrato em JSON")
    parser.add_argument("--limite", type=int, default=None)
    parser.add_argument("--do-retrato", action="store_true", help="carrega o retrato existente no banco, sem consultar")
    args = parser.parse_args()

    if args.do_retrato:
        albums = json.loads(args.saida.read_text(encoding="utf-8"))
        atualizar_banco(engine)
        with SessionLocal() as db:
            print(sync_catalog(db, StaticProvider(albums, "Álbuns"), source="musicbrainz"))
        return

    rows = read_list(args.lista)[: args.limite]
    client = MusicBrainzClient()
    try:
        albums, failed = fetch_albums(rows, client)
    finally:
        client.close()
    apply_curation(albums, rows)
    albums.sort(key=lambda a: a["external_id"])  # ordem estável, para o diff do retrato ser legível
    args.saida.write_text(json.dumps(albums, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Retrato: {len(albums)} álbuns em {args.saida}" + (f"; {len(failed)} falharam" if failed else ""))

    if not args.sem_banco:
        atualizar_banco(engine)
        with SessionLocal() as db:
            print(sync_catalog(db, StaticProvider(albums, "MusicBrainz"), source="musicbrainz"))


if __name__ == "__main__":
    main()
