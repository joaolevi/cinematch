"""Pacote Administração: Gerenciar Catálogo, Moderar Avaliações, Sincronizar Catálogo Externo + métricas."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import require_admin
from ..config import settings
from ..db import get_db
from ..models import DiaryEntry, Media
from ..schemas import (
    AdminReviewOut,
    ExternalTitleOut,
    MediaIn,
    MediaOut,
    MediaType,
    MediaUpdate,
    MetricsOut,
    ReviewModerationIn,
    SyncOut,
    TmdbImportIn,
    TmdbImportOut,
)
from ..services.catalog import MockCatalogProvider, sync_catalog, title_key
from ..services.tmdb import StaticProvider, TmdbCatalogProvider, TmdbError, enrich_catalog
from ..services.metrics import acceptance_metrics

router = APIRouter(prefix="/admin", tags=["administração"], dependencies=[Depends(require_admin)])


# ---------- Catálogo ----------
@router.post("/media", response_model=MediaOut, status_code=201)
def create_media(data: MediaIn, db: Session = Depends(get_db)):
    media = Media(source="manual", **data.model_dump())
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.patch("/media/{media_id}", response_model=MediaOut)
def update_media(media_id: int, data: MediaUpdate, db: Session = Depends(get_db)):
    media = crud.get_media_or_404(db, media_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(media, k, v)
    db.commit()
    db.refresh(media)
    return media


@router.delete("/media/{media_id}", status_code=204)
def delete_media(media_id: int, db: Session = Depends(get_db)):
    db.delete(crud.get_media_or_404(db, media_id))
    db.commit()
    return Response(status_code=204)


def tmdb_provider(pages: int | None = None) -> TmdbCatalogProvider:
    """Cria o provider do TMDB com a chave do .env (400 se não houver chave)."""
    if not settings.tmdb_api_key:
        raise HTTPException(status_code=400, detail="CINEMATCH_TMDB_API_KEY não configurada no .env")
    return TmdbCatalogProvider(
        settings.tmdb_api_key,
        language=settings.tmdb_language,
        region=settings.tmdb_region,
        pages=pages or settings.tmdb_sync_pages,
    )


@router.post("/sync", response_model=SyncOut)
def sync_external_catalog(
    provider: Literal["auto", "tmdb", "mock"] = "auto",
    pages: int | None = Query(default=None, ge=1, le=10, description="Páginas de populares do TMDB (20 por página)"),
    db: Session = Depends(get_db),
):
    """Sincronizar Catálogo Externo.

    - `tmdb`: importa filmes e séries populares do TMDB (precisa de chave no .env).
    - `mock`: importa o JSON mockado (funciona offline).
    - `auto` (padrão): TMDB se houver chave, senão mock.
    """
    use_tmdb = provider == "tmdb" or (provider == "auto" and settings.tmdb_api_key)
    if not use_tmdb:
        mock = MockCatalogProvider(settings.external_catalog_path, name="Mock TMDB")
        return sync_catalog(db, mock, source="mock")
    tmdb = tmdb_provider(pages)
    try:
        return sync_catalog(db, tmdb, source="tmdb")
    except TmdbError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    finally:
        tmdb.close()


@router.post("/tmdb/enrich")
def tmdb_enrich(db: Session = Depends(get_db)):
    """Procura no TMDB os títulos do catálogo sem pôster (ex.: os do mock) e completa com dados oficiais."""
    tmdb = tmdb_provider()
    try:
        return enrich_catalog(db, tmdb)
    except TmdbError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    finally:
        tmdb.close()


@router.get("/tmdb/search", response_model=list[ExternalTitleOut])
def tmdb_search(
    q: str = Query(min_length=1),
    type: MediaType | None = None,
    db: Session = Depends(get_db),
):
    """Busca títulos no TMDB para o admin escolher o que importar."""
    tmdb = tmdb_provider()
    try:
        results = tmdb.search(q, type)
    except TmdbError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    finally:
        tmdb.close()
    # reconhece o título já cadastrado pelo ID do TMDB ou por tipo + título + ano (ex.: vindo do mock)
    by_external, by_key = {}, {}
    for m in db.scalars(select(Media)):
        if m.source == "tmdb" and m.external_id:
            by_external[m.external_id] = m.id
        by_key[title_key(m.type, m.title, m.year)] = m.id
    return [
        ExternalTitleOut(
            **r,
            media_id=by_external.get(r["external_id"])
            or by_key.get(title_key(r["type"], r["title"], r.get("year"))),
        )
        for r in results
    ]


@router.post("/tmdb/import", response_model=TmdbImportOut, status_code=201)
def tmdb_import(data: TmdbImportIn, db: Session = Depends(get_db)):
    """Importa (ou atualiza) um título específico do TMDB pelo ID."""
    tmdb = tmdb_provider()
    try:
        title = tmdb.get_title(data.type, data.tmdb_id)
    except TmdbError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    finally:
        tmdb.close()
    result = sync_catalog(db, StaticProvider([title]), source="tmdb")
    media = db.scalar(
        select(Media).where(Media.source == "tmdb", Media.external_id == title["external_id"])
    )
    return TmdbImportOut(media=MediaOut.model_validate(media), result=SyncOut(**result))


# ---------- Moderação ----------
@router.get("/reviews", response_model=list[AdminReviewOut])
def list_reviews(
    hidden: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = (
        select(DiaryEntry)
        .where(DiaryEntry.review.is_not(None))
        .order_by(DiaryEntry.created_at.desc())
        .limit(limit)
    )
    if hidden is not None:
        q = q.where(DiaryEntry.review_hidden.is_(hidden))
    return [
        AdminReviewOut(
            id=e.id,
            user_name=e.user.name,
            user_email=e.user.email,
            media_id=e.media_id,
            media_title=e.media.title,
            rating=e.rating,
            review=e.review or "",
            review_hidden=e.review_hidden,
            created_at=e.created_at,
        )
        for e in db.scalars(q)
    ]


@router.patch("/reviews/{entry_id}", response_model=AdminReviewOut)
def moderate_review(entry_id: int, data: ReviewModerationIn, db: Session = Depends(get_db)):
    e = db.get(DiaryEntry, entry_id)
    if e is None or not e.review:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")
    e.review_hidden = data.hidden
    db.commit()
    return AdminReviewOut(
        id=e.id,
        user_name=e.user.name,
        user_email=e.user.email,
        media_id=e.media_id,
        media_title=e.media.title,
        rating=e.rating,
        review=e.review or "",
        review_hidden=e.review_hidden,
        created_at=e.created_at,
    )


# ---------- Métricas ----------
@router.get("/metrics", response_model=MetricsOut)
def metrics(db: Session = Depends(get_db)):
    return acceptance_metrics(db)
