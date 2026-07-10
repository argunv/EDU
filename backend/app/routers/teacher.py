from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.timeutil import app_today
from app.deps import DbSession, TeacherUser
from app.models.lesson import Lesson, LessonAttendance
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.user import User
from app.models.grade import Grade
from app.models.homework import Homework
from app.models.role_profiles import TeacherAssignment
from app.models.schedule import ScheduleSlot
from app.services.relation_access import (
    get_active_student_ids_for_class,
    get_teacher_class_ids,
    get_teacher_non_archived_class_ids,
    has_user_role,
)
from app.schemas.teacher import (
    LessonResponse,
    LessonStudentResponse,
    SubmitGradesRequest,
    JournalDataResponse,
    JournalSubjectOption,
    SaveGradeRequest,
)
from app.services.journal_dates import (
    build_journal_dates,
    parse_journal_date_range,
    weekdays_from_slots,
)

router = APIRouter(prefix="/teacher", tags=["teacher"])

# Соответствие weekday() (0=пн) и day_label в расписании
_WEEKDAY_LABELS_EN = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)
_WEEKDAY_LABELS_RU = (
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
    "Воскресенье",
)


def _active_teacher_class_ids(db: Session, teacher_user_id: UUID) -> list[UUID]:
    """Назначения учителя только по неархивным классам."""
    return get_teacher_non_archived_class_ids(db, teacher_user_id)


def _schedule_weekdays_teacher(
    db,
    class_id: UUID,
    subject_id: UUID | None,
    teacher_name: str,
    teacher_id: UUID,
) -> set[int]:
    """Дни недели (0–4), в которые у учителя по расписанию урок в классе по предмету."""
    q = db.query(ScheduleSlot).filter(
        ScheduleSlot.class_id == class_id,
        or_(
            ScheduleSlot.is_cancelled.is_(False),
            ScheduleSlot.is_cancelled.is_(None),
        ),
    )
    q = q.filter(ScheduleSlot.teacher_id == teacher_id)
    if subject_id:
        q = q.filter(ScheduleSlot.subject_id == subject_id)
    slots = q.all()
    return weekdays_from_slots(slots)


def _lesson_owned_by_teacher(
    db: Session, lesson: Lesson, teacher_name: str, teacher_id: UUID
) -> bool:
    """Security: verify lesson belongs to teacher via schedule. Prevents IDOR."""
    if not lesson:
        return False
    if lesson.teacher_id == teacher_id:
        return True
    weekday = lesson.date.weekday()
    day_labels = (_WEEKDAY_LABELS_EN[weekday], _WEEKDAY_LABELS_RU[weekday])
    slot = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.class_id == lesson.class_id,
            ScheduleSlot.subject_id == lesson.subject_id,
            ScheduleSlot.day_label.in_(day_labels),
            ScheduleSlot.time == lesson.time,
            ScheduleSlot.teacher_id == teacher_id,
            or_(
                ScheduleSlot.is_cancelled.is_(False),
                ScheduleSlot.is_cancelled.is_(None),
            ),
        )
        .first()
    )
    if slot is not None:
        return True
    # Backward-compatible fallback for lessons created without matching
    # schedule slot.
    assignment = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_user_id == teacher_id,
            TeacherAssignment.class_id == lesson.class_id,
            TeacherAssignment.subject_id == lesson.subject_id,
        )
        .first()
    )
    return assignment is not None


def _week_day_index(week_offset: int, day_index: int) -> date:
    today = app_today()
    # Monday = 0
    monday = today - timedelta(days=today.weekday())
    week_monday = monday + timedelta(weeks=week_offset)
    return week_monday + timedelta(days=day_index)


