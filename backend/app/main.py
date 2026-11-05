"""Ponto de entrada da API do CineMatch.

Rodar:  uvicorn app.main:app --reload   (a partir da pasta backend/)
Docs:   http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .config import settings
from .db import Base, SessionLocal, engine
from .models import Media
from .routers import admin, auth, diary, lists, media, recommendations

log = logging.getLogger("cinematch")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    if settings.auto_seed:
        with SessionLocal() as db:
            if not db.scalar(select(func.count()).select_from(Media)):
                from .seed import seed_all

                log.warning("Banco vazio: carregando dados iniciais... %s", seed_all(db))
    yield


app = FastAPI(
    title="CineMatch API",
    description="Diário e recomendador de filmes e séries — protótipo (Gerência de Projeto 2026.2).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, media.router, diary.router, lists.router, recommendations.router, admin.router):
    app.include_router(r)


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}
