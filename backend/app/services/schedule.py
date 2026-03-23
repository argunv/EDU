"""
Сервис расписания: разбор ключей слотов, проверка конфликтов учителей, применение изменений.
Используется роутером admin для эндпоинтов /schedule.
"""
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.class_model import Class
from app.models.role_profiles import ParentStudentLink, TeacherAssignment, UserRole
from app.models.schedule import ScheduleSlot
from app.models.subject import Subject
from app.models.user import User
from app.schemas.admin import AdminScheduleChange, AdminScheduleSlotDraft
from app.services.email_queue import publish_email_task
from app.services.relation_access import get_active_student_ids_for_class


def get_class_recipient_emails(db: Session, class_id: UUID) -> list[str]:
    """Собирает email учеников класса и привязанных к ним родителей (без дубликатов)."""
    student_ids = get_active_student_ids_for_class(db, class_id)
    students = db.query(User).filter(
        User.id.in_(student_ids),
        User.email.isnot(None),
    ).all() if student_ids else []
    emails = {s.email for s in students if s.email}
    if not students:
        return list(emails)
    student_ids = [s.id for s in students]
    parent_links = db.query(ParentStudentLink.parent_user_id).filter(
        ParentStudentLink.student_user_id.in_(student_ids),
    ).distinct().all()
    parent_ids = [row[0] for row in parent_links]
    if parent_ids:
        parents = db.query(User).filter(
            User.id.in_(parent_ids),
            User.email.isnot(None),
        ).all()
        for p in parents:
            if p.email:
                emails.add(p.email)
    return list(emails)


def parse_schedule_change_key(key: str) -> tuple[UUID, str, str, int] | None:
    """Parse key 'class_id-shift-day_label-lesson_number' (class_id is UUID with dashes)."""
    parts = key.split("-")
    if len(parts) < 8:
        return None
    try:
        class_id_str = "-".join(parts[:5])
        shift = parts[5]
        day_label = parts[6]
        lesson_number = int(parts[7])
        cid = UUID(class_id_str)
        return (cid, shift, day_label, lesson_number)
    except (ValueError, TypeError, IndexError):
        return None


def check_teacher_schedule_conflicts(body: list[AdminScheduleChange], db: Session) -> None:
    """Проверяет, что один учитель не назначен в два разных класса в одно и то же время. Raises HTTPException 400."""
    deleted_slot_keys: set[tuple[UUID, str, str, int]] = set()
    for ch in body:
        if ch.slot is not None:
            continue
        parsed = parse_schedule_change_key(ch.key) if ch.key else None
        if parsed:
            cid, shift, day_label, lesson_number = parsed
            deleted_slot_keys.add((cid, shift, (day_label or "").strip(), lesson_number))

    updated_or_created_slot_keys: set[tuple[UUID, str, str, int]] = set()
    for ch in body:
        if not ch.slot:
            continue
        try:
            cid = UUID(ch.slot.class_id)
        except (ValueError, TypeError):
            continue
        updated_or_created_slot_keys.add(
            (cid, ch.slot.shift, (ch.slot.day_label or "").strip(), ch.slot.lesson_number)
        )

    def slot_key(s: AdminScheduleSlotDraft) -> tuple:
        return (s.shift, (s.day_label or "").strip(), s.lesson_number, (s.teacher_id or "").strip())

    assignments_by_slot: dict[tuple, list[UUID]] = {}
    slot_time_by_key: dict[tuple, str] = {}

    for ch in body:
        if not ch.slot or not ch.slot.teacher_id:
            continue
        try:
            cid = UUID(ch.slot.class_id)
        except (ValueError, TypeError):
            continue
        key = slot_key(ch.slot)
        if key not in assignments_by_slot:
            assignments_by_slot[key] = []
            slot_time_by_key[key] = (ch.slot.time or "").strip() or "?"
        if cid not in assignments_by_slot[key]:
            assignments_by_slot[key].append(cid)

    for (shift, day_label, lesson_number, teacher_id), class_ids in assignments_by_slot.items():
        if len(class_ids) > 1:
            time_str = slot_time_by_key.get((shift, day_label, lesson_number, teacher_id), "?")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Преподаватель не может вести урок в нескольких классах одновременно "
                    f"в {time_str} ({day_label}). Выберите другой слот или другого преподавателя."
                ),
            )

    for ch in body:
        if not ch.slot or not ch.slot.teacher_id:
            continue
        try:
            cid = UUID(ch.slot.class_id)
        except (ValueError, TypeError):
            continue
        shift = ch.slot.shift
        day_label = (ch.slot.day_label or "").strip()
        lesson_number = ch.slot.lesson_number
        teacher_id = ch.slot.teacher_id

        other = db.query(ScheduleSlot).filter(
            ScheduleSlot.shift == shift,
            ScheduleSlot.day_label == day_label,
            ScheduleSlot.lesson_number == lesson_number,
            ScheduleSlot.teacher_id == UUID(teacher_id),
            ScheduleSlot.class_id != cid,
            ScheduleSlot.is_cancelled != True,
        ).first()
        if other:
            other_key = (other.class_id, other.shift, (other.day_label or "").strip(), other.lesson_number)
            if other_key in deleted_slot_keys:
                continue
            if other_key in updated_or_created_slot_keys:
                continue
            cls_other = db.query(Class).filter(Class.id == other.class_id).first()
            other_name = cls_other.name if cls_other else str(other.class_id)
            time_str = (getattr(other, "time", None) or ch.slot.time or "").strip() or "?"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"У данного учителя уже назначен урок в классе «{other_name}» в {time_str}. "
                    f"Назначьте другого преподавателя или другой слот."
                ),
            )


