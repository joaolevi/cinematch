import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.config import (
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_DEMO_PASSWORD,
    DEFAULT_SECRET_KEY,
    DEFAULT_SYNTHETIC_PASSWORD,
    Settings,
)

PUBLIC = {
    "secret_key": DEFAULT_SECRET_KEY,
    "admin_password": DEFAULT_ADMIN_PASSWORD,
    "demo_password": DEFAULT_DEMO_PASSWORD,
    "synthetic_password": DEFAULT_SYNTHETIC_PASSWORD,
}


def test_local_accepts_public_values():
    assert Settings(environment="local", **PUBLIC).production_problems() == []


def test_production_rejects_public_values():
    problems = Settings(environment="production", **PUBLIC).production_problems()
    assert problems == [
        "TASTORY_SECRET_KEY",
        "TASTORY_ADMIN_PASSWORD",
        "TASTORY_DEMO_PASSWORD",
        "TASTORY_SYNTHETIC_PASSWORD",
    ]


def test_production_accepts_own_values():
    own = Settings(
        environment="production",
        secret_key="x" * 32,
        admin_password="senha-do-admin",
        demo_password="senha-da-demo",
        synthetic_password="senha-sintetica",
    )
    assert own.production_problems() == []


def test_app_does_not_start_with_public_values(monkeypatch):
    monkeypatch.setattr(main_module, "settings", Settings(environment="production", **PUBLIC))
    with pytest.raises(RuntimeError, match="TASTORY_SECRET_KEY"):
        with TestClient(main_module.app):
            pass