def _get_or_create_teacher_lessons_from_schedule(
    db: DbSession,
    target_date: date,
    teacher_name: str,
    teacher_id: UUID,
    class_ids: list,
) -> list[tuple[Lesson, ScheduleSlot]]:
    """Вернуть уроки учителя на дату, синхронизируя их из расписания."""
    if not class_ids:
        return []
    weekday = target_date.weekday()
    day_labels = (_WEEKDAY_LABELS_EN[weekday], _WEEKDAY_LABELS_RU[weekday])
    slots = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.class_id.in_(class_ids),
            ScheduleSlot.day_label.in_(day_labels),
            or_(
                ScheduleSlot.is_cancelled.is_(False),
                ScheduleSlot.is_cancelled.is_(None),
            ),
            ScheduleSlot.teacher_id == teacher_id,
        )
        .order_by(ScheduleSlot.lesson_number.asc(), ScheduleSlot.time.asc())
        .all()
    )
    lesson_with_slots: list[tuple[Lesson, ScheduleSlot]] = []
    for slot in slots:
        lesson = (
            db.query(Lesson)
            .filter(
                Lesson.class_id == slot.class_id,
                Lesson.subject_id == slot.subject_id,
                Lesson.date == target_date,
                Lesson.time == slot.time,
            )
            .first()
        )
        if not lesson:
            lesson = Lesson(
                class_id=slot.class_id,
                subject_id=slot.subject_id,
                teacher_id=slot.teacher_id or teacher_id,
                date=target_date,
                time=slot.time,
                room=slot.room,
            )
            db.add(lesson)
            db.flush()
        lesson_with_slots.append((lesson, slot))
    db.commit()
    return lesson_with_slots


@router.get("/lessons", response_model=list[LessonResponse])
def get_teacher_lessons(
    week_offset: int = Query(0),
    day_index: int = Query(0),
    db: DbSession = None,
    current_user: TeacherUser = None,
):
    target_date = _week_day_index(week_offset, day_index)
    class_ids = _active_teacher_class_ids(db, current_user.id)
    lessons_with_slots = _get_or_create_teacher_lessons_from_schedule(
        db=db,
        target_date=target_date,
        teacher_name=current_user.name,
        teacher_id=current_user.id,
        class_ids=class_ids,
    )
    result = []
    for le, _slot in lessons_with_slots:
        cls = db.query(Class).filter(Class.id == le.class_id).first()
        sub = db.query(Subject).filter(Subject.id == le.subject_id).first()
        result.append(
            LessonResponse(
                id=str(le.id),
                subject=sub.name if sub else "",
                class_id=str(le.class_id),
                class_name=cls.name if cls else "",
                time=le.time,
                room=le.room,
                topic=getattr(le, "topic", None) or None,
                homework_text=getattr(le, "homework_text", None) or None,
            )
        )
    return result


