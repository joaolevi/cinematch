"""Episódios das séries (RFF24): a lista de cada temporada vem do TMDB e fica guardada na memória da API.

Sem a chave do TMDB, ou se ele falhar, a lista sai das temporadas que já estão no catálogo: "Episódio 1" até o número
de episódios da temporada. Visto, nota e anotação de cada episódio ficam em `EpisodeEntry`: ter a linha é ter visto,
e a anotação é só da própria pessoa. A média das notas de todo mundo aparece na página do episódio.
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
STILL_URL = "https://image.tmdb.org/t/p/w780"  # a imagem do episódio, larga como uma cena
BLANK = {"name": None, "air_date": None, "overview": None, "still_url": None, "runtime": None, "directors": []}
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
            "still_url": f"{STILL_URL}{e['still_path']}" if e.get("still_path") else None,
            "runtime": e.get("runtime") or None,
            "directors": [c["name"] for c in e.get("crew") or [] if c.get("job") == "Director"][:2],
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
        episodes = [{"number": n, **BLANK} for n in range(1, total + 1)]
    mine = {
        e.episode: e
        for e in db.scalars(
            select(EpisodeEntry).where(
                EpisodeEntry.user_id == user.id, EpisodeEntry.media_id == media.id, EpisodeEntry.season == season
            )
        )
    }
    out = [{**e, **_mine(mine.get(e["number"]))} for e in episodes]
    # Um episódio marcado que a lista não traz (lista incompleta) não some
    numbers = {e["number"] for e in out}
    out += [{"number": n, **BLANK, **_mine(e)} for n, e in sorted(mine.items()) if n not in numbers]
    return out


def _mine(entry: EpisodeEntry | None) -> dict:
    if entry is None:
        return {"seen": False, "rating": None, "note": None}
    return {"seen": True, "rating": entry.rating, "note": entry.note}


def save_part(db: Session, user: User, media: Media, season: int, number: int, rating: float | None,
              note: str | None, seen: bool | None) -> dict:
    """Guarda visto, nota e anotação de um episódio (ou de uma faixa de disco, com o disco no lugar da temporada).

    `seen=False` desmarca. Sem `seen`, vale a regra antiga: sem nota e sem anotação, volta a não visto. Com nota ou
    anotação, fica visto. Devolve o que ficou guardado."""
    note = (note or "").strip() or None
    entry = db.scalar(
        select(EpisodeEntry).where(
            EpisodeEntry.user_id == user.id, EpisodeEntry.media_id == media.id,
            EpisodeEntry.season == season, EpisodeEntry.episode == number,
        )
    )
    if seen is False or (seen is None and rating is None and note is None):
        if entry is not None:
            db.delete(entry)
            db.commit()
        return {"number": number, **_mine(None)}
    if entry is None:
        entry = EpisodeEntry(user_id=user.id, media_id=media.id, season=season, episode=number)
        db.add(entry)
    entry.rating, entry.note, entry.updated_at = rating, note, datetime.now(timezone.utc)
    if media.type == "series":
        _watching(db, user, media, season)
    db.commit()
    return {"number": number, **_mine(entry)}


def _watching(db: Session, user: User, media: Media, season: int) -> None:
    """O primeiro episódio marcado põe a série no diário como "assistindo", na temporada dele; e a temporada acompanha
    o episódio mais adiante. Série já vista continua vista."""
    diary = db.scalar(select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media.id))
    if diary is None:
        crud.upsert_diary(db, user, media.id, status="watching", season=season)
    elif diary.status == "watching" and (diary.season or 0) < season:
        diary.season = season


def mark_season(db: Session, user: User, media: Media, season: int) -> list[dict]:
    """Marca como vistos todos os episódios da temporada. Nota e anotação de quem já tinha ficam como estão."""
    episodes = episodes_of(db, user, media, season)
    for e in episodes:
        if not e["seen"]:
            db.add(EpisodeEntry(user_id=user.id, media_id=media.id, season=season, episode=e["number"]))
    if episodes:
        _watching(db, user, media, season)
    db.commit()
    return episodes_of(db, user, media, season)


def community_of(db: Session, media_id: int, season: int, number: int) -> dict:
    """Quantas pessoas viram e a média das notas de todo mundo. As anotações não entram: são de cada um."""
    where = (EpisodeEntry.media_id == media_id, EpisodeEntry.season == season, EpisodeEntry.episode == number)
    seen_by = db.scalar(select(func.count()).select_from(EpisodeEntry).where(*where)) or 0
    count, average = db.execute(
        select(func.count(EpisodeEntry.rating), func.avg(EpisodeEntry.rating)).where(*where)
    ).one()
    return {"seen_by": seen_by, "ratings": count or 0, "average": round(average, 2) if average is not None else None}


def _ref(season: int, e: dict | None) -> dict | None:
    return {"season": season, "number": e["number"], "name": e.get("name")} if e else None


def episode_detail(db: Session, user: User, media: Media, season: int, number: int) -> dict | None:
    """O episódio, com o vizinho de antes e o de depois, inclusive entre temporadas. None se ele não existe."""
    episodes = episodes_of(db, user, media, season)
    index = next((i for i, e in enumerate(episodes) if e["number"] == number), None)
    if index is None:
        return None
    previous = _ref(season, episodes[index - 1]) if index > 0 else None
    following = _ref(season, episodes[index + 1]) if index + 1 < len(episodes) else None
    known = {t.get("number"): t for t in media.seasons or []}
    # Na virada de temporada, o vizinho é o último episódio da anterior ou o primeiro da próxima
    if previous is None and (before := known.get(season - 1)) and before.get("episodes"):
        previous = {"season": season - 1, "number": before["episodes"], "name": None}
    if following is None and season + 1 in known:
        following = {"season": season + 1, "number": 1, "name": None}
    return {
        **episodes[index],
        "season": season,
        "series": media,
        "previous": previous,
        "next": following,
        **community_of(db, media.id, season, number),
    }


def watching_now(db: Session, user: User) -> list[dict]:
    """As séries que a pessoa está assistindo, da mexida por último para a mais antiga: a temporada, quantos episódios
    dela foram vistos, quantos ela tem e o próximo episódio."""
    entries = db.scalars(
        select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.status == "watching")
    ).all()
    out = []
    for e in entries:
        media = e.media
        if media.type != "series":
            continue
        counts = counts_by_season(db, user.id, media.id)
        season = e.season or (max(int(s) for s in counts) if counts else 1)
        seen = counts.get(str(season), 0)
        total = next((t.get("episodes") for t in media.seasons or [] if t.get("number") == season), None)
        last = db.scalar(
            select(func.max(EpisodeEntry.updated_at)).where(EpisodeEntry.user_id == user.id, EpisodeEntry.media_id == media.id)
        )
        moved = max(x for x in (last, e.created_at) if x is not None)
        moved = moved if moved.tzinfo else moved.replace(tzinfo=timezone.utc)
        out.append({
            "media": media, "season": season, "seen": seen, "total": total,
            "next_episode": seen + 1 if total is None or seen < total else None, "moved_at": moved,
        })
    return sorted(out, key=lambda w: w["moved_at"], reverse=True)


def counts_by_season(db: Session, user_id: int, media_id: int) -> dict[str, int]:
    rows = db.execute(
        select(EpisodeEntry.season, func.count())
        .where(EpisodeEntry.user_id == user_id, EpisodeEntry.media_id == media_id)
        .group_by(EpisodeEntry.season)
    )
    return {str(season): n for season, n in rows}

