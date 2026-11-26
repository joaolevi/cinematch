"""Onde assistir no Brasil (RFF19), buscado no TMDB na hora e guardado por alguns dias no próprio título."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Media
from .tmdb import TmdbCatalogProvider, TmdbError

FRESH_FOR = timedelta(days=7)


def tmdb_id(media: Media) -> int | None:
    """O ID do TMDB de um título vindo de lá ("movie-155" -> 155). Títulos do catálogo offline não têm."""
    if media.source != "tmdb" or not media.external_id or "-" not in media.external_id:
        return None
    raw = media.external_id.rsplit("-", 1)[1]
    return int(raw) if raw.isdigit() else None


def _client() -> TmdbCatalogProvider:
    return TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, pages=1)


def merge_providers(media: Media, found: list[dict], now: datetime) -> list[dict]:
    """Os serviços novos, com `since`: desde quando o título está naquele serviço (RFF29). O que já estava guarda a data
    de antes. Na primeira busca de um título não dá para saber quando ele chegou, então `since` fica vazio, e ele não
    vira aviso."""
    known = media.providers_updated_at is not None
    before = {(p.get("service"), p.get("kind")): p.get("since") for p in media.providers or []}
    out = []
    for p in found:
        key = (p.get("service"), p.get("kind"))
        since = before[key] if key in before else (now.isoformat() if known else None)
        out.append({**p, "since": since})
    return out


def where_to_watch(db: Session, media: Media) -> list[dict]:
    """Os serviços guardados, se ainda estiverem frescos; senão, busca de novo. Sem chave, sem TMDB ou com erro,
    devolve o que tiver guardado: o detalhe nunca quebra por causa disso."""
    if media.type not in ("movie", "series"):
        return []
    updated = media.providers_updated_at
    if updated is not None and updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)  # o SQLite guarda sem fuso
    fresh = updated is not None and datetime.now(timezone.utc) - updated < FRESH_FOR
    tid = tmdb_id(media)
    if fresh or tid is None or not settings.tmdb_api_key:
        return media.providers or []
    client = _client()
    try:
        now = datetime.now(timezone.utc)
        media.providers = merge_providers(media, client.watch_providers(media.type, tid), now)
        media.providers_updated_at = now
        db.commit()
    except TmdbError:
        db.rollback()
    finally:
        client.close()
    return media.providers or []


def fill_providers(db: Session, client: TmdbCatalogProvider, only_stale: bool = True) -> dict:
    """Busca onde assistir todos os filmes e séries do TMDB, para o "só nos meus serviços" (RFF21) funcionar no feed,
    que não pode esperar uma consulta por título. Com `only_stale`, pula o que foi buscado há menos de 7 dias."""
    from sqlalchemy import select

    now = datetime.now(timezone.utc)
    done = skipped = failed = 0
    for media in db.scalars(select(Media).where(Media.type.in_(("movie", "series")))).all():
        tid = tmdb_id(media)
        updated = media.providers_updated_at
        if updated is not None and updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        if tid is None or (only_stale and updated is not None and now - updated < FRESH_FOR):
            skipped += 1
            continue
        try:
            media.providers = merge_providers(media, client.watch_providers(media.type, tid), now)
            media.providers_updated_at = now
            done += 1
        except TmdbError:
            failed += 1
    db.commit()
    return {"atualizados": done, "pulados": skipped, "falhas": failed}
