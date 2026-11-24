"""Trazer um título de fora para o catálogo: do TMDB (filmes e séries) ou do MusicBrainz (álbuns).

Usado pela administração e pela própria pessoa (RFF13). Importar de novo atualiza o título, sem duplicar.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Media
from .catalog import sync_catalog, title_key
from .musicbrainz import MusicBrainzClient
from .tmdb import StaticProvider, TmdbCatalogProvider


def import_tmdb(db: Session, tmdb: TmdbCatalogProvider, media_type: str, tmdb_id: int) -> tuple[Media, dict]:
    title = tmdb.get_title(media_type, tmdb_id)
    result = sync_catalog(db, StaticProvider([title]), source="tmdb")
    media = db.scalar(select(Media).where(Media.source == "tmdb", Media.external_id == title["external_id"]))
    return media, result


def import_album(db: Session, mb: MusicBrainzClient, mbid: str) -> tuple[Media, dict]:
    album = mb.get_album(mbid)
    result = sync_catalog(db, StaticProvider([album], "MusicBrainz"), source="musicbrainz")
    media = db.scalar(select(Media).where(Media.source == "musicbrainz", Media.external_id == album["external_id"]))
    return media, result


def known_ids(db: Session) -> tuple[dict[str, int], dict[str, int]]:
    """Os títulos que já estão no catálogo: pelo ID externo e por tipo + título + ano (como os do catálogo offline)."""
    by_external, by_key = {}, {}
    for m in db.scalars(select(Media)):
        if m.external_id:
            by_external[m.external_id] = m.id
        by_key[title_key(m.type, m.title, m.year)] = m.id
    return by_external, by_key


def find_known(db: Session, external_id: str) -> Media | None:
    return db.scalar(select(Media).where(Media.external_id == external_id, Media.source.in_(("tmdb", "musicbrainz"))))
