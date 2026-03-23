from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.role_profiles import ClassEnrollment, ParentStudentLink, TeacherAssignment, UserRole


def get_active_student_ids_for_class(db: Session, class_id: UUID) -> list[UUID]:
    today = date.today()
    enrollment_ids = [
        row[0]
        for row in db.query(ClassEnrollment.student_user_id).filter(
            ClassEnrollment.class_id == class_id,
            ClassEnrollment.start_date <= today,
            (ClassEnrollment.end_date.is_(None) | (ClassEnrollment.end_date >= today)),
        ).all()
    ]
    return enrollment_ids


def get_parent_child_ids(db: Session, parent_user_id: UUID) -> list[UUID]:
    ids = [row[0] for row in db.query(ParentStudentLink.student_user_id).filter(
        ParentStudentLink.parent_user_id == parent_user_id
    ).all()]
    return ids


def get_teacher_class_ids(db: Session, teacher_user_id: UUID) -> list[UUID]:
    ids = [row[0] for row in db.query(TeacherAssignment.class_id).filter(
        TeacherAssignment.teacher_user_id == teacher_user_id
    ).distinct().all()]
    return ids


def get_user_roles(db: Session, user_id: UUID) -> set[str]:
    return {
        row[0]
        for row in db.query(UserRole.role).filter(UserRole.user_id == user_id).all()
    }


def has_user_role(db: Session, user_id: UUID, role: str) -> bool:
    return db.query(UserRole.id).filter(
        UserRole.user_id == user_id,
        UserRole.role == role,
    ).first() is not None


def get_active_enrollment(db: Session, student_user_id: UUID, on_date: date | None = None) -> ClassEnrollment | None:
    dt = on_date or date.today()
    return db.query(ClassEnrollment).filter(
        ClassEnrollment.student_user_id == student_user_id,
        ClassEnrollment.start_date <= dt,
        (ClassEnrollment.end_date.is_(None) | (ClassEnrollment.end_date >= dt)),
    ).order_by(ClassEnrollment.start_date.desc()).first()


def ensure_no_enrollment_overlap(
    db: Session,
    student_user_id: UUID,
    start_date: date,
    end_date: date | None,
    exclude_id: UUID | None = None,
) -> None:
    q = db.query(ClassEnrollment).filter(ClassEnrollment.student_user_id == student_user_id)
    if exclude_id is not None:
        q = q.filter(ClassEnrollment.id != exclude_id)
    # Overlap condition for [start,end] with open-ended periods.
    q = q.filter(
        ClassEnrollment.start_date <= (end_date or date.max),
        ((ClassEnrollment.end_date.is_(None)) | (ClassEnrollment.end_date >= start_date)),
    )
    if q.first() is not None:
        raise ValueError("Enrollment period overlaps with an existing enrollment")
