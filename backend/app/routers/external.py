"""Adicionar ao catálogo um título que ainda não está lá, sem depender da administração (RFF13).

A pessoa busca no TMDB (filmes e séries) ou no MusicBrainz (álbuns) e importa o que quer registrar. Cada pessoa importa
até 10 títulos por dia; o que já está no catálogo não conta.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas import ExternalAddIn, ExternalTitleOut, MediaOut
from ..services import add_quota
from ..services.catalog import title_key
from ..services.importing import find_known, import_album, import_tmdb, known_ids
from ..services.musicbrainz import MusicBrainzClient, MusicBrainzError
from ..services.tmdb import TmdbCatalogProvider, TmdbError

router = APIRouter(prefix="/external", tags=["adicionar títulos"])

TMDB_TYPES = {"movie": "movie", "tv": "series"}


def tmdb_client() -> TmdbCatalogProvider:
    if not settings.tmdb_api_key:
        raise HTTPException(status_code=503, detail="A busca no TMDB não está disponível neste servidor")
    return TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, pages=1)


def musicbrainz_client() -> MusicBrainzClient:
    return MusicBrainzClient()


@router.get("/search", response_model=list[ExternalTitleOut])
def search(
    q: str = Query(min_length=2, max_length=120),
    type: Literal["video", "album"] = Query(
        default="video", description="video = filmes e séries, no TMDB; album = álbuns, no MusicBrainz"
    ),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Busca fora do catálogo. `media_id` vem preenchido quando o título já está no Tastory: aí é só abrir."""
    try:
        if type == "album":
            mb = musicbrainz_client()
            try:
                results = mb.search(q)
            finally:
                mb.close()
        else:
            tmdb = tmdb_client()
            try:
                results = tmdb.search(q, None)
            finally:
                tmdb.close()
    except (TmdbError, MusicBrainzError) as e:
        raise HTTPException(status_code=502, detail=f"A busca externa falhou: {e}")
    by_external, by_key = known_ids(db)
    return [
        ExternalTitleOut(
            **r,
            media_id=by_external.get(r["external_id"]) or by_key.get(title_key(r["type"], r["title"], r.get("year"))),
        )
        for r in results
    ]


@router.post(
    "/import",
    response_model=MediaOut,
    status_code=201,
    responses={200: {"description": "O título já estava no catálogo"}, 429: {"description": "Limite do dia; veja Retry-After"}},
)
def add(
    data: ExternalAddIn,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Traz um título para o catálogo pelo `external_id` da busca. Se ele já estiver lá, devolve com 200 e não gasta
    o limite. Cada pessoa importa até 10 títulos em 24 horas; depois, 429 com `Retry-After`. Um álbum leva alguns
    segundos: o MusicBrainz aceita uma consulta por segundo."""
    known = find_known(db, data.external_id)
    if known is not None:
        response.status_code = 200
        return known
    wait = add_quota.wait_seconds(user.id)
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"Você já trouxe {add_quota.MAX_PER_DAY} títulos hoje. Tente de novo amanhã.",
            headers={"Retry-After": str(wait)},
        )
    kind, _, ident = data.external_id.partition("-")
    try:
        if kind == "album":
            mb = musicbrainz_client()
            try:
                media, _result = import_album(db, mb, ident)
            finally:
                mb.close()
        else:
            tmdb = tmdb_client()
            try:
                media, _result = import_tmdb(db, tmdb, TMDB_TYPES[kind], int(ident))
            finally:
                tmdb.close()
    except (TmdbError, MusicBrainzError) as e:
        raise HTTPException(status_code=e.status_code if e.status_code == 404 else 502, detail=str(e))
    add_quota.used(user.id)
    return media
