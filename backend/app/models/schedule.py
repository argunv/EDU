"""
Расписание: слоты уроков по классам.

Source-of-truth для назначения учителя: teacher_id (FK на users).
teacher_name сохраняется как человекочитаемый snapshot для UI и уведомлений.
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
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    day_label = Column(String(50), nullable=False)  # Понедельник, Вторник, ...
    lesson_number = Column(Integer, nullable=False)
    time = Column(String(10), nullable=False)  # 08:30
    shift = Column(String(20), nullable=False)  # morning, evening
    teacher_name = Column(String(255), nullable=False)
    room = Column(String(50), nullable=True)
    note = Column(String(255), nullable=True)
    is_cancelled = Column(Boolean, default=False)

    class_ = relationship("Class", back_populates="schedule_slots")
