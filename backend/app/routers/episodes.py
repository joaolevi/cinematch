"""Episódios das séries (RFF24): a lista de cada temporada e a nota e a anotação de cada episódio."""

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import Media, User
from ..schemas import EpisodeIn, EpisodeOut
from ..services.episodes import episodes_of, save_episode, season_info

router = APIRouter(prefix="/media", tags=["episódios"])


def _season(db: Session, media_id: int, season: int) -> Media:
    media = crud.get_media_or_404(db, media_id)
    if media.type != "series":
        raise HTTPException(status_code=404, detail="Só séries têm episódios")
    if season_info(media, season) is None:
        raise HTTPException(status_code=404, detail="Esta série não tem essa temporada")
    return media


@router.get("/{media_id}/seasons/{season}/episodes", response_model=list[EpisodeOut])
def season_episodes(
    media_id: int,
    season: int = Path(ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Os episódios da temporada, com nome, data e sinopse do TMDB, e a nota e a anotação de quem pede. Sem o TMDB, a
    lista sai do número de episódios da temporada."""
    return episodes_of(db, user, _season(db, media_id, season), season)


@router.put("/{media_id}/seasons/{season}/episodes/{episode}", response_model=EpisodeOut)
def rate_episode(
    data: EpisodeIn,
    media_id: int,
    season: int = Path(ge=1),
    episode: int = Path(ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Dá nota a um episódio e/ou guarda uma anotação, que só a própria pessoa vê. Sem nota e sem anotação, o episódio
    volta a não visto. O primeiro episódio marcado põe a série no diário como "assistindo"."""
    media = _season(db, media_id, season)
    return save_episode(db, user, media, season, episode, data.rating, data.note)
