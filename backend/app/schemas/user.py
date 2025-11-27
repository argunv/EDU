from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class UserBase(BaseModel):
    name: str
    email: str | None = None
    role: str


class UserResponse(UserBase):
    id: str  # UUID as string for JSON
    name: str
    role: str
    email: str | None = None
    class_name: str | None = None  # для ученика: название класса (например "1A")
    parent_names: list[str] | None = None  # для ученика: ФИО привязанных родителей

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_user(cls, user):
        return cls(
            id=str(user.id),
            name=user.name,
            role=user.role,
            email=user.email,
        )

    @classmethod
    def from_orm_user_with_db(cls, user, db):
        """Собирает UserResponse с подгрузкой class_name и parent_names из БД."""
        class_name = None
        parent_names = None
        if getattr(user, "role", None) == "student":
            if getattr(user, "class_id", None):
                from app.models.class_model import Class
                cl = db.query(Class).filter(Class.id == user.class_id).first()
                if cl:
                    class_name = cl.name
            from app.models.parent import ParentChild
            from app.models.user import User as UserModel
            links = db.query(ParentChild).filter(ParentChild.child_id == user.id).all()
            if links:
                parent_ids = [l.parent_id for l in links]
                parents = db.query(UserModel).filter(UserModel.id.in_(parent_ids)).all()
                parent_names = [p.name for p in parents]
        return cls(
            id=str(user.id),
            name=user.name,
            role=user.role,
            email=user.email,
            class_name=class_name,
            parent_names=parent_names,
        )


class AdminUserResponse(UserResponse):
    created_at: datetime
    class_id: str | None = None
    child_ids: list[str] | None = None
    class_ids: list[str] | None = None
    subject_ids: list[str] | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_user(cls, user, created_at: datetime, class_id=None, child_ids=None, class_ids=None, subject_ids=None):
        return cls(
            id=str(user.id),
            name=user.name,
            role=user.role,
            email=getattr(user, "email", None),
            created_at=created_at,
            class_id=str(class_id) if class_id else None,
            child_ids=child_ids or None,
            class_ids=class_ids or None,
            subject_ids=subject_ids or None,
        )
