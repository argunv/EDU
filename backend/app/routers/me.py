import logging
from datetime import date, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, Request, UploadFile, File
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.timeutil import app_today
from app.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models.user import User
from app.models.class_model import Class
from app.models.schedule import ScheduleSlot
from app.models.subject import Subject
from app.models.homework import Homework
from app.models.grade import Grade
from app.schemas.me import (
    ChildResponse,
    ScheduleItemResponse,
    HomeworkItemResponse,
    SubjectProgressResponse,
)
from app.schemas.profile import (
    ChangePasswordRequest,
    OkResponse,
    ProfileResponse,
    ProfileUpdateRequest,
)
from app.services.auth import hash_password, verify_password, revoke_all_refresh_tokens_for_user
from app.services.rate_limit import check_rate_limit
from app.services.profile import build_profile_response
from app.services.avatar_storage import delete_avatar_file, save_avatar_from_bytes
from app.services.relation_access import (
    get_active_enrollment,
    get_parent_child_ids,
    has_user_role,
)
from app.services.avatar_storage import avatar_public_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/me", tags=["me"])


def _resolve_child_id(current_user: User, child_id: str | None, db: Session) -> UUID:
    """
    Возвращает users.id ребёнка (role=student). Для student всегда current_user.id.
    Для parent: без child_id — первый привязанный; иначе проверка связи и существования user.
    При ошибке — HTTPException 400/403/404 (логируем с correlation_id).
    """
    if has_user_role(db, current_user.id, "student"):
        return current_user.id

    if not has_user_role(db, current_user.id, "parent"):
        cid = str(uuid4())[:12]
        logger.warning(
            "me resolve_child status=403 correlation_id=%s role=%s",
            cid,
            current_user.role,
        )
        raise HTTPException(status_code=403, detail="Роль не поддерживается")

    if not child_id:
        child_ids = get_parent_child_ids(db, current_user.id)
        if not child_ids:
            cid = str(uuid4())[:12]
            logger.warning(
                "me resolve_child status=404 correlation_id=%s detail=no_children",
                cid,
            )
            raise HTTPException(status_code=404, detail="Нет привязанных детей")
        first_child_id = child_ids[0]
        u = db.query(User).filter(User.id == first_child_id).first()
        if not u or not has_user_role(db, u.id, "student"):
            cid = str(uuid4())[:12]
            logger.warning(
                "me resolve_child status=404 correlation_id=%s detail=child_user_not_found",
                cid,
            )
            raise HTTPException(status_code=404, detail="Ребёнок не найден")
        return first_child_id

    try:
        cid_uuid = UUID(child_id)
    except (ValueError, TypeError):
        cid = str(uuid4())[:12]
        logger.warning(
            "me resolve_child status=400 correlation_id=%s detail=invalid_child_id",
            cid,
        )
        raise HTTPException(status_code=400, detail="Некорректный child_id")

    allowed_ids = set(get_parent_child_ids(db, current_user.id))
    if cid_uuid not in allowed_ids:
        u = db.query(User).filter(User.id == cid_uuid).first()
        if not u:
            cid = str(uuid4())[:12]
            logger.warning(
                "me resolve_child status=404 correlation_id=%s detail=child_user_not_found",
                cid,
            )
            raise HTTPException(status_code=404, detail="Ребёнок не найден")
        cid = str(uuid4())[:12]
        logger.warning(
            "me resolve_child status=403 correlation_id=%s detail=child_not_linked",
            cid,
        )
        raise HTTPException(status_code=403, detail="Нет доступа к этому ребёнку")

    u = db.query(User).filter(User.id == cid_uuid).first()
    if not u or not has_user_role(db, u.id, "student"):
        cid = str(uuid4())[:12]
        logger.warning(
            "me resolve_child status=404 correlation_id=%s detail=child_user_not_student",
            cid,
        )
        raise HTTPException(status_code=404, detail="Ребёнок не найден")

    return cid_uuid


def _active_student_class_id_or_404(db: Session, student_user_id: UUID) -> UUID:
    u = db.query(User).filter(User.id == student_user_id).first()
    enrollment = get_active_enrollment(db, student_user_id)
    student_class_id = enrollment.class_id if enrollment else None
    if not u or not has_user_role(db, u.id, "student") or not student_class_id:
        cid_log = str(uuid4())[:12]
        logger.warning(
            "me student_context status=404 correlation_id=%s detail=user_not_student",
            cid_log,
        )
        raise HTTPException(
            status_code=404, detail="Пользователь не найден или не ученик"
        )
    return student_class_id


