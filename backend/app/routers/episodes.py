"""Episódios das séries (RFF24): a lista de cada temporada, a página de cada episódio e visto, nota e anotação."""

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import Media, User
from ..schemas import EpisodeDetailOut, EpisodeIn, EpisodeOut, PartSaved
from ..services.episodes import episode_detail, episodes_of, mark_season, save_part, season_info

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


@router.get("/{media_id}/seasons/{season}/episodes/{episode}", response_model=EpisodeDetailOut)
def episode_page(
    media_id: int,
    season: int = Path(ge=1),
    episode: int = Path(ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A página do episódio: nome, data, duração, cena e sinopse do TMDB; o que quem pede marcou; quantas pessoas viram
    e a média das notas; e o episódio de antes e o de depois, inclusive entre temporadas."""
    detail = episode_detail(db, user, _season(db, media_id, season), season, episode)
    if detail is None:
        raise HTTPException(status_code=404, detail="Esta temporada não tem esse episódio")
    return detail


@router.post("/{media_id}/seasons/{season}/seen", response_model=list[EpisodeOut])
def season_seen(
    media_id: int,
    season: int = Path(ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marca como vistos todos os episódios da temporada, sem mexer na nota e na anotação de quem já tinha."""
    return mark_season(db, user, _season(db, media_id, season), season)


@router.put("/{media_id}/seasons/{season}/episodes/{episode}", response_model=PartSaved)
def rate_episode(
    data: EpisodeIn,
    media_id: int,
    season: int = Path(ge=1),
    episode: int = Path(ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marca o episódio como visto, com nota e anotação se quiser; a anotação só a própria pessoa vê. `seen: false`
    desmarca. O primeiro episódio marcado põe a série no diário como "assistindo"."""
    media = _season(db, media_id, season)
    return save_part(db, user, media, season, episode, data.rating, data.note, data.seen)
