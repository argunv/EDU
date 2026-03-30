import uuid
from datetime import datetime
from sqlalchemy import Column, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class Homework(Base):
    __tablename__ = "homework"

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
    due_date = Column(Date, nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
