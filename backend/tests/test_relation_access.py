"""Доступ по связям ученик/класс/родитель: инварианты и запрет пересечений периодов."""

import uuid
from datetime import date, timedelta

import pytest

from app.models.role_profiles import ClassEnrollment, UserRole
from app.models.user import User
from app.services.auth import hash_password
from app.services.relation_access import (
    ensure_no_enrollment_overlap,
    get_active_enrollment,
    get_active_student_ids_for_class,
    get_parent_child_ids,
    get_teacher_class_ids,
    has_user_role,
)


def test_get_active_student_ids_for_class_filters_by_date(db, class_1a, student_user):
    """Учитывается окно start_date / end_date относительно сегодня."""
    other = User(
        id=uuid.uuid4(),
        email="future@test.com",
        password_hash=hash_password("x"),
        name="Future",
        role="student",
        class_id=class_1a.id,
    )
    db.add(other)
    db.commit()
    db.add(UserRole(user_id=other.id, role="student"))
    db.add(
        ClassEnrollment(
            student_user_id=other.id,
            class_id=class_1a.id,
            start_date=date.today() + timedelta(days=10),
            end_date=None,
        )
    )
    db.commit()

    ids = get_active_student_ids_for_class(db, class_1a.id)
    assert student_user.id in ids
    assert other.id not in ids


def test_get_parent_child_ids_returns_linked_students(db, parent_user, student_user):
    ids = get_parent_child_ids(db, parent_user.id)
    assert student_user.id in ids


def test_get_teacher_class_ids_distinct(db, teacher_user, class_1a):
    ids = get_teacher_class_ids(db, teacher_user.id)
    assert class_1a.id in ids
    assert len(ids) == len(set(ids))


def test_has_user_role(db, admin_user):
    assert has_user_role(db, admin_user.id, "admin") is True
    assert has_user_role(db, admin_user.id, "student") is False


def test_get_active_enrollment_respects_end_date(db, class_1a, student_user):
    db.query(ClassEnrollment).filter(
        ClassEnrollment.student_user_id == student_user.id
    ).delete()
    db.commit()
    past_end = date.today() - timedelta(days=30)
    db.add(
        ClassEnrollment(
            student_user_id=student_user.id,
            class_id=class_1a.id,
            start_date=past_end - timedelta(days=200),
            end_date=past_end,
        )
    )
    db.commit()
    assert get_active_enrollment(db, student_user.id) is None


def test_ensure_no_enrollment_overlap_raises(db, class_1a, class_9a, student_user):
    """Нельзя завести второй активный период, пересекающийся с существующим."""
    db.query(ClassEnrollment).filter(
        ClassEnrollment.student_user_id == student_user.id
    ).delete()
    db.commit()
    db.add(
        ClassEnrollment(
            student_user_id=student_user.id,
            class_id=class_1a.id,
            start_date=date(2024, 9, 1),
            end_date=None,
        )
    )
    db.commit()

    with pytest.raises(ValueError, match="overlap"):
        ensure_no_enrollment_overlap(
            db,
            student_user.id,
            start_date=date(2025, 1, 1),
            end_date=None,
            exclude_id=None,
        )


def test_ensure_no_enrollment_overlap_allows_same_row_exclude(db, class_1a, student_user):
    db.query(ClassEnrollment).filter(
        ClassEnrollment.student_user_id == student_user.id
    ).delete()
    db.commit()
    row = ClassEnrollment(
        student_user_id=student_user.id,
        class_id=class_1a.id,
        start_date=date(2024, 9, 1),
        end_date=None,
    )
    db.add(row)
    db.commit()
    rid = row.id

    ensure_no_enrollment_overlap(
        db,
        student_user.id,
        start_date=date(2024, 9, 1),
        end_date=date(2025, 6, 30),
        exclude_id=rid,
    )
