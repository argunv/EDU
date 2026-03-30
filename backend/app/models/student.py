"""
Модель Student (таблица students).

В текущей реализации ученики представлены через User с role='student' и class_id.
Таблица students и эта модель сохранены для совместимости схемы и миграций;
в роутерах и сервисах не используются. Не путать с User.class_id для учеников.
При необходимости удаления — выполнить миграцию и убрать relationship из Class.
"""

import uuid
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )  # if student = user
    class_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="SET NULL"),
        nullable=True,
    )
    name = Column(String(255), nullable=False)
    class_name = Column(String(50), nullable=True)  # denormalized for display
