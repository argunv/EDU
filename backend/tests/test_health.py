import pytest
from fastapi.testclient import TestClient

from app.deps import get_db
from app.main import app


@pytest.fixture
def app_client() -> TestClient:
    """HTTP client without conftest db fixture (for tests that override get_db)."""
    with TestClient(app) as c:
        yield c


def test_health(client: TestClient):
    """Health endpoint returns ok."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_ready(client: TestClient):
    """Readiness endpoint checks db and returns ready."""
    res = client.get("/api/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ready", "db": "ok"}


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
        assert res.json() == {"status": "not_ready", "db": "error"}
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_metrics_root_endpoint(client: TestClient):
    """Prometheus metrics are exposed on root /metrics endpoint."""
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "text/plain" in res.headers.get("content-type", "")
    body = res.text
    assert "http_requests_total" in body
    assert "http_request_duration_seconds_bucket" in body
