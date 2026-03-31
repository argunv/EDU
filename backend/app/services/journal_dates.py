"""
Общая логика журнала: дни недели по расписанию, диапазон дат, построение списка дат.
Используется в admin и teacher роутерах для единообразия правил и отсутствия дублирования.
"""

from datetime import date, timedelta
from typing import Iterable

from fastapi import HTTPException

# Пн–Пт: соответствие day_label (строка в расписании) и weekday() (0=Пн … 4=Пт)
DAY_LABEL_TO_WEEKDAY: dict[str, int] = {
    "понедельник": 0,
    "monday": 0,
    "вторник": 1,
    "tuesday": 1,
    "среда": 2,
    "wednesday": 2,
    "четверг": 3,
    "thursday": 3,
    "пятница": 4,
    "friday": 4,
}

MAX_JOURNAL_DAYS = 120


def weekdays_from_day_labels(day_labels: Iterable[str]) -> set[int]:
    """По итератору подписей дней (day_label из расписания) возвращает set weekday (0–4)."""
    weekdays: set[int] = set()
    for label in day_labels:
        if not label:
            continue
        key = (label or "").strip().lower()
        if key in DAY_LABEL_TO_WEEKDAY:
            weekdays.add(DAY_LABEL_TO_WEEKDAY[key])
    return weekdays


def weekdays_from_slots(slots: Iterable[object]) -> set[int]:
    """По итератору слотов с атрибутом day_label возвращает set weekday (0–4)."""
    labels = (getattr(s, "day_label", None) for s in slots)
    return weekdays_from_day_labels(lbl for lbl in labels if lbl is not None)


def parse_journal_date_range(
    from_date: str | None,
    to_date: str | None,
) -> tuple[date, date]:
    """
    Возвращает (start, end) для журнала.
    Если from_date/to_date не заданы — по умолчанию 90 дней назад до сегодня.
    При неверном формате или диапазоне — HTTPException 400.
    """
    today = date.today()
    if from_date is None and to_date is None:
        return (today - timedelta(days=90), today)
    if from_date is None or to_date is None:
        raise HTTPException(
            status_code=400,
            detail="Укажите оба параметра from_date и to_date или не указывайте ни один",
        )
    try:
        start = date.fromisoformat(from_date)
        end = date.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Некорректный формат даты (ожидается ISO: YYYY-MM-DD)",
        )
    if end < start:
        raise HTTPException(
            status_code=400, detail="to_date не может быть раньше from_date"
        )
    if (end - start).days >= MAX_JOURNAL_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Диапазон дат не должен превышать {MAX_JOURNAL_DAYS} дней",
        )
    return (start, end)


def build_journal_dates(
    weekdays: set[int],
    from_days_ago: int = 90,
    max_dates: int = 120,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[str]:
    """
    Список дат (ISO) Пн–Пт по расписанию в диапазоне.
    По умолчанию — от from_days_ago до сегодня, не более max_dates дат.
    """
    if not weekdays:
        return []
    today = date.today()
    start = (
        start_date
        if start_date is not None
        else (today - timedelta(days=from_days_ago))
    )
    end = end_date if end_date is not None else today
    out: list[str] = []
    d = start
    while d <= end and len(out) < max_dates:
        if d.weekday() in weekdays:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out
