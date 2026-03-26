from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from cute_cat.main import app
from cute_cat.persistence.database import get_session
from cute_cat.persistence.models import Base


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

    async def _dispose():
        await engine.dispose()

    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        asyncio.run(_dispose())


def test_register_login_me_claim(client_with_db: TestClient) -> None:
    c = client_with_db
    r = c.post(
        "/api/v1/auth/register",
        json={"email": "a@b.com", "password": "password12", "nickname": "n"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert "accessToken" in body
    assert "refreshToken" in body
    uid = body["userId"]

    r2 = c.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {body['accessToken']}"},
    )
    assert r2.status_code == 200
    me = r2.json()
    assert me["userId"] == uid
    assert me["petId"] is None

    r3 = c.post(
        "/api/v1/pets/claim",
        headers={"Authorization": f"Bearer {body['accessToken']}"},
        json={"petName": "m", "petType": "cat"},
    )
    assert r3.status_code == 201, r.text
    claim = r3.json()
    pid = claim["petId"]

    r4 = c.get(
        f"/api/v1/pets/{pid}",
        headers={"Authorization": f"Bearer {body['accessToken']}"},
    )
    assert r4.status_code == 200
    snap = r4.json()
    assert snap["petId"] == pid
    assert "stats" in snap

    r5 = c.get(
        "/api/v1/offline-summary",
        params={"petId": pid},
        headers={"Authorization": f"Bearer {body['accessToken']}"},
    )
    assert r5.status_code == 200
    assert "reasons" in r5.json()


def test_refresh_returns_user_id(client_with_db: TestClient) -> None:
    c = client_with_db
    r = c.post(
        "/api/v1/auth/register",
        json={"email": "refresh_user@b.com", "password": "password12", "nickname": "n"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    uid = body["userId"]
    refresh = body["refreshToken"]

    rr = c.post("/api/v1/auth/refresh", json={"refreshToken": refresh})
    assert rr.status_code == 200, rr.text
    refreshed = rr.json()
    assert refreshed["userId"] == uid
    assert refreshed["accessToken"]
    assert refreshed["refreshToken"]
