"""Faixas dos álbuns: a lista vem do MusicBrainz e fica guardada na memória da API, como os episódios das séries.

O álbum é um "release group" do MusicBrainz; as faixas saem do lançamento oficial mais antigo (o mesmo de onde vêm a
duração e os links do disco). São duas requisições, respeitando o limite de uma por segundo. Sem rede, ou para um
álbum que não veio do MusicBrainz, a lista fica vazia e a tela avisa.

Ouvi, nota e anotação de cada faixa usam a mesma tabela dos episódios (`EpisodeEntry`), com o disco no lugar da
temporada e a faixa no lugar do episódio.
"""

from datetime import timezone
from threading import Lock

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import EpisodeEntry, Media, User
from .episodes import _mine, community_of
from .musicbrainz import MB_URL, VARIOUS_ARTISTS, MusicBrainzClient, MusicBrainzError, representative_release

_cache: dict[str, list[dict]] = {}
_lock = Lock()


def mbid_of(media: Media) -> str | None:
    """O id do álbum no MusicBrainz, quando ele veio de lá ("album-<mbid>")."""
    if media.type != "album" or not (media.external_id or "").startswith("album-"):
        return None
    return media.external_id.removeprefix("album-")


def _fetch(mbid: str) -> list[dict]:
    """A lista de faixas do MusicBrainz, já no formato da API. Separada para os testes trocarem por dados fixos."""
    client = MusicBrainzClient()
    try:
        group = client._get(f"{MB_URL}/release-group/{mbid}", inc="releases")
        release_id = representative_release(group.get("releases") or [])
        if not release_id:
            return []
        release = client._get(f"{MB_URL}/release/{release_id}", inc="recordings+artist-credits")
    finally:
        client.close()
    return tracks_from_release(release)


def tracks_from_release(release: dict) -> list[dict]:
    """Converte um lançamento do MusicBrainz nas faixas: disco, número, título, duração e artistas."""
    out = []
    for disc, medium in enumerate(release.get("media") or [], start=1):
        for track in medium.get("tracks") or []:
            length = track.get("length") or (track.get("recording") or {}).get("length")
            out.append({
                "disc": medium.get("position") or disc,
                "number": track.get("position") or len(out) + 1,
                "title": track.get("title") or (track.get("recording") or {}).get("title") or "Faixa sem nome",
                "length_sec": round(length / 1000) if length else None,
                "artists": [c["name"] for c in track.get("artist-credit") or []
                            if (c.get("artist") or {}).get("id") != VARIOUS_ARTISTS],
            })
    return out


def tracklist(media: Media) -> list[dict]:
    """As faixas do álbum, do cache ou do MusicBrainz. Se ele falhar, volta vazio, e a próxima vez tenta de novo."""
    mbid = mbid_of(media)
    if mbid is None:
        return []
    with _lock:
        if mbid in _cache:
            return _cache[mbid]
    try:
        tracks = _fetch(mbid)
    except MusicBrainzError:
        return []
    with _lock:
        _cache[mbid] = tracks
    return tracks


def tracks_of(db: Session, user: User, media: Media) -> list[dict]:
    """As faixas, com o que a pessoa marcou: ouvi, nota e anotação."""
    mine = {
        (e.season, e.episode): e
        for e in db.scalars(select(EpisodeEntry).where(EpisodeEntry.user_id == user.id, EpisodeEntry.media_id == media.id))
    }
    return [{**t, **_mine(mine.get((t["disc"], t["number"])))} for t in tracklist(media)]


def _ref(t: dict | None) -> dict | None:
    return {"disc": t["disc"], "number": t["number"], "title": t["title"]} if t else None


def track_detail(db: Session, user: User, media: Media, disc: int, number: int) -> dict | None:
    """A faixa, com a de antes e a de depois (passando de um disco para o outro). None se ela não existe."""
    tracks = tracks_of(db, user, media)
    index = next((i for i, t in enumerate(tracks) if (t["disc"], t["number"]) == (disc, number)), None)
    if index is None:
        return None
    return {
        **tracks[index],
        "album": media,
        "total": len(tracks),
        "discs": len({t["disc"] for t in tracks}),
        "position": index + 1,
        "previous": _ref(tracks[index - 1]) if index > 0 else None,
        "next": _ref(tracks[index + 1]) if index + 1 < len(tracks) else None,
        **community_of(db, media.id, disc, number),
    }


def cached_tracklist(media: Media) -> list[dict] | None:
    """As faixas, só se já estão na memória da API. Serve para listas que não podem esperar o MusicBrainz."""
    mbid = mbid_of(media)
    with _lock:
        return _cache.get(mbid) if mbid else None


def listening_now(db: Session, user: User) -> list[dict]:
    """Continuar ouvindo: os discos com faixas ouvidas que a pessoa ainda não registrou como "Já ouvi", da mexida por
    último para a mais antiga. Quando a lista de faixas já está na memória, vêm o total e a próxima faixa; senão, só
    quantas foram ouvidas (a lista não é buscada aqui, para o Início não esperar o MusicBrainz)."""
    from sqlalchemy import func

    from ..models import DiaryEntry

    rows = db.execute(
        select(EpisodeEntry.media_id, func.count(), func.max(EpisodeEntry.updated_at))
        .join(Media, Media.id == EpisodeEntry.media_id)
        .where(EpisodeEntry.user_id == user.id, Media.type == "album")
        .group_by(EpisodeEntry.media_id)
    ).all()
    registered = set(db.scalars(select(DiaryEntry.media_id).where(DiaryEntry.user_id == user.id)))
    out = []
    for media_id, heard, moved in rows:
        if media_id in registered:
            continue
        media = db.get(Media, media_id)
        tracks = cached_tracklist(media)
        nxt = None
        if tracks:
            if heard >= len(tracks):
                continue  # ouviu tudo: o disco sai daqui, e o "Já ouvi" fica com a pessoa
            mine = {(e.season, e.episode) for e in db.scalars(
                select(EpisodeEntry).where(EpisodeEntry.user_id == user.id, EpisodeEntry.media_id == media_id))}
            nxt = next(({"disc": t["disc"], "number": t["number"], "title": t["title"]}
                        for t in tracks if (t["disc"], t["number"]) not in mine), None)
        moved = moved if moved.tzinfo else moved.replace(tzinfo=timezone.utc)
        out.append({"media": media, "heard": heard, "total": len(tracks) if tracks else None, "next_track": nxt,
                    "moved_at": moved})
    return sorted(out, key=lambda x: x["moved_at"], reverse=True)


def has_track(media: Media, disc: int, number: int) -> bool:
    return any((t["disc"], t["number"]) == (disc, number) for t in tracklist(media))
