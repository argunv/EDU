import uuid

from sqlalchemy import Column, String, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.timeutil import now
from app.models.base import Base


class User(Base):
    """Пользователь. Для ученика активный класс в API (/me, relation_access) —
    из ClassEnrollment через get_active_enrollment; колонка class_id дублирует класс
    при операциях админки и простых выборках; при ручных правках БД возможен рассинхрон."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    # pending, rejected, teacher, student, parent, admin
    role = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=now)
    phone = Column(String(32), nullable=True)
    birth_date = Column(Date, nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    avatar_path = Column(String(512), nullable=True)
    class_id = Column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True
    )  # ученик: денормализация в паре с ClassEnrollment (канон — enrollment)

    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    password_reset_tokens = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(String(1), default="N")  # Y/N
    created_at = Column(DateTime(timezone=True), default=now)

    user = relationship("User", back_populates="refresh_tokens")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    user = relationship("User", back_populates="password_reset_tokens")
