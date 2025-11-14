import uuid
from sqlalchemy import Column, String, Boolean, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class Class(Base):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("year_start", "grade", "letter", name="uq_classes_year_grade_letter"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    year_start = Column(Integer, nullable=False)
    grade = Column(Integer, nullable=False)
    letter = Column(String(5), nullable=False)
    name = Column(String(50), nullable=False)
    shift = Column(String(20), nullable=True)  # morning, evening
    shift_locked = Column(Boolean, default=False)
    max_lessons_per_week = Column(Integer, nullable=True)
    archived = Column(Boolean, nullable=False, default=False)

    students = relationship("Student", back_populates="class_")
    schedule_slots = relationship("ScheduleSlot", back_populates="class_")
