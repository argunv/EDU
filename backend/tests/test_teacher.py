import uuid
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.models.lesson import Lesson
from app.models.schedule import ScheduleSlot
from app.models.grade import Grade

WEEKDAY_LABELS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


@pytest.fixture
def schedule_slot_today(db, class_1a, subject_math, teacher_user):
    """Слот расписания на сегодня (для генерации уроков из расписания)."""
    today = date.today()
    day_label = WEEKDAY_LABELS[today.weekday()]
    slot = ScheduleSlot(
        id=uuid.uuid4(),
        class_id=class_1a.id,
        subject_id=subject_math.id,
        day_label=day_label,
        lesson_number=1,
        time="09:00",
        shift="morning",
        teacher_id=teacher_user.id,
        teacher_name="Teacher",
        room="101",
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@pytest.fixture
def schedule_slot_monday(db, class_1a, subject_math, teacher_user):
    """Слот расписания на понедельник (детерминированный тест)."""
    slot = ScheduleSlot(
        id=uuid.uuid4(),
        class_id=class_1a.id,
        subject_id=subject_math.id,
        day_label="monday",
        lesson_number=1,
        time="09:00",
        shift="morning",
        teacher_id=teacher_user.id,
        teacher_name="Teacher",
        room="101",
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@pytest.fixture
def lesson_today(db, class_1a, subject_math):
    today = date.today()
    le = Lesson(
        id=uuid.uuid4(),
        subject_id=subject_math.id,
        class_id=class_1a.id,
        date=today,
        time="09:00",
        room="101",
    )
    db.add(le)
    db.commit()
    db.refresh(le)
    return le


def test_teacher_lessons(client: TestClient, teacher_headers, schedule_slot_monday):
    """При наличии слота расписания на понедельник API возвращает список уроков для понедельника."""
    res = client.get(
        "/teacher/lessons",
        params={"week_offset": 0, "day_index": 0},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1, "ожидается хотя бы один урок из слота на понедельник"


def test_teacher_lessons_from_schedule(client: TestClient, teacher_headers, schedule_slot_today):
    """Уроки создаются из расписания, если на дату ещё нет записей Lesson."""
    today = date.today()
    res = client.get(
        "/teacher/lessons",
        params={"week_offset": 0, "day_index": today.weekday()},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(l["subject"] == "Математика" for l in data)


def test_teacher_lessons_unauthorized(client: TestClient):
    res = client.get("/api/teacher/lessons", params={"week_offset": 0, "day_index": 0})
    assert res.status_code == 401


def test_teacher_lesson_students(client: TestClient, teacher_headers, lesson_today, student_user):
    res = client.get(
        f"/teacher/lessons/{lesson_today.id}/students",
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(s["name"] == "Student" for s in data)


def test_teacher_lesson_students_404(client: TestClient, teacher_headers):
    res = client.get(
        f"/teacher/lessons/{uuid.uuid4()}/students",
        headers=teacher_headers,
    )
    assert res.status_code == 404


def test_teacher_submit_grades(client: TestClient, teacher_headers, lesson_today, student_user):
    res = client.post(
        "/teacher/lessons/grades",
        json={
            "lesson_id": str(lesson_today.id),
            "entries": [
                {"student_id": str(student_user.id), "attendance": "present", "grade": 5},
            ],
        },
        headers=teacher_headers,
    )
    assert res.status_code == 200
    assert res.json() == {"success": True}


def test_teacher_submit_grades_with_topic_and_homework(
    client: TestClient, teacher_headers, lesson_today, student_user, db
):
    from app.models.lesson import Lesson
    from app.models.homework import Homework

    res = client.post(
        "/teacher/lessons/grades",
        json={
            "lesson_id": str(lesson_today.id),
            "entries": [
                {"student_id": str(student_user.id), "attendance": "present", "grade": 4},
            ],
            "topic": "Тема урока",
            "homework_text": "ДЗ: стр. 10",
        },
        headers=teacher_headers,
    )
    assert res.status_code == 200
    db.refresh(lesson_today)
    assert lesson_today.topic == "Тема урока"
    assert lesson_today.homework_text == "ДЗ: стр. 10"
    due = lesson_today.date + timedelta(days=1)
    hw = db.query(Homework).filter(
        Homework.class_id == lesson_today.class_id,
        Homework.subject_id == lesson_today.subject_id,
        Homework.due_date == due,
    ).first()
    assert hw is not None
    assert hw.text == "ДЗ: стр. 10"


def test_teacher_journal(client: TestClient, teacher_headers, class_1a, student_user):
    res = client.get(
        "/teacher/journal",
        params={"class_id": str(class_1a.id)},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["class_id"] == str(class_1a.id)
    assert data["class_name"] == "1A"
    assert "dates" in data
    assert "students" in data
    assert "grades" in data
    assert "subjects" in data
    assert "subject_id" in data


def test_teacher_journal_no_classes(client: TestClient, db, auth_headers):
    # Use admin token - admin is not a teacher, so no TeacherClass -> empty journal would be 403 or empty
    # Actually admin will get 403 because TeacherUser requires role=teacher
    res = client.get("/api/teacher/journal", headers=auth_headers)
    assert res.status_code == 403


def test_teacher_save_grade(
    client: TestClient, teacher_headers, student_user, schedule_slot_today, class_1a, subject_math
):
    today = date.today().isoformat()
    res = client.post(
        "/teacher/journal/grade",
        json={
            "class_id": str(class_1a.id),
            "subject_id": str(subject_math.id),
            "student_id": str(student_user.id),
            "date_iso": today,
            "value": 5,
        },
        headers=teacher_headers,
    )
    assert res.status_code == 200
    assert res.json() == {"success": True}


def test_teacher_save_grade_invalid_date(
    client: TestClient, teacher_headers, student_user, subject_math, class_1a
):
    res = client.post(
        "/teacher/journal/grade",
        json={
            "class_id": str(class_1a.id),
            "subject_id": str(subject_math.id),
            "student_id": str(student_user.id),
            "date_iso": "not-a-date",
            "value": 5,
        },
        headers=teacher_headers,
    )
    assert res.status_code == 400


def test_teacher_journal_wrong_class_403(client: TestClient, teacher_headers, class_9a):
    """Учитель не ведёт класс 9A — доступ к журналу класса запрещён."""
    res = client.get(
        "/teacher/journal",
        params={"class_id": str(class_9a.id)},
        headers=teacher_headers,
    )
    assert res.status_code == 403


@pytest.fixture
def subject_physics(db):
    from app.models.subject import Subject
    sub = Subject(id=uuid.uuid4(), name="Физика")
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def test_teacher_journal_wrong_subject_403(
    client: TestClient, teacher_headers, class_1a, subject_physics
):
    """Учитель не ведёт предмет Физика в этом классе — subject_id из запроса даёт 403."""
    res = client.get(
        "/teacher/journal",
        params={"class_id": str(class_1a.id), "subject_id": str(subject_physics.id)},
        headers=teacher_headers,
    )
    assert res.status_code == 403


def test_teacher_save_grade_wrong_class_403(
    client: TestClient, teacher_headers, student_user, class_9a, subject_math, schedule_slot_today
):
    """Передача class_id класса, к которому учитель не привязан — 403."""
    today = date.today().isoformat()
    res = client.post(
        "/teacher/journal/grade",
        json={
            "class_id": str(class_9a.id),
            "subject_id": str(subject_math.id),
            "student_id": str(student_user.id),
            "date_iso": today,
            "value": 5,
        },
        headers=teacher_headers,
    )
    assert res.status_code == 403


def test_teacher_save_grade_wrong_subject_403(
    client: TestClient, teacher_headers, student_user, class_1a, subject_physics, schedule_slot_today
):
    """Передача subject_id предмета, который учитель не ведёт в этом классе — 403."""
    today = date.today().isoformat()
    res = client.post(
        "/teacher/journal/grade",
        json={
            "class_id": str(class_1a.id),
            "subject_id": str(subject_physics.id),
            "student_id": str(student_user.id),
            "date_iso": today,
            "value": 5,
        },
        headers=teacher_headers,
    )
    assert res.status_code == 403


def test_teacher_journal_returns_grades_from_bulk_query(
    client: TestClient,
    db,
    teacher_headers,
    class_1a,
    student_user,
    subject_math,
    teacher_user,
    journal_grade_date,
):
    """Журнал возвращает оценки, загруженные одним массовым запросом (не N×M)."""
    gday = journal_grade_date
    day_label = WEEKDAY_LABELS[gday.weekday()]
    slot = ScheduleSlot(
        id=uuid.uuid4(),
        class_id=class_1a.id,
        subject_id=subject_math.id,
        day_label=day_label,
        lesson_number=1,
        time="09:00",
        shift="morning",
        teacher_id=teacher_user.id,
        teacher_name="Teacher",
        room="101",
    )
    db.add(slot)
    g = Grade(
        id=uuid.uuid4(),
        student_id=student_user.id,
        subject_id=subject_math.id,
        date=gday,
        value="5",
    )
    db.add(g)
    db.commit()
    res = client.get(
        "/teacher/journal",
        params={"class_id": str(class_1a.id), "subject_id": str(subject_math.id)},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "grades" in data
    student_grades = data["grades"].get(str(student_user.id))
    assert student_grades is not None
    date_iso = gday.isoformat()
    assert date_iso in data["dates"]
    # value may be string or int in JSON
    assert student_grades.get(date_iso) in (5, "5")


def test_teacher_journal_date_range_params(client: TestClient, teacher_headers, class_1a):
    """Параметры from_date/to_date: оба или ни одного; to_date >= from_date; диапазон не более 120 дней."""
    today = date.today().isoformat()
    # Valid: both params
    res = client.get(
        "/teacher/journal",
        params={
            "class_id": str(class_1a.id),
            "from_date": "2025-01-01",
            "to_date": "2025-01-15",
        },
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "dates" in data
    # Only weekdays in range
    for d in data["dates"]:
        assert "2025-01-01" <= d <= "2025-01-15"

    # Invalid: only from_date
    res2 = client.get(
        "/teacher/journal",
        params={"class_id": str(class_1a.id), "from_date": today},
        headers=teacher_headers,
    )
    assert res2.status_code == 400

    # Invalid: to_date before from_date
    res3 = client.get(
        "/teacher/journal",
        params={
            "class_id": str(class_1a.id),
            "from_date": "2025-02-01",
            "to_date": "2025-01-01",
        },
        headers=teacher_headers,
    )
    assert res3.status_code == 400