def apply_schedule_changes(body: list[AdminScheduleChange], db: Session) -> None:
    """
    Применяет список изменений расписания: удаление слотов (slot=None), обновление/создание слотов.
    Обновляет max_lessons_per_week у затронутых классов.
    При переходе слота в «отменён» отправляет в очередь письма ученикам класса и их родителям.
    Raises HTTPException при неверных id или отсутствии класса/предмета.
    """
    classes_touched: set[UUID] = set()
    # Слоты, которые только что стали отменёнными — для уведомления по email
    cancelled_to_notify: list[tuple[UUID, str, str, str, str]] = []  # (class_id, class_name, subject_name, day_label, time)

    for ch in body:
        parsed = parse_schedule_change_key(ch.key) if ch.key else None

        if ch.slot is None:
            if parsed:
                cid, shift, day_label, lesson_number = parsed
                classes_touched.add(cid)
                db.query(ScheduleSlot).filter(
                    ScheduleSlot.class_id == cid,
                    ScheduleSlot.shift == shift,
                    ScheduleSlot.day_label == day_label,
                    ScheduleSlot.lesson_number == lesson_number,
                ).delete()
            continue
        if parsed:
            cid, _shift, _day, _lesson_num = parsed
            classes_touched.add(cid)
        slot = ch.slot
        try:
            cid = UUID(slot.class_id)
            sid = UUID(slot.subject_id)
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Неверный class_id или subject_id в изменении: {e!s}",
            ) from e
        cls = db.query(Class).filter(Class.id == cid).first()
        if not cls:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Класс не найден: {slot.class_id}",
            )
        sub = db.query(Subject).filter(Subject.id == sid).first()
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Предмет не найден: {slot.subject_id}",
            )
        day_label = (slot.day_label or "").strip()
        time_str = (slot.time or "").strip() or "—"
        new_cancelled = slot.is_cancelled or False
        teacher_id = _resolve_teacher_id(db, slot.teacher_id, slot.teacher_name)
        existing = db.query(ScheduleSlot).filter(
            ScheduleSlot.class_id == cid,
            ScheduleSlot.shift == slot.shift,
            ScheduleSlot.day_label == day_label,
            ScheduleSlot.lesson_number == slot.lesson_number,
        ).first()
        if existing:
            was_cancelled = bool(getattr(existing, "is_cancelled", False))
            existing.subject_id = sid
            existing.teacher_id = teacher_id
            existing.teacher_name = slot.teacher_name
            existing.room = slot.room
            existing.note = slot.note
            existing.is_cancelled = new_cancelled
            if not was_cancelled and new_cancelled:
                cancelled_to_notify.append((cid, cls.name, sub.name, day_label, time_str))
        else:
            db.add(ScheduleSlot(
                class_id=cid,
                subject_id=sid,
                teacher_id=teacher_id,
                day_label=day_label,
                lesson_number=slot.lesson_number,
                time=slot.time,
                shift=slot.shift,
                teacher_name=slot.teacher_name,
                room=slot.room,
                note=slot.note,
                is_cancelled=new_cancelled,
            ))
            if new_cancelled:
                cancelled_to_notify.append((cid, cls.name, sub.name, day_label, time_str))
        classes_touched.add(cid)

    for cid in classes_touched:
        cls = db.query(Class).filter(Class.id == cid).first()
        if not cls:
            continue
        row = db.query(func.max(ScheduleSlot.lesson_number)).filter(
            ScheduleSlot.class_id == cid,
        ).scalar()
        new_max = row or 0
        cls.max_lessons_per_week = new_max if new_max >= 1 else None

    db.flush()
    db.commit()

    for class_id, class_name, subject_name, day_label, time_str in cancelled_to_notify:
        emails = get_class_recipient_emails(db, class_id)
        if not emails:
            continue
        publish_email_task({
            "type": "lesson_cancelled",
            "emails": emails,
            "class_name": class_name,
            "subject_name": subject_name,
            "day_label": day_label,
            "time": time_str,
        })


def _resolve_teacher_id(db: Session, teacher_id_raw: str | None, teacher_name: str | None) -> UUID:
    if teacher_id_raw:
        try:
            teacher_id = UUID(teacher_id_raw)
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный teacher_id") from exc
        exists = db.query(UserRole.id).filter(
            UserRole.user_id == teacher_id,
            UserRole.role == "teacher",
        ).first()
        if not exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="teacher_id не найден")
        return teacher_id

    if not teacher_name or not teacher_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="teacher_id обязателен")

    rows = db.query(User.id).join(UserRole, UserRole.user_id == User.id).filter(
        User.name == teacher_name.strip(),
        UserRole.role == "teacher",
    ).all()
    if len(rows) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="teacher_name неоднозначен, укажите teacher_id")
    return rows[0][0]
