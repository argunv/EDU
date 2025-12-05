import unicodedata
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Query, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_

from app.deps import get_db, AdminUser, DbSession
from app.models.user import User
from app.models.parent import ParentChild
from app.models.teacher import TeacherClass, TeacherSubject
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.class_subject import ClassSubject
from app.models.schedule import ScheduleSlot
from app.models.grade import Grade
from app.models.school_settings import SchoolSettings
from app.schemas.user import AdminUserResponse
from app.schemas.admin import (
    ApproveUserRequest,
    PatchRoleRequest,
    BusyTeacherAtSlotResponse,
    AdminScheduleSlotResponse,
    AdminScheduleSlotDraft,
    AdminScheduleChange,
    AdminSchoolSettingsResponse,
    AdminSubjectResponse,
    CreateSubjectRequest,
    ClassSubjectSetRequest,
    AdminTeacherOption,
    AdminClassResponse,
    CreateClassRequest,
    PatchClassRequest,
    AdminJournalResponse,
    AdminJournalStudent,
)
router = APIRouter(prefix="/admin", tags=["admin"])


def _get_current_school_year() -> int:
    """Учебный год: если месяц >= 9, то текущий год, иначе текущий - 1."""
    now = datetime.utcnow()
    return now.year if now.month >= 9 else now.year - 1


def _class_to_admin_response(c: Class) -> AdminClassResponse:
    return AdminClassResponse(
        id=str(c.id),
        name=c.name,
        year_start=c.year_start,
        grade=c.grade,
        letter=c.letter,
        shift=c.shift,
        shift_locked=c.shift_locked,
        max_lessons_per_week=c.max_lessons_per_week,
        archived=c.archived,
    )


