import pytest
from fastapi.testclient import TestClient

from app.deps import get_db
from app.main import app
from app.routers import health as health_router


@pytest.fixture
def app_client() -> TestClient:
    """HTTP client without conftest db fixture (for tests that override get_db)."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _ready_deps_ok(monkeypatch):
    """CI/local pytest usually has no Redis/RabbitMQ; readiness still asserts the contract."""
    monkeypatch.setattr(health_router, "_check_redis", lambda: True)
    monkeypatch.setattr(health_router, "_check_rabbitmq", lambda: True)


def test_health(client: TestClient):
    """Health endpoint returns ok."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_ready(client: TestClient):
    """Readiness endpoint checks db/redis/rabbitmq and returns ready."""
    res = client.get("/api/ready")
    assert res.status_code == 200
    assert res.json() == {
        "status": "ready",
        "db": "ok",
        "redis": "ok",
        "rabbitmq": "ok",
    }


def test_ready_returns_503_when_db_check_fails(app_client: TestClient):
    """Readiness returns 503 when DB execute fails (no real connection string in response)."""

    def failing_get_db():
        class _BrokenSession:
            def execute(self, *_args, **_kwargs):
                raise RuntimeError("simulated db failure")

            def close(self) -> None:
                pass

        db = _BrokenSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = failing_get_db
    try:
        res = app_client.get("/api/ready")
        assert res.status_code == 503
        body = res.json()
        assert body["status"] == "not_ready"
        assert body["db"] == "error"
        assert body["redis"] == "ok"
        assert body["rabbitmq"] == "ok"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_ready_returns_503_when_redis_down(client: TestClient, monkeypatch):
    monkeypatch.setattr(health_router, "_check_redis", lambda: False)
    res = client.get("/api/ready")
    assert res.status_code == 503
    assert res.json()["redis"] == "error"


def test_metrics_root_endpoint(app_client: TestClient):
    """При ENVIRONMENT=test /metrics выключен (404); иначе см. main.py."""
    res = app_client.get("/metrics")
    assert res.status_code == 404
