"""Catálogo externo (ator secundário "API de Catálogo Externo" do DCU).

No protótipo a API externa é simulada por arquivos JSON. Para usar uma API real (ex.: TMDB),
basta criar outro `CatalogProvider` com o mesmo método `fetch_titles()` — o resto do sistema
não precisa mudar.
"""

import json
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


_FIELDS = ("type", "title", "year", "overview", "poster_url", "genres", "tags", "creators", "popularity")


def sync_catalog(db: Session, provider: CatalogProvider, source: str = "mock") -> dict:
    """Insere ou atualiza (upsert por source + external_id) os títulos do provedor."""
    titles = provider.fetch_titles()
    existing = {
        m.external_id: m
        for m in db.scalars(select(Media).where(Media.source == source)).all()
        if m.external_id
    }
    created = updated = 0
    for t in titles:
        data = {k: t.get(k) for k in _FIELDS if k in t}
        media = existing.get(t["external_id"])
        if media is None:
            db.add(Media(source=source, external_id=t["external_id"], **data))
            created += 1
        else:
            changed = False
            for k, v in data.items():
                if getattr(media, k) != v:
                    setattr(media, k, v)
                    changed = True
            updated += int(changed)
    db.commit()
    return {"provider": provider.name, "fetched": len(titles), "created": created, "updated": updated}
