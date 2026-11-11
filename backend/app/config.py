"""Configurações da aplicação, lidas de variáveis de ambiente (prefixo TASTORY_).

Também carrega um arquivo `.env` na raiz do repositório (ou em backend/), se existir.
Variáveis já definidas no ambiente têm prioridade sobre o `.env`.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"

# Valores públicos, só para uso local: em produção `production_problems` os recusa
DEFAULT_SECRET_KEY = "dev-secret-tastory-troque-esta-chave-em-producao"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_DEMO_PASSWORD = "demo123"
DEFAULT_SYNTHETIC_PASSWORD = "senha123"
PUBLIC_PASSWORDS = {DEFAULT_ADMIN_PASSWORD, DEFAULT_DEMO_PASSWORD, DEFAULT_SYNTHETIC_PASSWORD}


def load_dotenv(*paths: Path) -> None:
    """Leitor mínimo de .env (CHAVE=valor por linha, # para comentários)."""
    for path in paths:
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv(REPO_DIR / ".env", BACKEND_DIR / ".env")


def _bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "TASTORY_DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'tastory.db'}"
        )
    )
    environment: str = field(default_factory=lambda: os.getenv("TASTORY_ENV", "local"))
    secret_key: str = field(default_factory=lambda: os.getenv("TASTORY_SECRET_KEY", DEFAULT_SECRET_KEY))
    admin_password: str = field(
        default_factory=lambda: os.getenv("TASTORY_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)
    )
    demo_password: str = field(default_factory=lambda: os.getenv("TASTORY_DEMO_PASSWORD", DEFAULT_DEMO_PASSWORD))
    synthetic_password: str = field(
        default_factory=lambda: os.getenv("TASTORY_SYNTHETIC_PASSWORD", DEFAULT_SYNTHETIC_PASSWORD)
    )
    token_expire_minutes: int = field(
        default_factory=lambda: int(os.getenv("TASTORY_TOKEN_EXPIRE_MINUTES", "1440"))
    )
    auto_seed: bool = field(default_factory=lambda: _bool(os.getenv("TASTORY_AUTO_SEED", "true")))
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv(
            "TASTORY_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
    )
    use_external_neighbors: bool = field(
        default_factory=lambda: _bool(os.getenv("TASTORY_USE_EXTERNAL_NEIGHBORS", "false"))
    )
    seed_catalog_path: Path = DATA_DIR / "seed_catalog.json"
    external_catalog_path: Path = DATA_DIR / "mock_external_catalog.json"
    # Álbuns (RFF01): retrato do catálogo de demonstração, gerado por scripts/import_albums.py
    albums_catalog_path: Path = DATA_DIR / "albums_catalog.json"
    music_genres_path: Path = DATA_DIR / "generos_musicais.csv"
    # O MusicBrainz pede um User-Agent que identifique a aplicação; em produção, dá para pôr um contato
    musicbrainz_user_agent: str = field(
        default_factory=lambda: os.getenv("TASTORY_MUSICBRAINZ_USER_AGENT", "TastoryAcademico/0.1")
    )

    # TMDB (themoviedb.org) — opcional. Sem chave, a sincronização usa o catálogo mockado.
    tmdb_api_key: str = field(default_factory=lambda: os.getenv("TASTORY_TMDB_API_KEY", "").strip())
    tmdb_language: str = field(default_factory=lambda: os.getenv("TASTORY_TMDB_LANGUAGE", "pt-BR"))
    tmdb_region: str = field(default_factory=lambda: os.getenv("TASTORY_TMDB_REGION", "BR"))
    tmdb_sync_pages: int = field(default_factory=lambda: int(os.getenv("TASTORY_TMDB_SYNC_PAGES", "2")))

    def production_problems(self) -> list[str]:
        """Lista as variáveis com valores públicos, que impedem subir em produção."""
        if self.environment != "production":
            return []
        problems = []
        if "troque" in self.secret_key or len(self.secret_key) < 32:
            problems.append("TASTORY_SECRET_KEY")
        if self.admin_password in PUBLIC_PASSWORDS:
            problems.append("TASTORY_ADMIN_PASSWORD")
        if self.demo_password in PUBLIC_PASSWORDS:
            problems.append("TASTORY_DEMO_PASSWORD")
        if self.synthetic_password in PUBLIC_PASSWORDS:
            problems.append("TASTORY_SYNTHETIC_PASSWORD")
        return problems


settings = Settings()
