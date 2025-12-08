from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_db, DbSession, CurrentUser
from app.models.class_model import Class
from app.schemas.classes import ClassResponse

router = APIRouter(tags=["classes"])


@router.get("/classes", response_model=list[ClassResponse])
def list_classes(db: DbSession = None, current_user: CurrentUser = None):
    classes = (
        db.query(Class)
        .filter(Class.archived == False)
        .order_by(Class.name)
        .all()
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
def get_class(
    class_id: UUID,
    db: DbSession = None,
    current_user: CurrentUser = None,
):
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
