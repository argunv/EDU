from datetime import date, timedelta
import uuid
import pytest
from fastapi.testclient import TestClient

from app.models.homework import Homework


@pytest.fixture
def homework_item(db, class_1a, subject_math):
    due = date.today() + timedelta(days=1)
    h = Homework(
        id=uuid.uuid4(),
        subject_id=subject_math.id,
        class_id=class_1a.id,
        due_date=due,
        text="Домашнее задание по математике",
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


def test_me_children_student(client: TestClient, student_headers, class_1a):
    res = client.get("/api/me/children", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Student"
    assert data[0]["class_name"] == "1A"


def test_me_children_parent(client: TestClient, parent_headers, student_user, class_1a):
    res = client.get("/api/me/children", headers=parent_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any(c["id"] == str(student_user.id) for c in data)


def test_me_children_unauthorized(client: TestClient):
    res = client.get("/api/me/children")
    assert res.status_code == 401


def test_me_schedule_student(client: TestClient, student_headers, db, class_1a, subject_math):
    from app.models.schedule import ScheduleSlot
    slot = ScheduleSlot(
        id=uuid.uuid4(),
        class_id=class_1a.id,
        subject_id=subject_math.id,
        day_label="monday",
        lesson_number=1,
        time="09:00",
        shift="morning",
        teacher_name="Учитель",
        room="101",
    )
    db.add(slot)
    db.flush()
    res = client.get("/api/me/schedule", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_me_schedule_unauthorized(client: TestClient):
    res = client.get("/api/me/schedule")
    assert res.status_code == 401


def test_me_schedule_teacher_unsupported_role_403(client: TestClient, teacher_headers):
    """/me/schedule только для student/parent — учитель получает 403."""
    res = client.get("/api/me/schedule", headers=teacher_headers)
    assert res.status_code == 403


def test_me_schedule_admin_unsupported_role_403(client: TestClient, auth_headers):
    res = client.get("/api/me/schedule", headers=auth_headers)
    assert res.status_code == 403


def test_me_homework_student(client: TestClient, student_headers, homework_item):
    res = client.get("/api/me/homework", params={"range": "week"}, headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(h["subject"] == "Математика" for h in data)


def test_me_homework_unauthorized(client: TestClient):
    res = client.get("/api/me/homework")
    assert res.status_code == 401


def test_me_homework_parent_with_child_id(client: TestClient, parent_headers, homework_item, student_user):
    """Родитель с child_id видит домашку выбранного ребёнка (та же выборка, что у ученика)."""
    res = client.get(
        "/api/me/homework",
        params={"range": "week", "child_id": str(student_user.id)},
        headers=parent_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert any(h.get("subject") == "Математика" and "математике" in (h.get("text") or "") for h in data)


def test_me_progress_student(client: TestClient, student_headers, db, student_user, subject_math):
    from app.models.grade import Grade
    from datetime import date
    g = Grade(
        id=uuid.uuid4(),
        student_id=student_user.id,
        subject_id=subject_math.id,
        date=date(2024, 10, 15),
        value="5",
    )
    db.add(g)
    db.flush()
    res = client.get(
        "/api/me/progress",
        params={"year_start": 2024, "semester": 1},
        headers=student_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_me_progress_parent(client: TestClient, parent_headers, db, student_user, subject_math):
    from app.models.grade import Grade
    from datetime import date
    g = Grade(
        id=uuid.uuid4(),
        student_id=student_user.id,
        subject_id=subject_math.id,
        date=date(2024, 10, 15),
        value="4",
    )
    db.add(g)
    db.flush()
    res = client.get(
        "/api/me/progress",
        params={"child_id": str(student_user.id), "year_start": 2024, "semester": 1},
        headers=parent_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_me_progress_invalid_semester(client: TestClient, student_headers):
    res = client.get(
        "/api/me/progress",
        params={"year_start": 2024, "semester": 3},
        headers=student_headers,
    )
    assert res.status_code == 400


def test_me_progress_missing_year_start(client: TestClient, student_headers):
    res = client.get(
        "/api/me/progress",
        params={"semester": 1},
        headers=student_headers,
    )
    assert res.status_code == 400


def test_me_progress_year_start_out_of_range(client: TestClient, student_headers):
    res = client.get(
        "/api/me/progress",
        params={"year_start": 1999, "semester": 1},
        headers=student_headers,
    )
    assert res.status_code == 400
    res2 = client.get(
        "/api/me/progress",
        params={"year_start": 2101, "semester": 1},
        headers=student_headers,
    )
    assert res2.status_code == 400


def test_me_progress_unauthorized(client: TestClient):
    res = client.get("/api/me/progress", params={"year_start": 2024, "semester": 1})
    assert res.status_code == 401


def test_me_progress_parent_wrong_child_403(client: TestClient, parent_headers, db, class_1a):
    """parent с child_id другого ученика (не своего) получает 403."""
    from app.models.user import User
    other_student = User(
        id=uuid.uuid4(),
        email="other.student@test.com",
        password_hash="hash",
        name="Other",
        role="student",
        class_id=class_1a.id,
    )
    db.add(other_student)
    db.commit()
    res = client.get(
        "/api/me/progress",
        params={"child_id": str(other_student.id), "year_start": 2024, "semester": 1},
        headers=parent_headers,
    )
    assert res.status_code == 403


def test_me_progress_parent_nonexistent_child_404(client: TestClient, parent_headers):
    """parent с несуществующим child_id получает 404."""
    fake_uuid = uuid.uuid4()
    res = client.get(
        "/api/me/progress",
        params={"child_id": str(fake_uuid), "year_start": 2024, "semester": 1},
        headers=parent_headers,
    )
    assert res.status_code == 404


def test_me_progress_parent_no_child_id_first_child_200(client: TestClient, parent_headers, db, student_user, subject_math):
    """parent без child_id — берётся первый ребёнок, 200."""
    from app.models.grade import Grade
    from datetime import date
    g = Grade(
        id=uuid.uuid4(),
        student_id=student_user.id,
        subject_id=subject_math.id,
        date=date(2024, 10, 15),
        value="5",
    )
    db.add(g)
    db.flush()
    res = client.get(
        "/api/me/progress",
        params={"year_start": 2024, "semester": 1},
        headers=parent_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_me_progress_student_child_id_ignored_200(client: TestClient, student_headers, db, student_user, subject_math):
    """student с переданным child_id — параметр игнорируется, 200 по своим данным."""
    from app.models.grade import Grade
    from datetime import date
    g = Grade(
        id=uuid.uuid4(),
        student_id=student_user.id,
        subject_id=subject_math.id,
        date=date(2024, 10, 15),
        value="4",
    )
    db.add(g)
    db.flush()
    res = client.get(
        "/api/me/progress",
        params={"child_id": str(uuid.uuid4()), "year_start": 2024, "semester": 1},
        headers=student_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
