from uuid import UUID

from fastapi import APIRouter, Query, Depends, HTTPException, status

from app.deps import get_db, DbSession, CurrentUser
from app.models.user import User
from app.models.class_model import Class
from app.models.teacher import TeacherClass
from app.schemas.classes import StudentOptionResponse

router = APIRouter(tags=["students"])


@router.get("/students", response_model=list[StudentOptionResponse])
def list_students(
    search: str | None = Query(None),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    # Security: restrict to admin (full list) or teacher (own classes only); audit requirement for PII access.
    if current_user.role not in ("admin", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра списка учеников",
        )
    q = db.query(User).filter(User.role == "student")
    if current_user.role == "teacher":
        class_ids = [
            t.class_id
            for t in db.query(TeacherClass).filter(TeacherClass.teacher_id == current_user.id).all()
        ]
        if not class_ids:
            return []
        q = q.filter(User.class_id.in_(class_ids))
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.filter(User.name.ilike(term))
    users = q.all()
    result = []
    for u in users:
        class_name = ""
        if u.class_id:
            c = db.query(Class).filter(Class.id == u.class_id).first()
            class_name = c.name if c else ""
        result.append(StudentOptionResponse(id=str(u.id), name=u.name, class_name=class_name))
    return result
