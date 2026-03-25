"""Shared fixtures; clear in-memory garden hub between tests (prevents stale WS targets)."""

from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from cute_cat.main import app
from cute_cat.persistence.database import get_session, set_session_factory_override
from cute_cat.persistence.models import Base


@pytest.fixture(autouse=True)
def _reset_garden_hub() -> None:
    yield
    from cute_cat.realtime.garden_hub import hub

    hub.by_garden.clear()
    hub.by_user.clear()


@pytest.fixture
def client_with_db() -> TestClient:
    async def _setup():
        engine = create_async_engine(
            "sqlite+aiosqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return engine

    engine = asyncio.run(_setup())
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    set_session_factory_override(factory)

    async def _dispose():
        await engine.dispose()

    try:
        client = TestClient(app)
        setattr(client, "_session_factory", factory)
        yield client
    finally:
        app.dependency_overrides.clear()
        set_session_factory_override(None)
        asyncio.run(_dispose())
