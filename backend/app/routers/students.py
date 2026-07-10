from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_

from app.core.timeutil import app_today
from app.deps import CurrentUser, DbSession
from app.models.user import User
from app.models.class_model import Class
from app.models.role_profiles import ClassEnrollment
from app.schemas.classes import StudentOptionResponse
from app.services.relation_access import (
    get_active_enrollment,
    get_teacher_class_ids,
    get_user_roles,
    has_user_role,
)

router = APIRouter(tags=["students"])


@router.get("/students", response_model=list[StudentOptionResponse])
def list_students(
    search: str | None = Query(None),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    # Security: restrict to admin (full list) or teacher (own classes only);
    # audit requirement for PII access.
    roles = get_user_roles(db, current_user.id)
    if not roles.intersection({"admin", "teacher"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра списка учеников",
        )
    student_ids_query = db.query(ClassEnrollment.student_user_id).distinct()
    if has_user_role(db, current_user.id, "teacher"):
        class_ids = get_teacher_class_ids(db, current_user.id)
        if not class_ids:
            return []
        today = app_today()
        student_ids_query = (
            student_ids_query.join(Class, Class.id == ClassEnrollment.class_id)
            .filter(
                ClassEnrollment.class_id.in_(class_ids),
                Class.archived.is_(False),
                ClassEnrollment.start_date <= today,
                or_(
                    ClassEnrollment.end_date.is_(None),
                    ClassEnrollment.end_date >= today,
                ),
            )
        )
    else:
        today = app_today()
        student_ids_query = (
            student_ids_query.join(Class, Class.id == ClassEnrollment.class_id)
            .filter(
                Class.archived.is_(False),
                ClassEnrollment.start_date <= today,
                or_(
                    ClassEnrollment.end_date.is_(None),
                    ClassEnrollment.end_date >= today,
                ),
            )
        )
    q = db.query(User).filter(User.id.in_(student_ids_query))
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.filter(User.name.ilike(term))
    users = q.all()
    result = []
    for u in users:
        class_name = ""
        enrollment = get_active_enrollment(db, u.id)
        class_id = enrollment.class_id if enrollment else None
        if class_id:
            c = db.query(Class).filter(Class.id == class_id).first()
            class_name = c.name if c else ""
        result.append(
            StudentOptionResponse(id=str(u.id), name=u.name, class_name=class_name)
        )
    return result
