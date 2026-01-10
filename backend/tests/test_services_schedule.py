"""Unit-тесты для app.services.schedule (без БД)."""
from uuid import uuid4

import pytest

from app.services.schedule import parse_schedule_change_key


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
