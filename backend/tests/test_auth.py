"""Тесты API аутентификации: регистрация, логин, /auth/me, logout."""
import hashlib
import uuid
from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.timeutil import now
from app.models.user import User, PasswordResetToken, RefreshToken
from app.models.class_model import Class
from app.models.role_profiles import UserRole
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)


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
    # Pending registration must not create a refresh session.
    assert "refresh_token" not in res.cookies


def test_register_rejects_short_password(client: TestClient):
    res = client.post(
        "/auth/register",
        json={"name": "Short", "email": "short@test.com", "password": "1234567"},
    )
    assert res.status_code == 422


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


def test_production_refresh_cookie_is_always_secure(client: TestClient, db, monkeypatch):
    user = User(
        id=uuid.uuid4(),
        email="secure@test.com",
        password_hash=hash_password("secret"),
        name="Secure User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()
    monkeypatch.setattr(settings, "environment", "production")

    login_res = client.post(
        "/api/auth/login",
        json={"login": "secure@test.com", "password": "secret"},
        headers={"X-Forwarded-Proto": "http"},
    )
    logout_res = client.post(
        "/api/auth/logout",
        headers={"X-Forwarded-Proto": "http"},
    )

    assert login_res.status_code == 200
    assert "secure" in login_res.headers["set-cookie"].lower()
    assert logout_res.status_code == 204
    assert "secure" in logout_res.headers["set-cookie"].lower()


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


def test_reset_password_invalidates_all_reset_tokens_and_refresh_sessions(
    client: TestClient, db
):
    user = User(
        id=uuid.uuid4(),
        email="reset@test.com",
        password_hash=hash_password("oldpass123"),
        name="Reset User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    raw_token = "reset-token-1"
    other_token = "reset-token-2"
    expires_at = now() + timedelta(hours=1)
    db.add_all(
        [
            PasswordResetToken(
                user_id=user.id,
                token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
                expires_at=expires_at,
            ),
            PasswordResetToken(
                user_id=user.id,
                token_hash=hashlib.sha256(other_token.encode()).hexdigest(),
                expires_at=expires_at,
            ),
        ]
    )
    _, refresh = create_refresh_token(db, user.id)
    db.commit()

    res = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "password": "newpass123"},
    )

    assert res.status_code == 200
    db.refresh(user)
    db.refresh(refresh)
    assert verify_password("newpass123", user.password_hash)
    assert (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id)
        .count()
        == 0
    )
    assert (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user.id, RefreshToken.revoked == "N")
        .count()
        == 0
    )
