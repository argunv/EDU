"""Тесты API профиля: GET/PATCH /me/profile, POST /me/change-password."""
import uuid
from datetime import date

from fastapi.testclient import TestClient

from app.models.user import User
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.role_profiles import (
    ClassEnrollment,
    ParentStudentLink,
    TeacherAssignment,
    UserRole,
)
from app.services.auth import create_access_token, hash_password


def _auth_headers(user_id) -> dict[str, str]:
    token = create_access_token(str(user_id))
    return {"Authorization": f"Bearer {token}"}


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

    # После смены пароля все refresh-токены отозваны — вход с новым паролем возможен.
    login = client.post(
        "/auth/login",
        json={"login": "user@test.com", "password": "newpass123"},
    )
    assert login.status_code == 200


def test_upload_avatar(client: TestClient, db, tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "media_root", str(tmp_path))

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

    # Minimal valid PNG (1x1)
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    res = client.post(
        "/me/avatar",
        headers=_auth_headers(user.id),
        files={"file": ("avatar.png", png_bytes, "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["avatar_url"] is not None
    assert data["avatar_url"].startswith("/api/media/avatars/")