def _load_admin_user_response(db, user: User) -> AdminUserResponse:
    created_at = user.created_at or datetime.utcnow()
    class_id = str(user.class_id) if user.class_id else None
    child_ids = None
    class_ids = None
    subject_ids = None
    if user.role == "parent":
        links = db.query(ParentChild).filter(ParentChild.parent_id == user.id).all()
        child_ids = [str(l.child_id) for l in links]
    if user.role == "teacher":
        tc = db.query(TeacherClass).filter(TeacherClass.teacher_id == user.id).all()
        class_ids = [str(t.class_id) for t in tc]
        ts = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user.id).all()
        subject_ids = [str(t.subject_id) for t in ts]
    return AdminUserResponse.from_orm_user(
        user, created_at=created_at, class_id=class_id,
        child_ids=child_ids, class_ids=class_ids, subject_ids=subject_ids,
    )


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    status_filter: str | None = Query(None, alias="status"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    if status_filter == "pending":
        users = db.query(User).filter(User.role == "pending").order_by(User.created_at.desc()).all()
    else:
        users = db.query(User).filter(
            User.role.in_(["admin", "teacher", "student", "parent"]),
        ).order_by(User.created_at.desc()).all()
    return [_load_admin_user_response(db, u) for u in users]


@router.post("/users/{user_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_user(
    user_id: UUID,
    body: ApproveUserRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.role != "pending":
        raise HTTPException(status_code=400, detail="Пользователь уже рассмотрен")
    user.role = body.role
    user.class_id = UUID(body.class_id) if body.class_id else None
    db.query(ParentChild).filter(ParentChild.parent_id == user_id).delete()
    db.query(TeacherClass).filter(TeacherClass.teacher_id == user_id).delete()
    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user_id).delete()
    if body.role == "parent" and body.child_ids:
        for cid in body.child_ids:
            db.add(ParentChild(parent_id=user_id, child_id=UUID(cid)))
    if body.role == "teacher":
        if body.class_ids:
            for cid in body.class_ids:
                db.add(TeacherClass(teacher_id=user_id, class_id=UUID(cid)))
        if body.subject_ids:
            for sid in body.subject_ids:
                db.add(TeacherSubject(teacher_id=user_id, subject_id=UUID(sid)))
    db.commit()
    return None


@router.post("/users/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_user(
    user_id: UUID,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.role = "rejected"
    db.commit()
    return None


@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
def patch_user_role(
    user_id: UUID,
    body: PatchRoleRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.role not in ("admin", "teacher", "student", "parent"):
        raise HTTPException(status_code=400, detail="Нельзя изменить роль")
    user.role = body.role
    user.class_id = UUID(body.class_id) if body.class_id else None
    db.query(ParentChild).filter(ParentChild.parent_id == user_id).delete()
    db.query(TeacherClass).filter(TeacherClass.teacher_id == user_id).delete()
    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == user_id).delete()
    if body.role == "parent" and body.child_ids:
        for cid in body.child_ids:
            db.add(ParentChild(parent_id=user_id, child_id=UUID(cid)))
    if body.role == "teacher":
        if body.class_ids:
            for cid in body.class_ids:
                db.add(TeacherClass(teacher_id=user_id, class_id=UUID(cid)))
        if body.subject_ids:
            for sid in body.subject_ids:
                db.add(TeacherSubject(teacher_id=user_id, subject_id=UUID(sid)))
    db.commit()
    db.refresh(user)
    return _load_admin_user_response(db, user)


# All subjects (for admin dropdown and subjects page)
@router.get("/subjects", response_model=list[AdminSubjectResponse])
def get_all_subjects(db: DbSession = None, current_user: AdminUser = None):
    subjects = db.query(Subject).order_by(Subject.name).all()
    return [AdminSubjectResponse(id=str(s.id), name=s.name, teachers=[]) for s in subjects]


@router.post("/subjects", response_model=AdminSubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    body: CreateSubjectRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    existing = db.query(Subject).filter(Subject.name == body.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Предмет с таким названием уже существует")
    sub = Subject(name=body.name.strip())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return AdminSubjectResponse(id=str(sub.id), name=sub.name, teachers=[])


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: UUID,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    sub = db.query(Subject).filter(Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    # Расписание: слоты по всем классам
    db.query(ScheduleSlot).filter(ScheduleSlot.subject_id == subject_id).delete(synchronize_session=False)
    # У всех учителей убираем возможность вести этот предмет
    db.query(TeacherSubject).filter(TeacherSubject.subject_id == subject_id).delete(synchronize_session=False)
    # Предмет из всех классов (class_subjects)
    db.query(ClassSubject).filter(ClassSubject.subject_id == subject_id).delete(synchronize_session=False)
    db.delete(sub)
    db.commit()
    return None


# Teachers list (for dropdown; optional filter by subject_id = who teaches this subject)
@router.get("/teachers", response_model=list[AdminTeacherOption])
def get_teachers(
    subject_id: UUID | None = Query(None, alias="subject_id"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    teachers = db.query(User).filter(User.role == "teacher").order_by(User.name).all()
    if not subject_id:
        return [AdminTeacherOption(id=str(u.id), name=u.name) for u in teachers]
    ts = db.query(TeacherSubject).filter(TeacherSubject.subject_id == subject_id).all()
    teacher_ids = {t.teacher_id for t in ts}
    return [
        AdminTeacherOption(id=str(u.id), name=u.name)
        for u in teachers
        if u.id in teacher_ids
    ]


# School settings
@router.get("/school-settings", response_model=AdminSchoolSettingsResponse)
def get_school_settings(db: DbSession = None, current_user: AdminUser = None):
    row = db.query(SchoolSettings).first()
    if not row:
        return AdminSchoolSettingsResponse(is_two_shift=True, class_shift_rules={})
    rules = row.class_shift_rules if isinstance(getattr(row, "class_shift_rules", None), dict) else {}
    return AdminSchoolSettingsResponse(
        is_two_shift=bool(row.is_two_shift if row.is_two_shift is not None else True),
        class_shift_rules=rules,
    )


# Admin classes CRUD
@router.get("/classes", response_model=list[AdminClassResponse])
def list_admin_classes(
    include_archived: bool = Query(False, alias="include_archived"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    q = db.query(Class).order_by(Class.year_start.desc(), Class.grade, Class.letter)
    if not include_archived:
        q = q.filter(Class.archived == False)
    classes = q.all()
    return [_class_to_admin_response(c) for c in classes]


# Латинские буквы, визуально похожие на кириллицу — приводим к кириллице,
# чтобы нельзя было создать дубликаты вроде "5A" и "5А"
_LATIN_TO_CYRILLIC_CLASS_LETTER = str.maketrans(
    "ABEKMHOPCTXYabekmhopctxy", "АВЕКМНОРСТХУавекмнорстху"
)


def _normalize_class_letter(letter: str) -> str:
    """Нормализует букву класса: пробелы, NFC и латинские двойники → кириллица."""
    s = letter.strip()
    s = unicodedata.normalize("NFC", s)
    s = s.translate(_LATIN_TO_CYRILLIC_CLASS_LETTER)
    return s


@router.post("/classes", response_model=AdminClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    body: CreateClassRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    letter_normalized = _normalize_class_letter(body.letter)
    if not letter_normalized:
        raise HTTPException(status_code=400, detail="Буква класса не может быть пустой")
    candidates = db.query(Class).filter(
        Class.year_start == body.year_start,
        Class.grade == body.grade,
    ).all()
    for c in candidates:
        if _normalize_class_letter(c.letter) == letter_normalized:
            raise HTTPException(
                status_code=409,
                detail="Класс с таким названием уже существует (учебный год, номер и буква класса)",
            )
    name = f"{body.grade}{letter_normalized}"
    cls = Class(
        year_start=body.year_start,
        grade=body.grade,
        letter=letter_normalized,
        name=name,
        shift=body.shift,
        shift_locked=body.shift_locked or False,
        max_lessons_per_week=body.max_lessons_per_week,
        archived=False,
    )
    db.add(cls)
    try:
        db.commit()
        db.refresh(cls)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Класс с таким учебным годом, номером и буквой уже существует",
        )
    return _class_to_admin_response(cls)


@router.patch("/classes/{class_id}", response_model=AdminClassResponse)
def patch_class(
    class_id: UUID,
    body: PatchClassRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if body.shift is not None:
        cls.shift = body.shift
    if body.shift_locked is not None:
        cls.shift_locked = body.shift_locked
    if body.max_lessons_per_week is not None:
        cls.max_lessons_per_week = body.max_lessons_per_week
    db.commit()
    db.refresh(cls)
    return _class_to_admin_response(cls)


@router.post("/classes/{class_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
def archive_class(
    class_id: UUID,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived:
        raise HTTPException(status_code=400, detail="Класс уже в архиве")
    cls.archived = True
    db.commit()
    return None


# Classes subjects (admin): предметы класса с назначенным преподавателем
@router.get("/classes/{class_id}/subjects", response_model=list[AdminSubjectResponse])
def get_class_subjects(
    class_id: UUID,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived:
        raise HTTPException(status_code=404, detail="Класс не найден")
    cs_list = db.query(ClassSubject).filter(ClassSubject.class_id == class_id).all()
    out = []
    for cs in cs_list:
        sub = db.query(Subject).filter(Subject.id == cs.subject_id).first()
        if not sub:
            continue
        teacher_name = None
        if cs.teacher_id:
            u = db.query(User).filter(User.id == cs.teacher_id).first()
            teacher_name = u.name if u else None
        out.append(
            AdminSubjectResponse(
                id=str(sub.id),
                name=sub.name,
                teachers=[teacher_name] if teacher_name else [],
                teacher_id=str(cs.teacher_id) if cs.teacher_id else None,
                teacher_name=teacher_name,
            )
        )
    out.sort(key=lambda x: x.name)
    return out


@router.post("/classes/{class_id}/subjects", response_model=AdminSubjectResponse, status_code=status.HTTP_201_CREATED)
def add_class_subject(
    class_id: UUID,
    body: ClassSubjectSetRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived:
        raise HTTPException(status_code=400, detail="Нельзя редактировать предметы архивированного класса")
    try:
        sid = UUID(body.subject_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Некорректный subject_id")
    sub = db.query(Subject).filter(Subject.id == sid).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    tid = None
    if body.teacher_id:
        try:
            tid = UUID(body.teacher_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Некорректный teacher_id")
        t = db.query(User).filter(User.id == tid, User.role == "teacher").first()
        if not t:
            raise HTTPException(status_code=404, detail="Учитель не найден")
        ts = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == tid, TeacherSubject.subject_id == sid).first()
        if not ts:
            raise HTTPException(status_code=400, detail="Учитель не ведёт этот предмет")
    existing = db.query(ClassSubject).filter(
        ClassSubject.class_id == class_id,
        ClassSubject.subject_id == sid,
    ).first()
    if existing:
        existing.teacher_id = tid
        db.commit()
        db.refresh(existing)
        teacher_name = None
        if existing.teacher_id:
            u = db.query(User).filter(User.id == existing.teacher_id).first()
            teacher_name = u.name if u else None
        return AdminSubjectResponse(
            id=str(sub.id),
            name=sub.name,
            teachers=[teacher_name] if teacher_name else [],
            teacher_id=str(existing.teacher_id) if existing.teacher_id else None,
            teacher_name=teacher_name,
        )
    cs = ClassSubject(class_id=class_id, subject_id=sid, teacher_id=tid)
    db.add(cs)
    db.commit()
    db.refresh(cs)
    teacher_name = None
    if cs.teacher_id:
        u = db.query(User).filter(User.id == cs.teacher_id).first()
        teacher_name = u.name if u else None
    return AdminSubjectResponse(
        id=str(sub.id),
        name=sub.name,
        teachers=[teacher_name] if teacher_name else [],
        teacher_id=str(cs.teacher_id) if cs.teacher_id else None,
        teacher_name=teacher_name,
    )


@router.delete("/classes/{class_id}/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_class_subject(
    class_id: UUID,
    subject_id: UUID,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived:
        raise HTTPException(status_code=400, detail="Нельзя редактировать предметы архивированного класса")
    cs = db.query(ClassSubject).filter(
        ClassSubject.class_id == class_id,
        ClassSubject.subject_id == subject_id,
    ).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Предмет не назначен классу")
    db.delete(cs)
    db.commit()
    return None


# Schedule
@router.get("/schedule", response_model=list[AdminScheduleSlotResponse])
def get_admin_schedule(
    week_start_iso: str = Query(...),
    class_id: UUID = Query(..., alias="class_id"),
    shift: str = Query(...),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    slots = db.query(ScheduleSlot).filter(
        ScheduleSlot.class_id == class_id,
        ScheduleSlot.shift == shift,
    ).all()
    result = []
    for s in slots:
        cls = db.query(Class).filter(Class.id == s.class_id).first()
        sub = db.query(Subject).filter(Subject.id == s.subject_id).first()
        result.append(AdminScheduleSlotResponse(
            id=str(s.id),
            day_label=s.day_label,
            lesson_number=s.lesson_number,
            time=s.time,
            class_id=str(s.class_id),
            class_name=cls.name if cls else "",
            shift=s.shift,
            subject_id=str(s.subject_id),
            subject_name=sub.name if sub else "",
            teacher_name=s.teacher_name,
            room=s.room,
            note=s.note,
            is_cancelled=s.is_cancelled,
        ))
    return result


@router.get("/schedule/busy-teachers", response_model=list[BusyTeacherAtSlotResponse])
def get_busy_teachers_at_slot(
    shift: str = Query(...),
    day_label: str = Query(...),
    lesson_number: int = Query(...),
    exclude_class_id: UUID | None = Query(None, alias="exclude_class_id"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    """Список преподавателей, уже ведущих урок в другом классе в указанный слот (имя + класс)."""
    q = (
        db.query(ScheduleSlot.teacher_name, Class.name.label("class_name"))
        .join(Class, Class.id == ScheduleSlot.class_id)
        .filter(
            ScheduleSlot.shift == shift,
            ScheduleSlot.day_label == day_label.strip(),
            ScheduleSlot.lesson_number == lesson_number,
            ScheduleSlot.is_cancelled != True,
            ScheduleSlot.teacher_name != "",
        )
    )
    if exclude_class_id is not None:
        q = q.filter(ScheduleSlot.class_id != exclude_class_id)
    rows = q.distinct().all()
    return [
        BusyTeacherAtSlotResponse(teacher_name=r.teacher_name, class_name=r.class_name or "")
        for r in rows
        if r.teacher_name
    ]


from app.services.schedule import (
    check_teacher_schedule_conflicts,
    apply_schedule_changes,
)


@router.post("/schedule/changes", status_code=status.HTTP_204_NO_CONTENT)
def save_schedule_changes(
    body: list[AdminScheduleChange],
    db: DbSession = None,
    current_user: AdminUser = None,
):
    check_teacher_schedule_conflicts(body, db)
    apply_schedule_changes(body, db)
    return None


# Admin journal (общая логика дат журнала — app.services.journal_dates)
from app.services.journal_dates import (
    build_journal_dates,
    parse_journal_date_range,
    weekdays_from_slots,
)


def _schedule_weekdays_for_class_subject(db: DbSession, class_id: UUID, subject_id: UUID | None) -> set[int]:
    """Возвращает set weekday (0=Пн … 4=Пт), в которые по расписанию есть урок по предмету в классе."""
    if not subject_id:
        return set()
    slots = db.query(ScheduleSlot).filter(
        ScheduleSlot.class_id == class_id,
        ScheduleSlot.subject_id == subject_id,
        or_(ScheduleSlot.is_cancelled.is_(False), ScheduleSlot.is_cancelled.is_(None)),
    ).all()
    return weekdays_from_slots(slots)


# Admin journal
@router.get("/journal", response_model=AdminJournalResponse)
def get_admin_journal(
    class_id: UUID = Query(..., alias="class_id"),
    subject_id: UUID | None = Query(None, alias="subject_id"),
    from_date: str | None = Query(None, alias="from_date", description="Начало периода (ISO YYYY-MM-DD)"),
    to_date: str | None = Query(None, alias="to_date", description="Конец периода (ISO YYYY-MM-DD)"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    sub = db.query(Subject).filter(Subject.id == subject_id).first() if subject_id else None
    students = db.query(User).filter(User.role == "student", User.class_id == class_id).all()

    # Диапазон дат: из query-параметров или по умолчанию 90 дней до сегодня
    start_d, end_d = parse_journal_date_range(from_date, to_date)
    # Столбцы: только дни недели (Пн–Пт), в которые по расписанию урок
    weekdays = _schedule_weekdays_for_class_subject(db, class_id, subject_id)
    if weekdays:
        dates = build_journal_dates(weekdays, start_date=start_d, end_date=end_d)
    else:
        dates = build_journal_dates({0, 1, 2, 3, 4}, start_date=start_d, end_date=end_d)

    # Оценки по датам: для каждого ученика список в порядке dates
    grade_by_student_date = {}
    student_ids = [u.id for u in students]
    if dates and students:
        q = db.query(Grade.student_id, Grade.date, Grade.value).filter(
            Grade.student_id.in_(student_ids),
            Grade.date >= date.fromisoformat(dates[0]),
            Grade.date <= date.fromisoformat(dates[-1]),
        )
        if subject_id is not None:
            q = q.filter(Grade.subject_id == subject_id)
        grades_q = q.all()
        for sid, d, value in grades_q:
            key = (str(sid), d.isoformat())
            grade_by_student_date[key] = value

    out_students = []
    for u in students:
        row = [grade_by_student_date.get((str(u.id), d)) for d in dates]
        absences = sum(1 for g in row if g == "Н")
        out_students.append(AdminJournalStudent(
            id=str(u.id),
            name=u.name,
            grades=row if row else [None],
            absences=absences,
        ))
    title = sub.name if sub else "Журнал класса"
    return AdminJournalResponse(
        lesson_meta={"title": title, "last_updated": "Сегодня"},
        dates=dates,
        students=out_students,
    )
