"""Configurações da aplicação, lidas de variáveis de ambiente (prefixo CINEMATCH_)."""

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"


def _bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "CINEMATCH_DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'cinematch.db'}"
        )
    )
    secret_key: str = field(
        default_factory=lambda: os.getenv("CINEMATCH_SECRET_KEY", "dev-secret-cinematch-troque-esta-chave-em-producao")
    )
    token_expire_minutes: int = field(
        default_factory=lambda: int(os.getenv("CINEMATCH_TOKEN_EXPIRE_MINUTES", "1440"))
    )
    auto_seed: bool = field(default_factory=lambda: _bool(os.getenv("CINEMATCH_AUTO_SEED", "true")))
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv(
            "CINEMATCH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
    )
    seed_catalog_path: Path = DATA_DIR / "seed_catalog.json"
    external_catalog_path: Path = DATA_DIR / "mock_external_catalog.json"


settings = Settings()
