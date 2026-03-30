import uuid
from sqlalchemy import (
    CheckConstraint,
    Column,
    String,
    Date,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint(
            "class_id", "subject_id", "date", "time", name="uq_lesson_slot"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )
    class_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="CASCADE"),
        nullable=False,
    )
    teacher_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    date = Column(Date, nullable=False)
    time = Column(String(10), nullable=False)  # 08:30
    room = Column(String(50), nullable=True)
    topic = Column(String(500), nullable=True)
    homework_text = Column(Text, nullable=True)

    attendances = relationship(
        "LessonAttendance",
        back_populates="lesson",
        cascade="all, delete-orphan",
    )


class LessonAttendance(Base):
    __tablename__ = "lesson_attendances"
    __table_args__ = (
        UniqueConstraint(
            "lesson_id", "student_id", name="uq_lesson_attendance_student"
        ),
        CheckConstraint(
            "attendance in ('present','absent')",
            name="ck_lesson_attendance_value",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    attendance = Column(String(20), nullable=False)  # present, absent
    grade = Column(String(2), nullable=True)  # 2, 3, 4, 5, null

    lesson = relationship("Lesson", back_populates="attendances")
