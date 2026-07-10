from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.deps import DbSession, require_roles
from app.models.class_model import Class
from app.models.user import User
from app.schemas.classes import ClassResponse

router = APIRouter(tags=["classes"])

StaffUser = Annotated[User, Depends(require_roles(["admin", "teacher"]))]


@router.get("/classes", response_model=list[ClassResponse])
def list_classes(db: DbSession, current_user: StaffUser):
    del current_user  # authz only
    classes = (
        db.query(Class).filter(Class.archived.is_(False)).order_by(Class.name).all()
    )
    return [
        ClassResponse(
            id=str(c.id),
            name=c.name,
            shift=c.shift,
            shift_locked=c.shift_locked,
            max_lessons_per_week=getattr(c, "max_lessons_per_week", None),
        )
        for c in classes
    ]


@router.get("/classes/{class_id}", response_model=ClassResponse)
def get_class(class_id: UUID, db: DbSession, current_user: StaffUser):
    del current_user  # authz only
    c = db.query(Class).filter(Class.id == class_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Класс не найден")
    if c.archived:
        raise HTTPException(status_code=404, detail="Класс не найден")
    return ClassResponse(
        id=str(c.id),
        name=c.name,
        shift=c.shift,
        shift_locked=c.shift_locked,
        max_lessons_per_week=getattr(c, "max_lessons_per_week", None),
    )