@router.get("/lessons/{lesson_id}/students", response_model=list[LessonStudentResponse])
def get_lesson_students(
    lesson_id: UUID,
    db: DbSession = None,
    current_user: TeacherUser = None,
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    cls_row = db.query(Class).filter(Class.id == lesson.class_id).first()
    if cls_row and cls_row.archived:
        raise HTTPException(
            status_code=400,
            detail="Класс в архиве, данные урока недоступны",
        )
    # Security: prevent IDOR — only lesson owner may see students.
    if not _lesson_owned_by_teacher(db, lesson, current_user.name, current_user.id):
        raise HTTPException(status_code=403, detail="Доступ к этому уроку запрещён")
    # Students in this class
    student_ids = get_active_student_ids_for_class(db, lesson.class_id)
    students = (
        db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []
    )
    attendances = {
        a.student_id: a
        for a in db.query(LessonAttendance)
        .filter(LessonAttendance.lesson_id == lesson_id)
        .all()
    }
    result = []
    for u in students:
        att = attendances.get(u.id)
        result.append(
            LessonStudentResponse(
                student_id=str(u.id),
                name=u.name,
                attendance=att.attendance if att else "present",
                grade=(
                    int(att.grade)
                    if att and att.grade and att.grade.isdigit()
                    else None
                ),
            )
        )
    return result


@router.post("/lessons/grades")
def submit_grades(
    body: SubmitGradesRequest,
    db: DbSession = None,
    current_user: TeacherUser = None,
):
    try:
        lesson_uuid = UUID(body.lesson_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid lesson_id")
    lesson = db.query(Lesson).filter(Lesson.id == lesson_uuid).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    # Security: prevent IDOR — only lesson owner may modify grades/attendance.
    if not _lesson_owned_by_teacher(db, lesson, current_user.name, current_user.id):
        raise HTTPException(status_code=403, detail="Доступ к этому уроку запрещён")
    cls_row = db.query(Class).filter(Class.id == lesson.class_id).first()
    if cls_row and cls_row.archived:
        raise HTTPException(
            status_code=400,
            detail="Класс в архиве, изменения недоступны",
        )
    allowed_students = set(get_active_student_ids_for_class(db, lesson.class_id))
    for entry in body.entries:
        try:
            esid = UUID(entry.student_id)
        except (ValueError, TypeError):
            continue
        if esid not in allowed_students:
            raise HTTPException(
                status_code=403,
                detail="Ученик не из этого класса",
            )
    if body.topic is not None:
        lesson.topic = body.topic if body.topic.strip() else None
    if body.homework_text is not None:
        lesson.homework_text = (
            body.homework_text if body.homework_text.strip() else None
        )
        if lesson.homework_text:
            due_date = lesson.date + timedelta(days=1)
            existing = (
                db.query(Homework)
                .filter(
                    Homework.class_id == lesson.class_id,
                    Homework.subject_id == lesson.subject_id,
                    Homework.due_date == due_date,
                )
                .first()
            )
            if existing:
                existing.text = lesson.homework_text
            else:
                db.add(
                    Homework(
                        class_id=lesson.class_id,
                        subject_id=lesson.subject_id,
                        due_date=due_date,
                        text=lesson.homework_text,
                    )
                )
    for entry in body.entries:
        try:
            sid = UUID(entry.student_id)
        except (ValueError, TypeError):
            continue
        att = (
            db.query(LessonAttendance)
            .filter(
                LessonAttendance.lesson_id == lesson_uuid,
                LessonAttendance.student_id == sid,
            )
            .first()
        )
        grade_val = str(entry.grade) if entry.grade is not None else None
        if att:
            att.attendance = entry.attendance
            att.grade = grade_val
        else:
            db.add(
                LessonAttendance(
                    lesson_id=lesson.id,
                    student_id=sid,
                    attendance=entry.attendance,
                    grade=grade_val,
                )
            )
    db.commit()
    return {"success": True}


@router.get("/journal", response_model=JournalDataResponse)
def get_teacher_journal(
    class_id: UUID | None = Query(None, alias="class_id"),
    subject_id: UUID | None = Query(None, alias="subject_id"),
    from_date: str | None = Query(
        None,
        alias="from_date",
        description="Начало периода (ISO YYYY-MM-DD)",
    ),
    to_date: str | None = Query(
        None,
        alias="to_date",
        description="Конец периода (ISO YYYY-MM-DD)",
    ),
    db: DbSession = None,
    current_user: TeacherUser = None,
):
    class_ids = get_teacher_non_archived_class_ids(db, current_user.id)
    if not class_ids:
        return JournalDataResponse(
            class_id="",
            class_name="",
            subject="",
            subject_id="",
            subjects=[],
            dates=[],
            students=[],
            grades={},
        )
    cid = class_id or class_ids[0]
    if cid not in class_ids:
        raise HTTPException(status_code=403, detail="Доступ к этому классу запрещён")
    cls = db.query(Class).filter(Class.id == cid).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    # Only slots where this teacher teaches
    slots = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.class_id == cid,
            ScheduleSlot.teacher_id == current_user.id,
        )
        .all()
    )
    seen_subject_ids = set()
    subject_options = []
    for s in slots:
        if s.subject_id not in seen_subject_ids:
            seen_subject_ids.add(s.subject_id)
            subj = db.query(Subject).filter(Subject.id == s.subject_id).first()
            if subj:
                subject_options.append(
                    JournalSubjectOption(id=str(subj.id), name=subj.name)
                )
    subject_options.sort(key=lambda x: x.name)
    allowed_subject_ids = {UUID(opt.id) for opt in subject_options}
    effective_subject_id = subject_id
    if subject_id is not None and subject_id not in allowed_subject_ids:
        raise HTTPException(
            status_code=403,
            detail="Доступ к этому предмету в журнале запрещён",
        )
    if not effective_subject_id and subject_options:
        effective_subject_id = UUID(subject_options[0].id)
    sub = (
        db.query(Subject).filter(Subject.id == effective_subject_id).first()
        if effective_subject_id
        else None
    )
    if effective_subject_id and sub is None:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    subject_name = (
        sub.name if sub else (subject_options[0].name if subject_options else "Журнал")
    )
    subject_id_str = (
        str(effective_subject_id)
        if effective_subject_id
        else (subject_options[0].id if subject_options else "")
    )
    student_ids = get_active_student_ids_for_class(db, cid)
    students = (
        db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []
    )

    # Диапазон дат: из query-параметров или по умолчанию 90 дней до сегодня
    start_d, end_d = parse_journal_date_range(from_date, to_date)
    # Столбцы журнала — только дни недели (Пн–Пт), в которые по расписанию урок
    weekdays = _schedule_weekdays_teacher(
        db, cid, effective_subject_id, current_user.name, current_user.id
    )
    if weekdays:
        dates = build_journal_dates(weekdays, start_date=start_d, end_date=end_d)
    else:
        dates = build_journal_dates(
            {0, 1, 2, 3, 4}, start_date=start_d, end_date=end_d
        )  # все будни

    # One bulk query for all grades (student_id, date) in range, then build
    # grades dict in memory
    grade_by_student_date: dict[tuple[str, str], str | None] = {}
    student_ids = [u.id for u in students]
    if dates and students:
        q = db.query(Grade.student_id, Grade.date, Grade.value).filter(
            Grade.student_id.in_(student_ids),
            Grade.date >= date.fromisoformat(dates[0]),
            Grade.date <= date.fromisoformat(dates[-1]),
        )
        if effective_subject_id:
            q = q.filter(Grade.subject_id == effective_subject_id)
        for sid, d_obj, value in q.all():
            grade_by_student_date[(str(sid), d_obj.isoformat())] = value
    grades = {}
    for u in students:
        grades[str(u.id)] = {
            d_iso: grade_by_student_date.get((str(u.id), d_iso)) for d_iso in dates
        }
    return JournalDataResponse(
        class_id=str(cid),
        class_name=cls.name,
        subject=subject_name,
        subject_id=subject_id_str,
        subjects=subject_options,
        dates=dates,
        students=[{"id": str(u.id), "name": u.name} for u in students],
        grades=grades,
    )


