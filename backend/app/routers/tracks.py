"""Faixas dos álbuns: a lista do disco, a página de cada faixa e ouvi, nota e anotação."""

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import Media, User
from ..schemas import EpisodeIn, PartSaved, TrackDetailOut, TrackOut
from ..services.episodes import save_part
from ..services.tracks import has_track, track_detail, tracks_of

router = APIRouter(prefix="/media", tags=["faixas"])


def _album(db: Session, media_id: int) -> Media:
    media = crud.get_media_or_404(db, media_id)
    if media.type != "album":
        raise HTTPException(status_code=404, detail="Só álbuns têm faixas")
    return media


@router.get("/{media_id}/tracks", response_model=list[TrackOut])
def album_tracks(media_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """As faixas do álbum, do MusicBrainz, com o que quem pede marcou. Lista vazia quando ainda não dá para saber."""
    return tracks_of(db, user, _album(db, media_id))


@router.get("/{media_id}/tracks/{disc}/{number}", response_model=TrackDetailOut)
def track_page(
    media_id: int,
    disc: int = Path(ge=1, le=50),
    number: int = Path(ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A página da faixa: título, duração e artistas; o que quem pede marcou; quantas pessoas ouviram e a média das
    notas; e a faixa de antes e a de depois."""
    detail = track_detail(db, user, _album(db, media_id), disc, number)
    if detail is None:
        raise HTTPException(status_code=404, detail="Este álbum não tem essa faixa")
    return detail


@router.put("/{media_id}/tracks/{disc}/{number}", response_model=PartSaved)
def rate_track(
    data: EpisodeIn,
    media_id: int,
    disc: int = Path(ge=1, le=50),
    number: int = Path(ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marca a faixa como ouvida, com nota e anotação se quiser; a anotação só a própria pessoa vê. `seen: false`
    desmarca. Não mexe no diário: o álbum entra no diário pelo "Já ouvi"."""
    media = _album(db, media_id)
    if not has_track(media, disc, number):
        raise HTTPException(status_code=404, detail="Este álbum não tem essa faixa")
    return save_part(db, user, media, disc, number, data.rating, data.note, data.seen)
