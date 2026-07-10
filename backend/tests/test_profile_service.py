"""Unit-тесты сборки ProfileResponse по ролям."""
import uuid
from datetime import date

from app.models.class_model import Class
from app.models.role_profiles import (
    ClassEnrollment,
    ParentStudentLink,
    TeacherAssignment,
    UserRole,
)
from app.models.subject import Subject
from app.models.user import User
from app.services.auth import hash_password
from app.services.profile import build_profile_response


def test_build_profile_response_parent_with_children(db):
    cls = Class(
        id=uuid.uuid4(),
        name="3A",
        year_start=2024,
        grade=3,
        letter="A",
        shift="morning",
        archived=False,
    )
    parent = User(
        id=uuid.uuid4(),
        email="parent@test.com",
        password_hash=hash_password("x"),
        name="Родитель",
        role="parent",
    )
    child = User(
        id=uuid.uuid4(),
        email="child@test.com",
        password_hash=hash_password("x"),
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

    profile = build_profile_response(db, parent)
    assert profile.role == "parent"
    assert profile.children is not None
    assert len(profile.children) == 1
    assert profile.children[0].name == "Ребёнок"
    assert profile.children[0].class_name == "3A"


def test_build_profile_response_admin(db):
    user = User(
        id=uuid.uuid4(),
        email="admin@test.com",
        password_hash=hash_password("x"),
        name="Admin",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    profile = build_profile_response(db, user)
    assert profile.role == "admin"
    assert profile.class_name is None
    assert profile.children is None
    assert profile.assignments is None


def test_build_profile_response_teacher_assignments(db):
    cls = Class(
        id=uuid.uuid4(),
        name="8B",
        year_start=2024,
        grade=8,
        letter="B",
        shift="morning",
        archived=False,
    )
    subject = Subject(id=uuid.uuid4(), name="Физика")
    teacher = User(
        id=uuid.uuid4(),
        email="teacher@test.com",
        password_hash=hash_password("x"),
        name="Учитель",
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

    profile = build_profile_response(db, teacher)
    assert profile.assignments is not None
    assert profile.assignments[0].subject_name == "Физика"
    assert profile.assignments[0].class_name == "8B"
