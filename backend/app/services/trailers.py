"""O trailer de um filme ou série, do TMDB (que aponta para o YouTube), guardado na memória da API.

Prefere o trailer oficial em português; sem ele, o oficial em inglês; depois qualquer trailer ou teaser. Sem a chave
do TMDB, ou para títulos que não vieram de lá, não há trailer.
"""

from threading import Lock

from ..config import settings
from ..models import Media
from .providers import tmdb_id
from .tmdb import TmdbCatalogProvider, TmdbError

_cache: dict[str, dict | None] = {}
_lock = Lock()


def pick_trailer(videos: list[dict]) -> dict | None:
    """Escolhe o melhor vídeo do YouTube: trailer antes de teaser, oficial antes de não oficial, português antes de inglês."""
    usable = [v for v in videos if v.get("site") == "YouTube" and v.get("key") and v.get("type") in ("Trailer", "Teaser")]
    if not usable:
        return None
    lang = {"pt": 0, "en": 1}
    best = min(usable, key=lambda v: (v["type"] != "Trailer", not v.get("official"), lang.get(v.get("iso_639_1"), 2)))
    return {"key": best["key"], "name": best.get("name") or "Trailer", "language": best.get("iso_639_1")}


def _fetch(external_id: str) -> list[dict]:
    """Os vídeos do título no TMDB. Separada para os testes trocarem por dados fixos."""
    kind = "tv" if external_id.startswith("tv-") else "movie"
    client = TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, pages=1)
    try:
        return client._get(f"/{kind}/{tmdb_id_from(external_id)}/videos", include_video_language="pt,en,null").get("results") or []
    finally:
        client.close()


def tmdb_id_from(external_id: str) -> str:
    return external_id.rsplit("-", 1)[1]


def trailer_of(media: Media) -> dict | None:
    """O trailer, do cache ou do TMDB. Se o TMDB falhar, não guarda: a próxima vez tenta de novo."""
    if media.type == "album" or tmdb_id(media) is None or not settings.tmdb_api_key:
        return None
    with _lock:
        if media.external_id in _cache:
            return _cache[media.external_id]
    try:
        found = pick_trailer(_fetch(media.external_id))
    except TmdbError:
        return None
    with _lock:
        _cache[media.external_id] = found
    return found
