from uuid import UUID

from app.models.class_model import Class


class AdminClassRepository:
    def __init__(self, db):
        self.db = db

    def list(self, include_archived: bool) -> list[Class]:
        q = self.db.query(Class).order_by(Class.year_start.desc(), Class.grade, Class.letter)
        if not include_archived:
            q = q.filter(Class.archived.is_(False))
        return q.all()

    def get(self, class_id: UUID) -> Class | None:
        return self.db.query(Class).filter(Class.id == class_id).first()

    def create(self, cls: Class) -> Class:
        self.db.add(cls)
        self.db.commit()
        self.db.refresh(cls)
        return cls

    def save(self, cls: Class) -> Class:
        self.db.commit()
        self.db.refresh(cls)
        return cls
