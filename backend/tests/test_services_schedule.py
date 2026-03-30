"""Unit-тесты для app.services.schedule (без БД)."""
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.admin import AdminScheduleChange, AdminScheduleSlotDraft
from app.services.schedule import check_teacher_schedule_conflicts, parse_schedule_change_key


def test_parse_schedule_change_key_valid():
    cid = uuid4()
    key = f"{cid}-morning-Понедельник-1"
    parsed = parse_schedule_change_key(key)
    assert parsed is not None
    got_cid, shift, day_label, lesson_number = parsed
    assert got_cid == cid
    assert shift == "morning"
    assert day_label == "Понедельник"
    assert lesson_number == 1


def test_parse_schedule_change_key_too_few_parts():
    assert parse_schedule_change_key("a-b-c") is None
    assert parse_schedule_change_key("") is None


def test_parse_schedule_change_key_invalid_uuid():
    # Not a valid UUID in first 5 segments
    assert parse_schedule_change_key("xx-yy-zz-ww-morning-Понедельник-1") is None


def test_parse_schedule_change_key_invalid_lesson_number():
    cid = uuid4()
    key = f"{cid}-morning-Понедельник-N"
    assert parse_schedule_change_key(key) is None


def _slot(**kwargs):
    base = {
        "day_label": "Понедельник",
        "lesson_number": 1,
        "time": "08:00",
        "shift": "morning",
        "class_name": "Класс",
        "subject_id": str(uuid4()),
        "subject_name": "Математика",
        "teacher_name": "Иванов",
        "teacher_id": str(uuid4()),
        "room": None,
        "note": None,
        "is_cancelled": False,
    }
    base.update(kwargs)
    return AdminScheduleSlotDraft(**base)


def test_check_teacher_schedule_conflicts_same_teacher_two_classes_same_slot():
    """Один учитель не может быть в двух классах в один слот в одном batch."""
    tid = str(uuid4())
    sid = str(uuid4())
    cid1, cid2 = uuid4(), uuid4()
    body = [
        AdminScheduleChange(
            key="k1",
            slot=_slot(class_id=str(cid1), class_name="1A", teacher_id=tid, subject_id=sid),
        ),
        AdminScheduleChange(
            key="k2",
            slot=_slot(class_id=str(cid2), class_name="1Б", teacher_id=tid, subject_id=sid),
        ),
    ]
    with pytest.raises(HTTPException) as exc:
        check_teacher_schedule_conflicts(body, MagicMock())
    assert exc.value.status_code == 400
    assert "нескольких классах" in exc.value.detail


def test_check_teacher_skips_rows_without_teacher_id():
    db = MagicMock()
    cid = uuid4()
    body = [
        AdminScheduleChange(
            key="k",
            slot=_slot(class_id=str(cid), teacher_id=None),
        ),
    ]
    check_teacher_schedule_conflicts(body, db)
    db.query.assert_not_called()
