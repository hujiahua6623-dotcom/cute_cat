"""Pytest setup: env must be set before importing the app."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")


def pytest_configure() -> None:
    from cute_cat.config import get_settings
    from cute_cat.persistence.database import reset_engine

    get_settings.cache_clear()
    reset_engine()