@router.get("/children", response_model=list[ChildResponse])
def get_my_children(db: DbSession = None, current_user: CurrentUser = None):
    if has_user_role(db, current_user.id, "student"):
        enrollment = get_active_enrollment(db, current_user.id)
        class_id = enrollment.class_id if enrollment else None
        cls = db.query(Class).filter(Class.id == class_id).first() if class_id else None
        return [
            ChildResponse(
                id=str(current_user.id),
                name=current_user.name,
                class_name=cls.name if cls else "",
                avatar_url=avatar_public_url(current_user.avatar_path),
            )
        ]
    if has_user_role(db, current_user.id, "parent"):
        child_ids = get_parent_child_ids(db, current_user.id)
        out = []
        for child_id in child_ids:
            u = db.query(User).filter(User.id == child_id).first()
            if u:
                enrollment = get_active_enrollment(db, u.id)
                class_id = enrollment.class_id if enrollment else None
                cls = (
                    db.query(Class).filter(Class.id == class_id).first()
                    if class_id
                    else None
                )
                out.append(
                    ChildResponse(
                        id=str(u.id),
                        name=u.name,
                        class_name=cls.name if cls else "",
                        avatar_url=avatar_public_url(u.avatar_path),
                    )
                )
        return out
    return []


# Дни недели для вычисления даты по day_label (Пн=0 … Пт=4)
_DAY_LABEL_TO_WEEKDAY = {
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


@router.get("/schedule", response_model=list[ScheduleItemResponse])
def get_my_schedule(
    view: str = Query("day"),
    child_id: str | None = Query(None, alias="child_id"),
    week_start_iso: str | None = Query(None, alias="week_start_iso"),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    cid = _resolve_child_id(current_user, child_id, db)
    student_class_id = _active_student_class_id_or_404(db, cid)
    cls = db.query(Class).filter(Class.id == student_class_id).first()
    if cls and cls.archived:
        raise HTTPException(
            status_code=404, detail="Класс в архиве, расписание недоступно"
        )
    shift = cls.shift if cls and cls.shift else "morning"
    slots = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.class_id == student_class_id,
            ScheduleSlot.shift == shift,
            or_(
                ScheduleSlot.is_cancelled.is_(False),
                ScheduleSlot.is_cancelled.is_(None),
            ),
        )
        .order_by(ScheduleSlot.lesson_number)
        .all()
    )

    # Для режима недели с указанной датой понедельника — подтягиваем оценки за
    # соответствующие дни
    week_start: date | None = None
    if view == "week" and week_start_iso:
        try:
            week_start = date.fromisoformat(week_start_iso)
        except ValueError:
            pass
    grades_by_key: dict[tuple[UUID, date], str] = {}
    if week_start and slots:
        week_end = week_start + timedelta(days=4)
        grades_q = (
            db.query(Grade.subject_id, Grade.date, Grade.value).filter(
                Grade.student_id == cid,
                Grade.date >= week_start,
                Grade.date <= week_end,
                Grade.subject_id.isnot(None),
            )
        ).all()
        for subj_id, d, value in grades_q:
            if value:
                grades_by_key[(subj_id, d)] = value

    result = []
    for s in slots:
        sub = db.query(Subject).filter(Subject.id == s.subject_id).first()
        slot_date: date | None = None
        if week_start is not None:
            idx = _DAY_LABEL_TO_WEEKDAY.get((s.day_label or "").strip().lower())
            if idx is not None:
                slot_date = week_start + timedelta(days=idx)
        grade_val: str | None = None
        if slot_date and s.subject_id:
            grade_val = grades_by_key.get((s.subject_id, slot_date))
        result.append(
            ScheduleItemResponse(
                id=str(s.id),
                day_label=s.day_label,
                lesson_number=s.lesson_number,
                time=s.time,
                subject=sub.name if sub else "",
                teacher_name=s.teacher_name,
                room=s.room,
                subject_id=str(s.subject_id) if s.subject_id else None,
                grade=grade_val,
            )
        )
    return result


