"""Catálogo externo (ator secundário "API de Catálogo Externo" do DCU).

Os títulos vêm de um `CatalogProvider`: o mock em JSON ou o TMDB (`services/tmdb.py`). Para outra fonte,
como o MusicBrainz, basta criar outro provider com `fetch_titles()`: o resto do sistema não precisa mudar.
"""

import json
import unicodedata
from pathlib import Path
from typing import Protocol, TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Media


class ExternalTitle(TypedDict, total=False):
    external_id: str
    type: str
    title: str
    year: int
    overview: str
    poster_url: str | None
    genres: list[str]
    tags: list[str]
    creators: list[str]
    popularity: float


class CatalogProvider(Protocol):
    name: str

    def fetch_titles(self) -> list[ExternalTitle]: ...


class MockCatalogProvider:
    """Lê títulos de um JSON local, simulando a resposta de uma API externa."""

    def __init__(self, path: Path, name: str = "mock"):
        self.path = path
        self.name = name

    def fetch_titles(self) -> list[ExternalTitle]:
        with open(self.path, encoding="utf-8") as f:
            return json.load(f)


# Origem com dados mais confiáveis "promove" um título igual de origem inferior
SOURCE_PRIORITY = {"manual": 0, "mock": 1, "tmdb": 2}

_FIELDS = ("type", "title", "year", "overview", "poster_url", "genres", "tags", "creators", "popularity")


def search_text(text: str) -> str:
    """Prepara um texto para busca, sem diferenciar acentos nem maiúsculas."""
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).casefold()


def title_key(media_type: str, title: str, year: int | None) -> tuple[str, str, int | None]:
    """Chave para reconhecer o mesmo título vindo de origens diferentes (ex.: mock e TMDB)."""
    norm = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    norm = "".join(ch for ch in norm if ch.isalnum())
    return (media_type, norm, year)


def sync_catalog(db: Session, provider: CatalogProvider, source: str = "mock") -> dict:
    """Insere ou atualiza os títulos do provedor.

    - Mesmo `source` + `external_id` -> atualiza o registro.
    - Mesmo tipo + título + ano já cadastrado por outra origem -> o registro existente é
      "promovido" para esta origem (ex.: o mock vira TMDB e ganha pôster), sem duplicar.
    """
    titles = provider.fetch_titles()
    all_media = list(db.scalars(select(Media)))
    by_external = {m.external_id: m for m in all_media if m.source == source and m.external_id}
    by_key = {title_key(m.type, m.title, m.year): m for m in all_media}

    created = updated = merged = skipped = 0
    for t in titles:
        data = {k: t.get(k) for k in _FIELDS if k in t}
        media = by_external.get(t["external_id"])
        if media is None:
            twin = by_key.get(title_key(t["type"], t["title"], t.get("year")))
            if twin is not None and twin.source != source:
                if SOURCE_PRIORITY.get(source, 0) <= SOURCE_PRIORITY.get(twin.source, 0):
                    skipped += 1  # já existe com dados de origem igual ou melhor
                    continue
                twin.source, twin.external_id = source, t["external_id"]
                media = twin
                merged += 1
        if media is None:
            media = Media(source=source, external_id=t["external_id"], **data)
            db.add(media)
            created += 1
        else:
            changed = False
            for k, v in data.items():
                if v in (None, "", []) and getattr(media, k):
                    continue  # não apaga dados existentes com campos vazios do provedor
                if getattr(media, k) != v:
                    setattr(media, k, v)
                    changed = True
            updated += int(changed)
        by_external[t["external_id"]] = media
        by_key[title_key(media.type, media.title, media.year)] = media
    db.commit()
    return {
        "provider": provider.name,
        "fetched": len(titles),
        "created": created,
        "updated": updated,
        "merged": merged,
        "skipped": skipped,
    }
