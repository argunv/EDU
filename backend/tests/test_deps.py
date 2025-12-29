import uuid
import pytest
from fastapi.testclient import TestClient

from app.models.user import User
from app.models.class_model import Class
from app.services.auth import hash_password, create_access_token


def test_get_current_user_optional_no_header(client: TestClient, db):
    res = client.get("/api/classes")
    assert res.status_code == 401


def test_get_current_user_optional_invalid_token(client: TestClient):
    res = client.get("/api/classes", headers={"Authorization": "Bearer invalid-token"})
    assert res.status_code == 401


def test_get_current_user_optional_valid_token(client: TestClient, auth_headers):
    res = client.get("/api/classes", headers=auth_headers)
    assert res.status_code == 200


def test_require_roles_admin_only(client: TestClient, student_headers):
    res = client.get("/api/admin/users", headers=student_headers)
    assert res.status_code == 403


def test_require_roles_teacher_only(client: TestClient, auth_headers):
    res = client.get("/api/teacher/lessons", headers=auth_headers)
    assert res.status_code == 403
