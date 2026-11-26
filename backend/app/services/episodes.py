"""Episódios das séries (RFF24): a lista de cada temporada vem do TMDB e fica guardada na memória da API.

Sem a chave do TMDB, ou se ele falhar, a lista sai das temporadas que já estão no catálogo: "Episódio 1" até o número
de episódios da temporada. A nota e a anotação de cada episódio ficam em `EpisodeEntry`, só para a própria pessoa.
"""

from datetime import date, datetime, timezone
from threading import Lock

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import crud
from ..config import settings
from ..models import DiaryEntry, EpisodeEntry, Media, User
from .providers import tmdb_id
from .tmdb import TmdbCatalogProvider, TmdbError

_cache: dict[tuple[int, int], list[dict]] = {}
_lock = Lock()


def _tmdb_season(media: Media, season: int) -> list[dict] | None:
    tid = tmdb_id(media)
    if tid is None or not settings.tmdb_api_key:
        return None
    with _lock:
        if (tid, season) in _cache:
            return _cache[(tid, season)]
    client = TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, pages=1)
    try:
        data = client._get(f"/tv/{tid}/season/{season}")
    except TmdbError:
        return None
    finally:
        client.close()
    episodes = [
        {
            "number": e["episode_number"],
            "name": e.get("name") or None,
            "air_date": _date(e.get("air_date")),
            "overview": (e.get("overview") or "").strip() or None,
        }
        for e in data.get("episodes") or []
        if e.get("episode_number")
    ]
    with _lock:
        _cache[(tid, season)] = episodes
    return episodes


def _date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def season_info(media: Media, season: int) -> dict | None:
    """A temporada no catálogo, ou None se ela não existe (quando sabemos quais existem)."""
    known = {t.get("number"): t for t in media.seasons or []}
    if known and season not in known:
        return None
    return known.get(season, {"number": season, "episodes": None})


def episodes_of(db: Session, user: User, media: Media, season: int) -> list[dict]:
    """Os episódios da temporada, com a nota e a anotação da pessoa."""
    info = season_info(media, season) or {}
    episodes = _tmdb_season(media, season)
    if not episodes:
        total = info.get("episodes") or 0
        episodes = [{"number": n, "name": None, "air_date": None, "overview": None} for n in range(1, total + 1)]
    mine = {
        e.episode: e
        for e in db.scalars(
            select(EpisodeEntry).where(
                EpisodeEntry.user_id == user.id, EpisodeEntry.media_id == media.id, EpisodeEntry.season == season
            )
        )
    }
    out = [{**e, "rating": mine[e["number"]].rating if e["number"] in mine else None,
            "note": mine[e["number"]].note if e["number"] in mine else None} for e in episodes]
    # Um episódio marcado que a lista não traz (lista incompleta) não some
    numbers = {e["number"] for e in out}
    out += [{"number": n, "name": None, "air_date": None, "overview": None, "rating": e.rating, "note": e.note}
            for n, e in sorted(mine.items()) if n not in numbers]
    return out


def save_episode(db: Session, user: User, media: Media, season: int, episode: int, rating: float | None,
                 note: str | None) -> dict:
    """Guarda a nota e a anotação do episódio. Sem as duas, o episódio volta a não visto. O primeiro episódio marcado
    põe a série no diário como "assistindo", na temporada dele; e a temporada acompanha o episódio mais adiante."""
    note = (note or "").strip() or None
    entry = db.scalar(
        select(EpisodeEntry).where(
            EpisodeEntry.user_id == user.id, EpisodeEntry.media_id == media.id,
            EpisodeEntry.season == season, EpisodeEntry.episode == episode,
        )
    )
    if rating is None and note is None:
        if entry is not None:
            db.delete(entry)
            db.commit()
        return {"number": episode, "rating": None, "note": None}
    if entry is None:
        entry = EpisodeEntry(user_id=user.id, media_id=media.id, season=season, episode=episode)
        db.add(entry)
    entry.rating, entry.note, entry.updated_at = rating, note, datetime.now(timezone.utc)

    diary = db.scalar(select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media.id))
    if diary is None:
        crud.upsert_diary(db, user, media.id, status="watching", season=season)
    elif diary.status == "watching" and (diary.season or 0) < season:
        diary.season = season
    db.commit()
    return {"number": episode, "rating": entry.rating, "note": entry.note}


def counts_by_season(db: Session, user_id: int, media_id: int) -> dict[str, int]:
    rows = db.execute(
        select(EpisodeEntry.season, func.count())
        .where(EpisodeEntry.user_id == user_id, EpisodeEntry.media_id == media_id)
        .group_by(EpisodeEntry.season)
    )
    return {str(season): n for season, n in rows}
