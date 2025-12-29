from fastapi.testclient import TestClient


def test_health(client: TestClient):
    """Health endpoint returns ok."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
