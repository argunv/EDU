"""Тесты API админки: пользователи, настройки, расписание, журнал."""
import uuid
from datetime import date

from fastapi.testclient import TestClient

from app.models.user import User
from app.models.grade import Grade
from app.models.homework import Homework
from app.models.lesson import Lesson
from app.models.class_subject import ClassSubject
from app.models.role_profiles import TeacherAssignment, UserRole
from app.models.schedule import ScheduleSlot
from app.services.auth import hash_password


# Все тесты используют client, db, auth_headers, admin_user и др. из conftest


def test_admin_users_unauthorized(client: TestClient):
    res = client.get("/api/admin/users")
    assert res.status_code == 401


def test_admin_users_with_token(client: TestClient, auth_headers):
    res = client.get("/api/admin/users", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_admin_users_pending(client: TestClient, db, auth_headers):
    pending = User(
        id=uuid.uuid4(),
        email="pending@test.com",
        password_hash=hash_password("x"),
        name="Pending",
        role="pending",
    )
    db.add(pending)
    db.commit()
    res = client.get("/api/admin/users", params={"status": "pending"}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any(u["role"] == "pending" for u in data)


def test_admin_approve_user(client: TestClient, db, auth_headers, class_1a):
    pending = User(
        id=uuid.uuid4(),
        email="pending2@test.com",
        password_hash=hash_password("x"),
        name="Pending2",
        role="pending",
    )
    db.add(pending)
    db.commit()
    res = client.post(
        f"/admin/users/{pending.id}/approve",
        json={"role": "student", "class_id": str(class_1a.id)},
        headers=auth_headers,
    )
    assert res.status_code == 204
    db.refresh(pending)
    assert pending.role == "student"
    assert pending.class_id == class_1a.id


def test_admin_reject_user(client: TestClient, db, auth_headers):
    pending = User(
        id=uuid.uuid4(),
        email="rej2@test.com",
        password_hash=hash_password("x"),
        name="Rej2",
        role="pending",
    )
    db.add(pending)
    db.commit()
    res = client.post(
        f"/admin/users/{pending.id}/reject",
        headers=auth_headers,
    )
    assert res.status_code == 204
    db.refresh(pending)
    assert pending.role == "rejected"


def test_admin_patch_role(client: TestClient, auth_headers, teacher_user):
    res = client.patch(
        f"/admin/users/{teacher_user.id}/role",
        json={"role": "admin"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_admin_school_settings(client: TestClient, auth_headers):
    res = client.get("/api/admin/school-settings", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "is_two_shift" in data
    assert "class_shift_rules" in data


def test_admin_subjects(client: TestClient, auth_headers):
    res = client.get("/api/admin/subjects", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_admin_classes_subjects_404(client: TestClient, auth_headers):
    res = client.get(
        f"/admin/classes/{uuid.uuid4()}/subjects",
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_admin_classes_list(client: TestClient, auth_headers, class_1a, class_9a):
    res = client.get("/api/admin/classes", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    names = [c["name"] for c in data]
    assert "1A" in names
    assert "9A" in names
    for c in data:
        assert "year_start" in c
        assert "grade" in c
        assert "letter" in c
        assert "archived" in c


def test_admin_classes_create(client: TestClient, auth_headers):
    res = client.post(
        "/admin/classes",
        json={"year_start": 2024, "grade": 7, "letter": "В"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "7В"
    assert data["year_start"] == 2024
    assert data["grade"] == 7
    assert data["letter"] == "В"
    assert data["archived"] is False


def test_admin_classes_create_409(client: TestClient, auth_headers, class_1a):
    res = client.post(
        "/admin/classes",
        json={"year_start": class_1a.year_start, "grade": class_1a.grade, "letter": class_1a.letter},
        headers=auth_headers,
    )
    assert res.status_code == 409


def test_admin_classes_patch(client: TestClient, auth_headers, class_1a):
    res = client.patch(
        f"/admin/classes/{class_1a.id}",
        json={"shift": "evening", "max_lessons_per_week": 36},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["shift"] == "evening"
    assert data["max_lessons_per_week"] == 36


def test_admin_classes_archive(client: TestClient, auth_headers, class_1a):
    res = client.post(f"/admin/classes/{class_1a.id}/archive", headers=auth_headers)
    assert res.status_code == 204
    res2 = client.get("/api/admin/classes", headers=auth_headers)
    data = res2.json()
    names = [c["name"] for c in data]
    assert "1A" not in names
    res3 = client.get("/api/admin/classes", params={"include_archived": "true"}, headers=auth_headers)
    data3 = res3.json()
    names3 = [c["name"] for c in data3]
    assert "1A" in names3
    archived_1a = next(c for c in data3 if c["name"] == "1A")
    assert archived_1a["archived"] is True


def test_admin_schedule(client: TestClient, auth_headers, class_1a):
    res = client.get(
        "/admin/schedule",
        params={"week_start_iso": "2025-01-06", "class_id": str(class_1a.id), "shift": "morning"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_admin_schedule_changes_teacher_conflict(client: TestClient, db, auth_headers, class_1a, class_9a, subject_math, teacher_user):
    """При назначении одного учителя в два класса в одно время возвращается ошибка с указанием класса и времени."""
    slot_1a = ScheduleSlot(
        class_id=class_1a.id,
        subject_id=subject_math.id,
        day_label="Понедельник",
        lesson_number=1,
        time="09:00",
        shift="morning",
        teacher_id=teacher_user.id,
        teacher_name="Пётр Сидоров",
        room="101",
    )
    db.add(slot_1a)
    db.commit()
    key_9a = f"{class_9a.id}-morning-Понедельник-1"
    body = [
        {
            "key": key_9a,
            "slot": {
                "day_label": "Понедельник",
                "lesson_number": 1,
                "time": "09:00",
                "class_id": str(class_9a.id),
                "class_name": class_9a.name,
                "shift": "morning",
                "subject_id": str(subject_math.id),
                "subject_name": subject_math.name,
                "teacher_id": str(teacher_user.id),
                "teacher_name": "Пётр Сидоров",
                "room": "102",
                "note": None,
                "is_cancelled": False,
            },
        },
    ]
    res = client.post("/api/admin/schedule/changes", json=body, headers=auth_headers)
    assert res.status_code == 400
    data = res.json()
    assert "detail" in data
    detail = data["detail"]
    assert "Пётр Сидоров" in detail or "учителя" in detail
    assert "1A" in detail
    assert "09:00" in detail


def test_admin_schedule_changes_swap_teachers_no_conflict(client: TestClient, db, auth_headers, class_1a, class_9a, subject_math, teacher_user):
    """Обмен учителями между двумя классами в одном слоте в одном запросе — сохраняется без ошибки (204)."""
    second_teacher = User(
        id=uuid.uuid4(),
        email="teacher2@test.com",
        password_hash=hash_password("password"),
        name="Иван Петров",
        role="teacher",
    )
    db.add(second_teacher)
    db.commit()
    db.add(UserRole(user_id=second_teacher.id, role="teacher"))
    db.add(TeacherAssignment(teacher_user_id=second_teacher.id, class_id=class_9a.id, subject_id=subject_math.id))
    db.commit()

    slot_1a = ScheduleSlot(
        class_id=class_1a.id,
        subject_id=subject_math.id,
        day_label="Понедельник",
        lesson_number=1,
        time="09:00",
        shift="morning",
        teacher_id=teacher_user.id,
        teacher_name="Пётр Сидоров",
        room="101",
    )
    slot_9a = ScheduleSlot(
        class_id=class_9a.id,
        subject_id=subject_math.id,
        day_label="Понедельник",
        lesson_number=1,
        time="09:00",
        shift="morning",
        teacher_id=second_teacher.id,
        teacher_name="Иван Петров",
        room="102",
    )
    db.add(slot_1a)
    db.add(slot_9a)
    db.commit()
    key_1a = f"{class_1a.id}-morning-Понедельник-1"
    key_9a = f"{class_9a.id}-morning-Понедельник-1"
    body = [
        {
            "key": key_1a,
            "slot": {
                "day_label": "Понедельник",
                "lesson_number": 1,
                "time": "09:00",
                "class_id": str(class_1a.id),
                "class_name": class_1a.name,
                "shift": "morning",
                "subject_id": str(subject_math.id),
                "subject_name": subject_math.name,
                "teacher_id": str(second_teacher.id),
                "teacher_name": "Иван Петров",
                "room": "101",
                "note": None,
                "is_cancelled": False,
            },
        },
        {
            "key": key_9a,
            "slot": {
                "day_label": "Понедельник",
                "lesson_number": 1,
                "time": "09:00",
                "class_id": str(class_9a.id),
                "class_name": class_9a.name,
                "shift": "morning",
                "subject_id": str(subject_math.id),
                "subject_name": subject_math.name,
                "teacher_id": str(teacher_user.id),
                "teacher_name": "Пётр Сидоров",
                "room": "102",
                "note": None,
                "is_cancelled": False,
            },
        },
    ]
    res = client.post("/api/admin/schedule/changes", json=body, headers=auth_headers)
    assert res.status_code == 204
    db.expire_all()
    slot_1a_after = db.query(ScheduleSlot).filter(
        ScheduleSlot.class_id == class_1a.id,
        ScheduleSlot.shift == "morning",
        ScheduleSlot.day_label == "Понедельник",
        ScheduleSlot.lesson_number == 1,
    ).first()
    slot_9a_after = db.query(ScheduleSlot).filter(
        ScheduleSlot.class_id == class_9a.id,
        ScheduleSlot.shift == "morning",
        ScheduleSlot.day_label == "Понедельник",
        ScheduleSlot.lesson_number == 1,
    ).first()
    assert slot_1a_after is not None and slot_1a_after.teacher_name == "Иван Петров"
    assert slot_9a_after is not None and slot_9a_after.teacher_name == "Пётр Сидоров"


def test_admin_journal(
    client: TestClient, db, auth_headers, class_1a, student_user, subject_math, journal_grade_date
):
    gday = journal_grade_date
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
        "/admin/journal",
        params={
            "class_id": str(class_1a.id),
            "subject_id": str(subject_math.id),
            "from_date": gday.isoformat(),
            "to_date": gday.isoformat(),
        },
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "lesson_meta" in data
    assert "students" in data
    # Grades in response: one student, grades list aligned with dates
    assert len(data["students"]) >= 1
    first_student = next(s for s in data["students"] if s["id"] == str(student_user.id))
    assert first_student is not None
    assert "grades" in first_student
    assert "5" in first_student["grades"] or 5 in first_student["grades"]


def test_admin_journal_date_range_params(client: TestClient, auth_headers, class_1a, subject_math):
    """Параметры from_date/to_date: оба или ни одного; to_date >= from_date."""
    res = client.get(
        "/admin/journal",
        params={
            "class_id": str(class_1a.id),
            "subject_id": str(subject_math.id),
            "from_date": "2025-01-01",
            "to_date": "2025-01-15",
        },
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    for d in data["dates"]:
        assert "2025-01-01" <= d <= "2025-01-15"
    res2 = client.get(
        "/admin/journal",
        params={"class_id": str(class_1a.id), "from_date": "2025-01-01"},
        headers=auth_headers,
    )
    assert res2.status_code == 400


def test_admin_approve_user_404(client: TestClient, auth_headers):
    res = client.post(
        f"/admin/users/{uuid.uuid4()}/approve",
        json={"role": "student"},
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_admin_delete_subject_cascades_related_data(client: TestClient, db, auth_headers, class_1a, subject_math, teacher_user, student_user):
    # Arrange linked entities for the same subject across schedule/journal/homework.
    db.add(ClassSubject(class_id=class_1a.id, subject_id=subject_math.id, teacher_id=teacher_user.id))
    db.add(
        ScheduleSlot(
            class_id=class_1a.id,
            subject_id=subject_math.id,
            day_label="Понедельник",
            lesson_number=1,
            time="09:00",
            shift="morning",
            teacher_id=teacher_user.id,
            teacher_name=teacher_user.name,
            room="101",
        )
    )
    lesson = Lesson(
        id=uuid.uuid4(),
        class_id=class_1a.id,
        subject_id=subject_math.id,
        teacher_id=teacher_user.id,
        date=date.today(),
        time="09:00",
        room="101",
    )
    db.add(lesson)
    db.add(Grade(id=uuid.uuid4(), student_id=student_user.id, subject_id=subject_math.id, date=date.today(), value="5"))
    db.add(Homework(class_id=class_1a.id, subject_id=subject_math.id, due_date=date.today(), text="HW"))
    db.commit()

    # Act
    res = client.delete(f"/api/admin/subjects/{subject_math.id}", headers=auth_headers)
    assert res.status_code == 204

    # Assert all linked entities removed.
    assert db.query(ScheduleSlot).filter(ScheduleSlot.subject_id == subject_math.id).count() == 0
    assert db.query(TeacherAssignment).filter(TeacherAssignment.subject_id == subject_math.id).count() == 0
    assert db.query(ClassSubject).filter(ClassSubject.subject_id == subject_math.id).count() == 0
    assert db.query(Homework).filter(Homework.subject_id == subject_math.id).count() == 0
    assert db.query(Lesson).filter(Lesson.subject_id == subject_math.id).count() == 0
    assert db.query(Grade).filter(Grade.subject_id == subject_math.id).count() == 0

    # Journal by removed subject should not be accessible.
    jr = client.get(
        "/api/admin/journal",
        params={"class_id": str(class_1a.id), "subject_id": str(subject_math.id)},
        headers=auth_headers,
    )
    assert jr.status_code == 404


def test_admin_remove_class_subject_cascades_class_scoped_data(
    client: TestClient, db, auth_headers, class_1a, class_9a, subject_math, teacher_user, student_user
):
    # Arrange: subject exists in two classes, then remove only from class_1a.
    db.add(ClassSubject(class_id=class_1a.id, subject_id=subject_math.id, teacher_id=teacher_user.id))
    db.add(ClassSubject(class_id=class_9a.id, subject_id=subject_math.id, teacher_id=teacher_user.id))
    db.add(TeacherAssignment(teacher_user_id=teacher_user.id, class_id=class_9a.id, subject_id=subject_math.id))
    db.add(
        ScheduleSlot(
            class_id=class_1a.id,
            subject_id=subject_math.id,
            day_label="Понедельник",
            lesson_number=2,
            time="10:00",
            shift="morning",
            teacher_id=teacher_user.id,
            teacher_name=teacher_user.name,
            room="101",
        )
    )
    db.add(
        ScheduleSlot(
            class_id=class_9a.id,
            subject_id=subject_math.id,
            day_label="Понедельник",
            lesson_number=2,
            time="10:00",
            shift="morning",
            teacher_id=teacher_user.id,
            teacher_name=teacher_user.name,
            room="102",
        )
    )
    db.add(
        Lesson(
            id=uuid.uuid4(),
            class_id=class_1a.id,
            subject_id=subject_math.id,
            teacher_id=teacher_user.id,
            date=date.today(),
            time="10:00",
            room="101",
        )
    )
    db.add(
        Lesson(
            id=uuid.uuid4(),
            class_id=class_9a.id,
            subject_id=subject_math.id,
            teacher_id=teacher_user.id,
            date=date.today(),
            time="10:00",
            room="102",
        )
    )
    db.add(Grade(id=uuid.uuid4(), student_id=student_user.id, subject_id=subject_math.id, date=date.today(), value="4"))
    db.add(Homework(class_id=class_1a.id, subject_id=subject_math.id, due_date=date.today(), text="HW1"))
    db.add(Homework(class_id=class_9a.id, subject_id=subject_math.id, due_date=date.today(), text="HW2"))
    db.commit()

    # Act
    res = client.delete(f"/api/admin/classes/{class_1a.id}/subjects/{subject_math.id}", headers=auth_headers)
    assert res.status_code == 204

    # Assert class_1a data was removed.
    assert db.query(ClassSubject).filter(ClassSubject.class_id == class_1a.id, ClassSubject.subject_id == subject_math.id).count() == 0
    assert db.query(ScheduleSlot).filter(ScheduleSlot.class_id == class_1a.id, ScheduleSlot.subject_id == subject_math.id).count() == 0
    assert db.query(Lesson).filter(Lesson.class_id == class_1a.id, Lesson.subject_id == subject_math.id).count() == 0
    assert db.query(Homework).filter(Homework.class_id == class_1a.id, Homework.subject_id == subject_math.id).count() == 0
    assert db.query(TeacherAssignment).filter(TeacherAssignment.class_id == class_1a.id, TeacherAssignment.subject_id == subject_math.id).count() == 0
    # Student fixture belongs to class_1a; after removal class-scoped grade for this subject should be gone.
    assert db.query(Grade).filter(Grade.student_id == student_user.id, Grade.subject_id == subject_math.id).count() == 0

    # Assert other class data is untouched.
    assert db.query(ClassSubject).filter(ClassSubject.class_id == class_9a.id, ClassSubject.subject_id == subject_math.id).count() == 1
    assert db.query(ScheduleSlot).filter(ScheduleSlot.class_id == class_9a.id, ScheduleSlot.subject_id == subject_math.id).count() == 1
    assert db.query(Lesson).filter(Lesson.class_id == class_9a.id, Lesson.subject_id == subject_math.id).count() == 1
    assert db.query(Homework).filter(Homework.class_id == class_9a.id, Homework.subject_id == subject_math.id).count() == 1


def test_admin_schedule_ignores_orphan_subject_slots(client: TestClient, db, auth_headers, class_1a, subject_math, teacher_user):
    # Arrange: slot exists, but subject is no longer assigned to class (no class_subject row).
    db.add(
        ScheduleSlot(
            class_id=class_1a.id,
            subject_id=subject_math.id,
            day_label="Понедельник",
            lesson_number=3,
            time="11:00",
            shift="morning",
            teacher_id=teacher_user.id,
            teacher_name=teacher_user.name,
            room="103",
        )
    )
    db.commit()

    # Act
    res = client.get(
        "/api/admin/schedule",
        params={"week_start_iso": "2025-01-06", "class_id": str(class_1a.id), "shift": "morning"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()

    # Assert: orphan slot is not returned.
    assert all(item["subject_id"] != str(subject_math.id) for item in data)
