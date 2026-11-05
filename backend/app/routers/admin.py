"""Pacote Administração: Gerenciar Catálogo, Moderar Avaliações, Sincronizar Catálogo Externo + métricas."""

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
    MediaIn,
    MediaOut,
    MediaUpdate,
    MetricsOut,
    ReviewModerationIn,
    SyncOut,
)
from ..services.catalog import MockCatalogProvider, sync_catalog
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


@router.post("/sync", response_model=SyncOut)
def sync_external_catalog(db: Session = Depends(get_db)):
    """Simula a ingestão da API de Catálogo Externo (TMDB no pitch) a partir de um JSON mockado."""
    provider = MockCatalogProvider(settings.external_catalog_path, name="Mock TMDB")
    return sync_catalog(db, provider, source="mock")


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
