"""
Расписание: слоты уроков по классам.

Решение: учитель в слоте хранится как teacher_name (строка), а не teacher_id (FK на users).
Причины: упрощение миграций и отображения; привязка к пользователю делается по совпадению
имени с User.name для учителей (TeacherClass/TeacherSubject задают, кто какой предмет ведёт).
Ограничение: при смене ФИО учителя в профиле расписание не обновляется автоматически —
нужно переназначить слоты вручную или синхронизировать имя при сохранении пользователя.
Подробнее: backend/docs/decisions/001_schedule_teacher_name.md
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class ScheduleSlot(Base):
    __tablename__ = "schedule_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    day_label = Column(String(50), nullable=False)  # Понедельник, Вторник, ...
    lesson_number = Column(Integer, nullable=False)
    time = Column(String(10), nullable=False)  # 08:30
    shift = Column(String(20), nullable=False)  # morning, evening
    teacher_name = Column(String(255), nullable=False)
    room = Column(String(50), nullable=True)
    note = Column(String(255), nullable=True)
    is_cancelled = Column(Boolean, default=False)

    class_ = relationship("Class", back_populates="schedule_slots")