@router.post("/journal/grade")
def save_teacher_grade(
    body: SaveGradeRequest,
    db: DbSession = None,
    current_user: TeacherUser = None,
):
    try:
        d = date.fromisoformat(body.date_iso)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date_iso")
    try:
        sid = UUID(body.student_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid student_id")
    if not body.subject_id:
        raise HTTPException(status_code=400, detail="subject_id обязателен")
    try:
        body_class_id = UUID(body.class_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid class_id")
    sub_id = UUID(body.subject_id)
    teacher_assigned_class_ids = get_teacher_class_ids(db, current_user.id)
    if body_class_id not in teacher_assigned_class_ids:
        raise HTTPException(status_code=403, detail="Доступ к этому классу запрещён")
    cls_row = db.query(Class).filter(Class.id == body_class_id).first()
    if cls_row and cls_row.archived:
        raise HTTPException(
            status_code=400,
            detail="Класс в архиве, изменения недоступны",
        )
    student = db.query(User).filter(User.id == sid).first()
    if not student or not has_user_role(db, sid, "student"):
        raise HTTPException(status_code=404, detail="Ученик не найден")
    class_student_ids = set(get_active_student_ids_for_class(db, body_class_id))
    if sid not in class_student_ids:
        raise HTTPException(status_code=403, detail="Ученик не из этого класса")
    allowed = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.class_id == body_class_id,
            ScheduleSlot.subject_id == sub_id,
            ScheduleSlot.teacher_id == current_user.id,
        )
        .first()
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Нет права выставлять оценки по этому предмету в этом классе",
        )
    q = db.query(Grade).filter(
        Grade.student_id == sid,
        Grade.date == d,
    )
    q = q.filter(Grade.subject_id == sub_id)
    g = q.first()
    val = body.value if body.value is not None else None
    if isinstance(val, int):
        val = str(val)
    if g:
        g.value = val
        if g.subject_id is None:
            g.subject_id = sub_id
    else:
        db.add(
            Grade(
                student_id=sid,
                date=d,
                value=val,
                subject_id=sub_id,
            )
        )
    db.commit()
    return {"success": True}
