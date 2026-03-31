"""Схемы ответа пользователя: рекурсивное обогащение для frozen MVP (класс, родители)."""

import uuid

from app.models.role_profiles import ClassEnrollment, UserRole
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.auth import hash_password


def test_user_response_student_includes_class_and_parent_names(
    db, student_user, parent_user, class_1a
):
    ur = UserResponse.from_orm_user_with_db(student_user, db)
    assert ur.class_name == class_1a.name
    assert ur.parent_names is not None
    assert parent_user.name in ur.parent_names


def test_user_response_student_without_parents_has_null_parent_names(db, class_1a):
    lone = User(
        id=uuid.uuid4(),
        email="alone@example.com",
        password_hash=hash_password("x"),
        name="Solo Student",
        role="student",
        class_id=class_1a.id,
    )
    db.add(lone)
    db.commit()
    db.add(UserRole(user_id=lone.id, role="student"))
    db.add(ClassEnrollment(student_user_id=lone.id, class_id=class_1a.id))
    db.commit()

    ur = UserResponse.from_orm_user_with_db(lone, db)
    assert ur.class_name == class_1a.name
    assert ur.parent_names is None
