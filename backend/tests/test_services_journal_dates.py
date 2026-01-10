"""Unit-тесты для app.services.journal_dates (без БД)."""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from app.services.journal_dates import (
    DAY_LABEL_TO_WEEKDAY,
    MAX_JOURNAL_DAYS,
    build_journal_dates,
    parse_journal_date_range,
    weekdays_from_day_labels,
    weekdays_from_slots,
)


def test_constants():
    assert MAX_JOURNAL_DAYS == 120
    assert DAY_LABEL_TO_WEEKDAY["monday"] == 0
    assert DAY_LABEL_TO_WEEKDAY["пятница"] == 4


def test_weekdays_from_day_labels():
    assert weekdays_from_day_labels([]) == set()
    assert weekdays_from_day_labels(["monday", "friday"]) == {0, 4}
    assert weekdays_from_day_labels(["Понедельник", "среда"]) == {0, 2}
    assert weekdays_from_day_labels(["unknown", ""]) == set()


def test_weekdays_from_slots():
    class Slot:
        def __init__(self, day_label):
            self.day_label = day_label

    assert weekdays_from_slots([]) == set()
    assert weekdays_from_slots([Slot("monday"), Slot("thursday")]) == {0, 3}
    assert weekdays_from_slots([Slot(None), Slot("")]) == set()


def test_parse_journal_date_range_default():
    start, end = parse_journal_date_range(None, None)
    today = date.today()
    assert end == today
    assert (end - start).days == 90


def test_parse_journal_date_range_explicit():
    start, end = parse_journal_date_range("2024-01-01", "2024-01-15")
    assert start == date(2024, 1, 1)
    assert end == date(2024, 1, 15)


def test_parse_journal_date_range_one_missing():
    with pytest.raises(HTTPException) as exc_info:
        parse_journal_date_range("2024-01-01", None)
    assert exc_info.value.status_code == 400
    with pytest.raises(HTTPException):
        parse_journal_date_range(None, "2024-01-01")


def test_parse_journal_date_range_invalid_format():
    with pytest.raises(HTTPException) as exc_info:
        parse_journal_date_range("2024-01-01", "not-a-date")
    assert exc_info.value.status_code == 400


def test_parse_journal_date_range_end_before_start():
    with pytest.raises(HTTPException) as exc_info:
        parse_journal_date_range("2024-01-15", "2024-01-01")
    assert exc_info.value.status_code == 400


def test_parse_journal_date_range_too_wide():
    with pytest.raises(HTTPException) as exc_info:
        parse_journal_date_range("2024-01-01", "2024-06-01")  # > 120 days
    assert exc_info.value.status_code == 400


def test_build_journal_dates_empty_weekdays():
    assert build_journal_dates(set()) == []


def test_build_journal_dates_monday_only():
    start_d = date(2024, 1, 1)
    end_d = date(2024, 1, 31)
    dates = build_journal_dates({0}, start_date=start_d, end_date=end_d)
    # 1 Jan 2024 is Monday
    mondays = [d for d in dates if date.fromisoformat(d).weekday() == 0]
    assert len(mondays) == len(dates)
    assert len(dates) == 5  # 5 Mondays in Jan 2024


def test_build_journal_dates_respects_max_dates():
    start_d = date(2020, 1, 1)
    end_d = date(2025, 12, 31)
    dates = build_journal_dates({0, 1, 2, 3, 4}, start_date=start_d, end_date=end_d, max_dates=10)
    assert len(dates) == 10
