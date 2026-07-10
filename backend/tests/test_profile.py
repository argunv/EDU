"""Тесты API профиля: GET/PATCH /me/profile, POST /me/change-password, аватары."""
import io
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import settings
from app.models.user import User, RefreshToken
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.role_profiles import (
    ClassEnrollment,
    ParentStudentLink,
    TeacherAssignment,
    UserRole,
)
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    hash_password,
)


def _auth_headers(user_id) -> dict[str, str]:
    token = create_access_token(str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _png_bytes(size: int = 64) -> bytes:
    img = Image.new("RGB", (size, size), color="green")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def media_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "media_root", str(tmp_path))
    return tmp_path


def test_get_profile_student(client: TestClient, db):
    cls = Class(
        id=uuid.uuid4(),
        name="5B",
        year_start=2024,
        grade=5,
        letter="B",
        shift="morning",
        archived=False,
    )
    db.add(cls)
    db.flush()
    parent = User(
        id=uuid.uuid4(),
        email="parent@test.com",
        password_hash=hash_password("secret"),
        name="Родитель Иван",
        role="parent",
    )
    student = User(
        id=uuid.uuid4(),
        email="student@test.com",
        password_hash=hash_password("secret"),
        name="Ученик Петр",
        role="student",
        phone="+79401234567",
        birth_date=date(2012, 3, 15),
    )
    db.add_all([parent, student])
    db.flush()
    db.add(UserRole(user_id=parent.id, role="parent"))
    db.add(UserRole(user_id=student.id, role="student"))
    db.add(
        ClassEnrollment(
            student_user_id=student.id,
            class_id=cls.id,
            start_date=date(2024, 9, 1),
        )
    )
    db.add(
        ParentStudentLink(parent_user_id=parent.id, student_user_id=student.id)
    )
    db.commit()

    res = client.get("/me/profile", headers=_auth_headers(student.id))
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Ученик Петр"
    assert data["role"] == "student"
    assert data["class_name"] == "5B"
    assert data["parent_names"] == ["Родитель Иван"]
    assert data["phone"] == "+79401234567"
    assert data["birth_date"] == "2012-03-15"


def test_get_profile_parent_with_children(client: TestClient, db):
    cls = Class(
        id=uuid.uuid4(),
        name="4C",
        year_start=2024,
        grade=4,
        letter="C",
        shift="morning",
        archived=False,
    )
    parent = User(
        id=uuid.uuid4(),
        email="parent2@test.com",
        password_hash=hash_password("secret"),
        name="Родитель",
        role="parent",
    )
    child = User(
        id=uuid.uuid4(),
        email="child@test.com",
        password_hash=hash_password("secret"),
        name="Ребёнок",
        role="student",
    )
    db.add_all([cls, parent, child])
    db.flush()
    db.add(UserRole(user_id=parent.id, role="parent"))
    db.add(UserRole(user_id=child.id, role="student"))
    db.add(
        ClassEnrollment(
            student_user_id=child.id,
            class_id=cls.id,
            start_date=date(2024, 9, 1),
        )
    )
    db.add(ParentStudentLink(parent_user_id=parent.id, student_user_id=child.id))
    db.commit()

    res = client.get("/me/profile", headers=_auth_headers(parent.id))
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "parent"
    assert len(data["children"]) == 1
    assert data["children"][0]["name"] == "Ребёнок"
    assert data["children"][0]["class_name"] == "4C"


def test_get_profile_teacher_with_assignments(client: TestClient, db):
    cls = Class(
        id=uuid.uuid4(),
        name="7A",
        year_start=2024,
        grade=7,
        letter="A",
        shift="morning",
        archived=False,
    )
    subject = Subject(id=uuid.uuid4(), name="Математика")
    teacher = User(
        id=uuid.uuid4(),
        email="teacher@test.com",
        password_hash=hash_password("secret"),
        name="Учитель Анна",
        role="teacher",
    )
    db.add_all([cls, subject, teacher])
    db.flush()
    db.add(UserRole(user_id=teacher.id, role="teacher"))
    db.add(
        TeacherAssignment(
            teacher_user_id=teacher.id,
            class_id=cls.id,
            subject_id=subject.id,
        )
    )
    db.commit()

    res = client.get("/me/profile", headers=_auth_headers(teacher.id))
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "teacher"
    assert len(data["assignments"]) == 1
    assert data["assignments"][0]["class_name"] == "7A"
    assert data["assignments"][0]["subject_name"] == "Математика"


