import uuid
from fastapi.testclient import TestClient


def test_list_classes(client: TestClient, auth_headers, class_1a, class_9a):
    res = client.get("/api/classes", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    names = [c["name"] for c in data]
    assert "1A" in names
    assert "9A" in names


def test_list_classes_unauthorized(client: TestClient):
    res = client.get("/api/classes")
    assert res.status_code == 401


def test_get_class(client: TestClient, auth_headers, class_1a):
    res = client.get(f"/classes/{class_1a.id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == str(class_1a.id)
    assert res.json()["name"] == "1A"
    assert res.json()["shift"] == "morning"


def test_get_class_not_found(client: TestClient, auth_headers):
    res = client.get(f"/classes/{uuid.uuid4()}", headers=auth_headers)
    assert res.status_code == 404
