from fastapi.testclient import TestClient

from cute_cat.main import app


def test_health_root() -> None:
    c = TestClient(app)
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_prefixed() -> None:
    c = TestClient(app)
    r = c.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
