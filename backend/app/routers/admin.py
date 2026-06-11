import unicodedata
from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError

from app.core.timeutil import now
from app.deps import AdminUser, DbSession
from app.models.user import User
from app.models.role_profiles import (
    ClassEnrollment,
    ParentStudentLink,
    TeacherAssignment,
    UserRole,
)
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.class_subject import ClassSubject
from app.models.schedule import ScheduleSlot
from app.models.grade import Grade
from app.models.homework import Homework
from app.models.lesson import Lesson
from app.models.school_settings import SchoolSettings
from app.repositories.admin_class_repository import AdminClassRepository
from app.services.relation_access import (
    ensure_no_enrollment_overlap,
    get_active_enrollment,
    get_active_student_ids_for_class,
)
from app.schemas.user import AdminUserResponse
from app.schemas.admin import (
    ApproveUserRequest,
    PatchRoleRequest,
    BusyTeacherAtSlotResponse,
    AdminScheduleSlotResponse,
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
from app.services.journal_dates import (
    build_journal_dates,
    parse_journal_date_range,
    weekdays_from_slots,
)
from app.services.schedule import (
    apply_schedule_changes,
    check_teacher_schedule_conflicts,
)
from app.services.auth import revoke_all_refresh_tokens_for_user

router = APIRouter(prefix="/admin", tags=["admin"])


def _parse_uuid_param(value: str, *, field: str) -> UUID:
    try:
        return UUID(value.strip())
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Некорректный идентификатор ({field})",
        ) from None


def _get_current_school_year() -> int:
    """Учебный год: если месяц >= 9, то текущий год, иначе текущий - 1."""
    dt = now()
    return dt.year if dt.month >= 9 else dt.year - 1


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
    created_at = user.created_at or now()
    class_id = None
    child_ids = None
    class_ids = None
    subject_ids = None
    if user.role == "parent":
        links = (
            db.query(ParentStudentLink)
            .filter(ParentStudentLink.parent_user_id == user.id)
            .all()
        )
        child_ids = [str(link.student_user_id) for link in links]
    if user.role == "teacher":
        assignments = (
            db.query(TeacherAssignment)
            .filter(TeacherAssignment.teacher_user_id == user.id)
            .all()
        )
        class_ids = sorted({str(t.class_id) for t in assignments})
        subject_ids = sorted({str(t.subject_id) for t in assignments})
    if user.role == "student":
        enrollment = get_active_enrollment(db, user.id)
        class_id = str(enrollment.class_id) if enrollment else None
    return AdminUserResponse.from_orm_user(
        user,
        created_at=created_at,
        class_id=class_id,
        child_ids=child_ids,
        class_ids=class_ids,
        subject_ids=subject_ids,
    )


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    status_filter: str | None = Query(None, alias="status"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    if status_filter == "pending":
        users = (
            db.query(User)
            .filter(User.role == "pending")
            .order_by(User.created_at.desc())
            .all()
        )
    else:
        users = (
            db.query(User)
            .filter(
                User.role.in_(["admin", "teacher", "student", "parent"]),
            )
            .order_by(User.created_at.desc())
            .all()
        )
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
    user.class_id = (
        _parse_uuid_param(body.class_id, field="class_id") if body.class_id else None
    )
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    db.add(UserRole(user_id=user_id, role=body.role))
    db.query(ParentStudentLink).filter(
        ParentStudentLink.parent_user_id == user_id
    ).delete()
    db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_user_id == user_id
    ).delete()
    db.query(ClassEnrollment).filter(
        ClassEnrollment.student_user_id == user_id
    ).delete()
    if body.role == "parent" and body.child_ids:
        for cid in body.child_ids:
            db.add(
                ParentStudentLink(
                    parent_user_id=user_id,
                    student_user_id=_parse_uuid_param(cid, field="child_id"),
                )
            )
    if body.role == "student" and body.class_id:
        class_uid = _parse_uuid_param(body.class_id, field="class_id")
        try:
            ensure_no_enrollment_overlap(db, user_id, date.today(), None)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        db.add(ClassEnrollment(student_user_id=user_id, class_id=class_uid))
    if body.role == "teacher":
        class_ids = [
            _parse_uuid_param(cid, field="class_id")
            for cid in (body.class_ids or [])
        ]
        subject_ids = [
            _parse_uuid_param(sid, field="subject_id")
            for sid in (body.subject_ids or [])
        ]
        for cid in class_ids:
            for sid in subject_ids:
                db.add(
                    TeacherAssignment(
                        teacher_user_id=user_id, class_id=cid, subject_id=sid
                    )
                )
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
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    db.add(UserRole(user_id=user_id, role="rejected"))
    revoke_all_refresh_tokens_for_user(db, user_id)
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
    user.class_id = (
        _parse_uuid_param(body.class_id, field="class_id") if body.class_id else None
    )
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    db.add(UserRole(user_id=user_id, role=body.role))
    db.query(ParentStudentLink).filter(
        ParentStudentLink.parent_user_id == user_id
    ).delete()
    db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_user_id == user_id
    ).delete()
    db.query(ClassEnrollment).filter(
        ClassEnrollment.student_user_id == user_id
    ).delete()
    if body.role == "parent" and body.child_ids:
        for cid in body.child_ids:
            db.add(
                ParentStudentLink(
                    parent_user_id=user_id,
                    student_user_id=_parse_uuid_param(cid, field="child_id"),
                )
            )
    if body.role == "student" and body.class_id:
        class_uid = _parse_uuid_param(body.class_id, field="class_id")
        try:
            ensure_no_enrollment_overlap(db, user_id, date.today(), None)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        db.add(ClassEnrollment(student_user_id=user_id, class_id=class_uid))
    if body.role == "teacher":
        class_ids = [
            _parse_uuid_param(cid, field="class_id")
            for cid in (body.class_ids or [])
        ]
        subject_ids = [
            _parse_uuid_param(sid, field="subject_id")
            for sid in (body.subject_ids or [])
        ]
        for cid in class_ids:
            for sid in subject_ids:
                db.add(
                    TeacherAssignment(
                        teacher_user_id=user_id, class_id=cid, subject_id=sid
                    )
                )
    db.commit()
    db.refresh(user)
    return _load_admin_user_response(db, user)


