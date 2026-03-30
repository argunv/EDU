import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import settings
from app.core.timeutil import now
from app.services.auth import create_access_token


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


def test_optional_bearer_non_access_type_yields_unauthorized(client: TestClient, admin_user):
    """JWT не с type=access трактуется как отсутствие пользователя для опциональной auth."""
    expire = now() + timedelta(minutes=5)
    token = jwt.encode(
        {"sub": str(admin_user.id), "exp": expire, "type": "refresh"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    res = client.get("/api/classes", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_optional_bearer_malformed_sub_returns_401(client: TestClient):
    expire = now() + timedelta(minutes=5)
    token = jwt.encode(
        {"sub": "not-a-uuid", "exp": expire, "type": "access"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    res = client.get("/api/classes", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_optional_bearer_valid_token_unknown_user_returns_401(client: TestClient):
    ghost_id = str(uuid.uuid4())
    token = create_access_token(ghost_id)
    res = client.get("/api/classes", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