def test_get_profile_admin(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="admin@test.com",
        password_hash=hash_password("secret"),
        name="Admin",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.get("/me/profile", headers=_auth_headers(user.id))
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "admin"
    assert data.get("class_name") is None
    assert data.get("children") is None


def test_update_profile(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="Старое имя",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.patch(
        "/me/profile",
        headers=_auth_headers(user.id),
        json={"name": "Новое имя", "phone": "  +79409999999  "},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Новое имя"
    assert data["phone"] == "+79409999999"


def test_update_profile_no_fields_400(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.patch("/me/profile", headers=_auth_headers(user.id), json={})
    assert res.status_code == 400


def test_update_profile_empty_name_400(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.patch(
        "/me/profile",
        headers=_auth_headers(user.id),
        json={"name": "   "},
    )
    assert res.status_code == 400


def test_change_password(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("oldpass123"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    bad = client.post(
        "/me/change-password",
        headers=_auth_headers(user.id),
        json={"current_password": "wrong", "new_password": "newpass123"},
    )
    assert bad.status_code == 400

    ok = client.post(
        "/me/change-password",
        headers=_auth_headers(user.id),
        json={"current_password": "oldpass123", "new_password": "newpass123"},
    )
    assert ok.status_code == 200

    login = client.post(
        "/auth/login",
        json={"login": "user@test.com", "password": "newpass123"},
    )
    assert login.status_code == 200


def test_change_password_same_password_400(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("samepass123"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.post(
        "/me/change-password",
        headers=_auth_headers(user.id),
        json={"current_password": "samepass123", "new_password": "samepass123"},
    )
    assert res.status_code == 400


def test_change_password_revokes_refresh_tokens(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("oldpass123"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()
    create_refresh_token(db, user.id)
    create_refresh_token(db, user.id)

    res = client.post(
        "/me/change-password",
        headers=_auth_headers(user.id),
        json={"current_password": "oldpass123", "new_password": "newpass123"},
    )
    assert res.status_code == 200

    tokens = db.query(RefreshToken).filter(RefreshToken.user_id == user.id).all()
    assert len(tokens) == 2
    assert all(t.revoked == "Y" for t in tokens)


def test_upload_avatar(client: TestClient, db, media_tmp):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.post(
        "/me/avatar",
        headers=_auth_headers(user.id),
        files={"file": ("avatar.png", _png_bytes(128), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["avatar_url"] is not None
    assert "/api/media/avatars/" in data["avatar_url"]

    media_res = client.get(data["avatar_url"].split("?")[0])
    assert media_res.status_code == 200


def test_upload_avatar_too_small_400(client: TestClient, db, media_tmp):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.post(
        "/me/avatar",
        headers=_auth_headers(user.id),
        files={"file": ("avatar.png", _png_bytes(32), "image/png")},
    )
    assert res.status_code == 400


def test_upload_avatar_empty_file_400(client: TestClient, db, media_tmp):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    res = client.post(
        "/me/avatar",
        headers=_auth_headers(user.id),
        files={"file": ("avatar.png", b"", "image/png")},
    )
    assert res.status_code == 400


def test_delete_avatar(client: TestClient, db, media_tmp):
    user = User(
        id=uuid.uuid4(),
        email="user@test.com",
        password_hash=hash_password("secret"),
        name="User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    upload = client.post(
        "/me/avatar",
        headers=_auth_headers(user.id),
        files={"file": ("avatar.png", _png_bytes(), "image/png")},
    )
    assert upload.status_code == 200
    assert upload.json()["avatar_url"] is not None

    delete = client.delete("/me/avatar", headers=_auth_headers(user.id))
    assert delete.status_code == 200
    assert delete.json()["avatar_url"] is None


def test_login_sets_last_login_at(client: TestClient, db):
    user = User(
        id=uuid.uuid4(),
        email="login@test.com",
        password_hash=hash_password("secret123"),
        name="User",
        role="student",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="student"))
    db.commit()

    assert user.last_login_at is None

    res = client.post(
        "/auth/login",
        json={"login": "login@test.com", "password": "secret123"},
    )
    assert res.status_code == 200

    db.refresh(user)
    assert user.last_login_at is not None