@router.get("/homework", response_model=list[HomeworkItemResponse])
def get_my_homework(
    range_filter: str = Query("today", alias="range"),
    child_id: str | None = Query(None, alias="child_id"),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    cid = _resolve_child_id(current_user, child_id, db)
    student_class_id = _active_student_class_id_or_404(db, cid)
    cls = db.query(Class).filter(Class.id == student_class_id).first()
    if cls and cls.archived:
        raise HTTPException(
            status_code=404, detail="Класс в архиве, домашние задания недоступны"
        )
    today = app_today()
    if range_filter == "today":
        start = today
        end = today
    elif range_filter == "tomorrow":
        start = today + timedelta(days=1)
        end = start
    else:
        start = today
        end = today + timedelta(days=7)
    items = (
        db.query(Homework)
        .filter(
            Homework.class_id == student_class_id,
            Homework.due_date >= start,
            Homework.due_date <= end,
        )
        .all()
    )
    result = []
    for h in items:
        sub = db.query(Subject).filter(Subject.id == h.subject_id).first()
        result.append(
            HomeworkItemResponse(
                id=str(h.id),
                due_date_label=h.due_date.strftime("%d.%m.%Y"),
                subject=sub.name if sub else "",
                text=h.text,
            )
        )
    return result


def get_semester_range(year_start: int, semester: int) -> tuple[date, date]:
    """
    Учебный год начинается 1 сентября year_start.
    Семестр 1: 1 сентября year_start – 31 января year_start+1.
    Семестр 2: 1 февраля year_start+1 – 31 мая year_start+1.
    """
    if semester == 1:
        return (date(year_start, 9, 1), date(year_start + 1, 1, 31))
    return (date(year_start + 1, 2, 1), date(year_start + 1, 5, 31))


_YEAR_MIN = 2000
_YEAR_MAX = 2100


@router.get("/progress", response_model=list[SubjectProgressResponse])
def get_my_progress(
    child_id: str | None = Query(None, alias="child_id"),
    year_start: int | None = Query(
        None, description="Первый год учебного года (например 2024)"
    ),
    semester: int | None = Query(None, description="Семестр: 1 или 2"),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    if semester is None or semester not in (1, 2):
        cid_log = str(uuid4())[:12]
        logger.warning(
            "me progress status=400 correlation_id=%s detail=invalid_semester",
            cid_log,
        )
        raise HTTPException(status_code=400, detail="semester должен быть 1 или 2")
    semester = int(semester)
    if year_start is None:
        cid_log = str(uuid4())[:12]
        logger.warning(
            "me progress status=400 correlation_id=%s detail=year_start_required",
            cid_log,
        )
        raise HTTPException(status_code=400, detail="year_start обязателен")
    year_start = int(year_start)
    if not (_YEAR_MIN <= year_start <= _YEAR_MAX):
        cid_log = str(uuid4())[:12]
        logger.warning(
            "me progress status=400 correlation_id=%s detail=year_start_out_of_range",
            cid_log,
        )
        raise HTTPException(
            status_code=400,
            detail=f"year_start должен быть от {_YEAR_MIN} до {_YEAR_MAX}",
        )
    cid = _resolve_child_id(current_user, child_id, db)
    student_class_id = _active_student_class_id_or_404(db, cid)
    cls = db.query(Class).filter(Class.id == student_class_id).first()
    if cls and cls.archived:
        raise HTTPException(
            status_code=404, detail="Класс в архиве, успеваемость недоступна"
        )
    start_d, end_d = get_semester_range(year_start, semester)
    q = db.query(Grade).filter(Grade.student_id == cid)
    q = q.filter(Grade.date >= start_d, Grade.date <= end_d)
    grades = q.all()
    by_subject = {}
    for g in grades:
        sub_id = str(g.subject_id) if g.subject_id else "unknown"
        if sub_id not in by_subject:
            by_subject[sub_id] = {
                "grades": [],
                "grade_dates": [],
                "absences": 0,
                "subject_name": "",
                "teacher_name": "",
            }
        if g.value == "Н":
            by_subject[sub_id]["absences"] += 1
        else:
            by_subject[sub_id]["grades"].append(g.value)
            by_subject[sub_id]["grade_dates"].append(g.date.isoformat())
    result = []
    for sid, data in by_subject.items():
        s = (
            db.query(Subject).filter(Subject.id == sid).first()
            if sid != "unknown"
            else None
        )
        result.append(
            SubjectProgressResponse(
                subject=s.name if s else sid,
                teacher_name=data["teacher_name"] or "",
                grades=data["grades"],
                grade_dates=data["grade_dates"],
                absences_count=data["absences"],
            )
        )
    return result


@router.get("/profile", response_model=ProfileResponse)
def get_my_profile(db: DbSession = None, current_user: CurrentUser = None):
    return build_profile_response(db, current_user)


@router.patch("/profile", response_model=ProfileResponse)
def update_my_profile(
    body: ProfileUpdateRequest,
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    if body.name is None and body.phone is None and body.birth_date is None:
        raise HTTPException(status_code=400, detail="Нет полей для обновления")

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Имя не может быть пустым")
        current_user.name = name

    if body.phone is not None:
        phone = body.phone.strip()
        current_user.phone = phone or None

    if body.birth_date is not None:
        current_user.birth_date = body.birth_date

    db.commit()
    db.refresh(current_user)
    return build_profile_response(db, current_user)


@router.post("/change-password", response_model=OkResponse)
def change_my_password(
    body: ChangePasswordRequest,
    request: Request,
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(
        "change_password",
        f"{current_user.id}:{client_ip}",
        settings.rate_limit_change_password,
    )
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400,
            detail="Новый пароль должен отличаться от текущего",
        )
    current_user.password_hash = hash_password(body.new_password)
    revoke_all_refresh_tokens_for_user(db, current_user.id)
    db.commit()
    return OkResponse()


@router.post("/avatar", response_model=ProfileResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    if not file.content_type and not file.filename:
        raise HTTPException(status_code=400, detail="Файл не передан")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Пустой файл")
    relative_path = save_avatar_from_bytes(
        current_user.id, data, file.content_type
    )
    current_user.avatar_path = relative_path
    db.commit()
    db.refresh(current_user)
    return build_profile_response(db, current_user)


@router.delete("/avatar", response_model=ProfileResponse)
def delete_my_avatar(
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    delete_avatar_file(current_user.id)
    current_user.avatar_path = None
    db.commit()
    db.refresh(current_user)
    return build_profile_response(db, current_user)
