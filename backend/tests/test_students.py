from fastapi.testclient import TestClient


def test_list_students(client: TestClient, auth_headers, student_user):
    res = client.get("/api/students", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(s["name"] == "Student" and s["id"] == str(student_user.id) for s in data)


def test_list_students_unauthorized(client: TestClient):
    res = client.get("/api/students")
    assert res.status_code == 401


def test_list_students_search(client: TestClient, auth_headers, student_user):
    res = client.get("/api/students", params={"search": "Student"}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any(s["name"] == "Student" for s in data)


def test_list_students_search_empty(client: TestClient, auth_headers):
    res = client.get("/api/students", params={"search": "NonexistentName123"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []
