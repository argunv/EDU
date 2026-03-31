import uuid
from sqlalchemy import Column, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base


class SchoolSettings(Base):
    __tablename__ = "school_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    is_two_shift = Column(Boolean, default=True)
    # {"class-1a": "morning", ...}
    class_shift_rules = Column(JSONB, nullable=True)
