"""Тесты API аутентификации: регистрация, логин, /auth/me, logout."""
import uuid

from fastapi.testclient import TestClient

from app.models.user import User
from app.models.class_model import Class
from app.models.role_profiles import UserRole
from app.services.auth import create_access_token, hash_password


def test_register(client: TestClient):
    res = client.post(
        "/auth/register",
        json={"name": "Test User", "email": "new@test.com", "password": "password123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "new@test.com"
    assert data["user"]["role"] == "pending"


def test_register_duplicate_email(client: TestClient, db):
    cls = Class(id=uuid.uuid4(), name="1A", year_start=2024, grade=1, letter="A", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="existing@test.com",
        password_hash=hash_password("x"),
        name="Existing",
        role="pending",
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="rejected"))
    db.commit()
    res = client.post(
        "/auth/register",
        json={"name": "Other", "email": "existing@test.com", "password": "pass"},
    )
    assert res.status_code in (400, 422)


def test_login_wrong_password(client: TestClient, db):
    cls = Class(id=uuid.uuid4(), name="1A", year_start=2024, grade=1, letter="A", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("right"),
        name="User",
        role="student",
    )
    db.add(user)
    db.commit()
    res = client.post(
        "/auth/login",
        json={"login": "user@test.com", "password": "wrong"},
    )
    assert res.status_code == 401


def test_login_success(client: TestClient, db):
    cls = Class(id=uuid.uuid4(), name="1A", year_start=2024, grade=1, letter="A", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="User",
        role="student",
    )
    db.add(user)
    db.commit()
    res = client.post(
        "/auth/login",
        json={"login": "user@test.com", "password": "secret"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()
    assert res.json()["user"]["email"] == "user@test.com"


def test_auth_me_pending_user_ok(client: TestClient, db):
    """Пока аккаунт в ожидании — /auth/me доступен (сессия и фронт /pending)."""
    cls = Class(id=uuid.uuid4(), name="1A", year_start=2024, grade=1, letter="A", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="me_pend@test.com",
        password_hash=hash_password("secret"),
        name="PendingMe",
        role="pending",
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="pending"))
    db.commit()
    token = create_access_token(str(user.id))
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "pending"


def test_auth_me_rejected_user_forbidden(client: TestClient, db):
    cls = Class(id=uuid.uuid4(), name="1A", year_start=2024, grade=1, letter="A", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="me_rej@test.com",
        password_hash=hash_password("secret"),
        name="RejectedMe",
        role="rejected",
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="rejected"))
    db.commit()
    token = create_access_token(str(user.id))
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_login_rejected_user(client: TestClient, db):
    cls = Class(id=uuid.uuid4(), name="1A", year_start=2024, grade=1, letter="A", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="rej@test.com",
        password_hash=hash_password("secret"),
        name="Rejected",
        role="rejected",
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="rejected"))
    db.commit()
    res = client.post(
        "/auth/login",
        json={"login": "rej@test.com", "password": "secret"},
    )
    assert res.status_code == 403


def test_me_with_bearer(client: TestClient, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "admin@test.com"
    assert "access_token" in res.json()


def test_me_unauthorized(client: TestClient):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_logout(client: TestClient, auth_headers):
    res = client.post("/api/auth/logout", headers=auth_headers)
    assert res.status_code == 204


def test_logout_without_cookie(client: TestClient):
    res = client.post("/api/auth/logout")
    assert res.status_code == 204