# All subjects (for admin dropdown and subjects page)
@router.get("/subjects", response_model=list[AdminSubjectResponse])
def get_all_subjects(db: DbSession = None, current_user: AdminUser = None):
    subjects = db.query(Subject).order_by(Subject.name).all()
    return [
        AdminSubjectResponse(id=str(s.id), name=s.name, teachers=[]) for s in subjects
    ]


@router.post(
    "/subjects",
    response_model=AdminSubjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subject(
    body: CreateSubjectRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    existing = db.query(Subject).filter(Subject.name == body.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Предмет с таким названием уже существует"
        )
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
    # Удаляем связанные данные по предмету во всех классах, чтобы не оставалось
    # "висячих" маршрутов журнала/расписания/ДЗ.
    db.query(Grade).filter(Grade.subject_id == subject_id).delete(
        synchronize_session=False
    )
    db.query(Homework).filter(Homework.subject_id == subject_id).delete(
        synchronize_session=False
    )
    db.query(Lesson).filter(Lesson.subject_id == subject_id).delete(
        synchronize_session=False
    )
    # Расписание: слоты по всем классам
    db.query(ScheduleSlot).filter(ScheduleSlot.subject_id == subject_id).delete(
        synchronize_session=False
    )
    # У всех учителей убираем возможность вести этот предмет
    db.query(TeacherAssignment).filter(
        TeacherAssignment.subject_id == subject_id
    ).delete(synchronize_session=False)
    # Предмет из всех классов (class_subjects)
    db.query(ClassSubject).filter(ClassSubject.subject_id == subject_id).delete(
        synchronize_session=False
    )
    db.delete(sub)
    db.commit()
    return None


# Teachers list (for dropdown; optional filter by subject_id = who teaches
# this subject)
@router.get("/teachers", response_model=list[AdminTeacherOption])
def get_teachers(
    subject_id: UUID | None = Query(None, alias="subject_id"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    teachers = db.query(User).filter(User.role == "teacher").order_by(User.name).all()
    if not subject_id:
        return [AdminTeacherOption(id=str(u.id), name=u.name) for u in teachers]
    assignment_teacher_ids = {
        row[0]
        for row in db.query(TeacherAssignment.teacher_user_id)
        .filter(TeacherAssignment.subject_id == subject_id)
        .distinct()
        .all()
    }
    teacher_ids = assignment_teacher_ids
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
    rules = (
        row.class_shift_rules
        if isinstance(getattr(row, "class_shift_rules", None), dict)
        else {}
    )
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
    repo = AdminClassRepository(db)
    classes = repo.list(include_archived=include_archived)
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


@router.post(
    "/classes",
    response_model=AdminClassResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_class(
    body: CreateClassRequest,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    repo = AdminClassRepository(db)
    letter_normalized = _normalize_class_letter(body.letter)
    if not letter_normalized:
        raise HTTPException(status_code=400, detail="Буква класса не может быть пустой")
    candidates = (
        db.query(Class)
        .filter(
            Class.year_start == body.year_start,
            Class.grade == body.grade,
        )
        .all()
    )
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
    try:
        cls = repo.create(cls)
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
    repo = AdminClassRepository(db)
    cls = repo.get(class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if body.shift is not None:
        cls.shift = body.shift
    if body.shift_locked is not None:
        cls.shift_locked = body.shift_locked
    if body.max_lessons_per_week is not None:
        cls.max_lessons_per_week = body.max_lessons_per_week
    return _class_to_admin_response(repo.save(cls))


@router.post("/classes/{class_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
def archive_class(
    class_id: UUID,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    repo = AdminClassRepository(db)
    cls = repo.get(class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived:
        raise HTTPException(status_code=400, detail="Класс уже в архиве")
    cls.archived = True
    repo.save(cls)
    return None


# Classes subjects (admin): предметы класса с назначенным преподавателем
@router.get("/classes/{class_id}/subjects", response_model=list[AdminSubjectResponse])
def get_class_subjects(
    class_id: UUID,
    db: DbSession = None,
    current_user: AdminUser = None,
):
    repo = AdminClassRepository(db)
    cls = repo.get(class_id)
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


@router.post(
    "/classes/{class_id}/subjects",
    response_model=AdminSubjectResponse,
    status_code=status.HTTP_201_CREATED,
)
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
        raise HTTPException(
            status_code=400,
            detail="Нельзя редактировать предметы архивированного класса",
        )
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
        assignment = (
            db.query(TeacherAssignment)
            .filter(
                TeacherAssignment.teacher_user_id == tid,
                TeacherAssignment.class_id == class_id,
                TeacherAssignment.subject_id == sid,
            )
            .first()
        )
        if not assignment:
            raise HTTPException(status_code=400, detail="Учитель не ведёт этот предмет")
    existing = (
        db.query(ClassSubject)
        .filter(
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == sid,
        )
        .first()
    )
    if existing:
        existing.teacher_id = tid
        if tid:
            teacher_user = db.query(User).filter(User.id == tid).first()
            if teacher_user:
                existing.teacher_name = teacher_user.name
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
            teacher_id=(str(existing.teacher_id) if existing.teacher_id else None),
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


@router.delete(
    "/classes/{class_id}/subjects/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
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
        raise HTTPException(
            status_code=400,
            detail="Нельзя редактировать предметы архивированного класса",
        )
    cs = (
        db.query(ClassSubject)
        .filter(
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == subject_id,
        )
        .first()
    )
    if not cs:
        raise HTTPException(status_code=404, detail="Предмет не назначен классу")

    # Удаляем все данные именно по связке класс+предмет:
    # расписание, журнал (оценки), уроки и ДЗ, чтобы предмет полностью
    # исчезал из контекста класса.
    student_ids = get_active_student_ids_for_class(db, class_id)
    if student_ids:
        db.query(Grade).filter(
            Grade.subject_id == subject_id,
            Grade.student_id.in_(student_ids),
        ).delete(synchronize_session=False)
    db.query(Homework).filter(
        Homework.class_id == class_id,
        Homework.subject_id == subject_id,
    ).delete(synchronize_session=False)
    db.query(Lesson).filter(
        Lesson.class_id == class_id,
        Lesson.subject_id == subject_id,
    ).delete(synchronize_session=False)
    db.query(ScheduleSlot).filter(
        ScheduleSlot.class_id == class_id,
        ScheduleSlot.subject_id == subject_id,
    ).delete(synchronize_session=False)
    db.query(TeacherAssignment).filter(
        TeacherAssignment.class_id == class_id,
        TeacherAssignment.subject_id == subject_id,
    ).delete(synchronize_session=False)
    db.delete(cs)
    db.commit()
    return None


# Schedule
@router.get("/schedule", response_model=list[AdminScheduleSlotResponse])
def get_admin_schedule(
    week_start_iso: str = Query(...),
    class_id: UUID = Query(..., alias="class_id"),
    shift: str = Query(...),
    include_archived: bool = Query(False, alias="include_archived"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived and not include_archived:
        raise HTTPException(status_code=404, detail="Класс не найден")
    slots = (
        db.query(ScheduleSlot)
        .join(
            Subject,
            Subject.id == ScheduleSlot.subject_id,
        )
        .join(
            ClassSubject,
            and_(
                ClassSubject.class_id == ScheduleSlot.class_id,
                ClassSubject.subject_id == ScheduleSlot.subject_id,
            ),
        )
        .filter(
            ScheduleSlot.class_id == class_id,
            ScheduleSlot.shift == shift,
        )
        .all()
    )
    result = []
    for s in slots:
        cls = db.query(Class).filter(Class.id == s.class_id).first()
        sub = db.query(Subject).filter(Subject.id == s.subject_id).first()
        teacher_name = s.teacher_name
        if s.teacher_id and not teacher_name:
            teacher_user = db.query(User).filter(User.id == s.teacher_id).first()
            teacher_name = teacher_user.name if teacher_user else ""
        result.append(
            AdminScheduleSlotResponse(
                id=str(s.id),
                day_label=s.day_label,
                lesson_number=s.lesson_number,
                time=s.time,
                class_id=str(s.class_id),
                class_name=cls.name if cls else "",
                shift=s.shift,
                subject_id=str(s.subject_id),
                subject_name=sub.name if sub else "",
                teacher_id=str(s.teacher_id) if s.teacher_id else None,
                teacher_name=teacher_name,
                room=s.room,
                note=s.note,
                is_cancelled=s.is_cancelled,
            )
        )
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
            Class.archived.is_(False),
            ScheduleSlot.shift == shift,
            ScheduleSlot.day_label == day_label.strip(),
            ScheduleSlot.lesson_number == lesson_number,
            or_(
                ScheduleSlot.is_cancelled.is_(False),
                ScheduleSlot.is_cancelled.is_(None),
            ),
            or_(
                ScheduleSlot.teacher_name != "",
                ScheduleSlot.teacher_id.isnot(None),
            ),
        )
    )
    if exclude_class_id is not None:
        q = q.filter(ScheduleSlot.class_id != exclude_class_id)
    rows = q.distinct().all()
    out: list[BusyTeacherAtSlotResponse] = []
    for r in rows:
        teacher_name = r.teacher_name
        if not teacher_name:
            continue
        out.append(
            BusyTeacherAtSlotResponse(
                teacher_name=teacher_name, class_name=r.class_name or ""
            )
        )
    return out


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


def _schedule_weekdays_for_class_subject(
    db: DbSession, class_id: UUID, subject_id: UUID | None
) -> set[int]:
    """Weekday set (0=Mon…4=Fri) when schedule has this subject in class."""
    if not subject_id:
        return set()
    slots = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.class_id == class_id,
            ScheduleSlot.subject_id == subject_id,
            or_(
                ScheduleSlot.is_cancelled.is_(False),
                ScheduleSlot.is_cancelled.is_(None),
            ),
        )
        .all()
    )
    return weekdays_from_slots(slots)


# Admin journal
@router.get("/journal", response_model=AdminJournalResponse)
def get_admin_journal(
    class_id: UUID = Query(..., alias="class_id"),
    subject_id: UUID | None = Query(None, alias="subject_id"),
    from_date: str | None = Query(
        None, alias="from_date", description="Начало периода (ISO YYYY-MM-DD)"
    ),
    to_date: str | None = Query(
        None, alias="to_date", description="Конец периода (ISO YYYY-MM-DD)"
    ),
    include_archived: bool = Query(False, alias="include_archived"),
    db: DbSession = None,
    current_user: AdminUser = None,
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if cls.archived and not include_archived:
        raise HTTPException(status_code=404, detail="Класс не найден")
    sub = (
        db.query(Subject).filter(Subject.id == subject_id).first()
        if subject_id
        else None
    )
    if subject_id is not None and sub is None:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    student_ids = get_active_student_ids_for_class(db, class_id)
    students = (
        db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []
    )

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
    if dates and students:
        q = db.query(Grade.student_id, Grade.date, Grade.value).filter(
            Grade.student_id.in_([u.id for u in students]),
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
        out_students.append(
            AdminJournalStudent(
                id=str(u.id),
                name=u.name,
                grades=row if row else [None],
                absences=absences,
            )
        )
    title = sub.name if sub else "Журнал класса"
    return AdminJournalResponse(
        lesson_meta={"title": title, "last_updated": "Сегодня"},
        dates=dates,
        students=out_students,
    )
