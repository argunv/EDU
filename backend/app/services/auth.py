import secrets
from datetime import timedelta
from uuid import UUID

import bcrypt
import jwt
from jwt.exceptions import PyJWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timeutil import now
from app.models.user import User, RefreshToken

# bcrypt truncates at 72 bytes; normalize to bytes and cap to avoid errors
_MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    secret = password.encode("utf-8")[:_MAX_PASSWORD_BYTES]
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        secret = plain.encode("utf-8")[:_MAX_PASSWORD_BYTES]
        return bcrypt.checkpw(secret, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str) -> str:
    expire = now() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            return None
        return payload
    except PyJWTError:
        return None


def create_refresh_token(
    db: Session, user_id: UUID, *, commit: bool = True
) -> tuple[str, RefreshToken]:
    """Create a new refresh token and persist it. Returns (raw_token, model)."""
    raw = secrets.token_urlsafe(64)
    import hashlib

    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    expires_at = now() + timedelta(days=settings.refresh_token_expire_days)
    ref = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(ref)
    if commit:
        db.commit()
        db.refresh(ref)
    else:
        db.flush()
    return raw, ref


def revoke_refresh_token(db: Session, token_hash: str) -> bool:
    """Revoke a refresh token by hash. Returns True if found and revoked."""
    from app.models.user import RefreshToken

    ref = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == "N",
        )
        .first()
    )
    if not ref:
        return False
    ref.revoked = "Y"
    db.commit()
    return True


def find_valid_refresh_token(db: Session, token_hash: str) -> RefreshToken | None:
    ref = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == "N",
            RefreshToken.expires_at > now(),
        )
        .first()
    )
    return ref


def rotate_refresh_token(db: Session, old_token_hash: str) -> tuple[str, User] | None:
    """Invalidate old refresh token and issue a new one. Returns (new_raw_token, user) or None."""
    ref = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == old_token_hash,
            RefreshToken.revoked == "N",
            RefreshToken.expires_at > now(),
        )
        .with_for_update()
        .first()
    )
    if not ref:
        return None
    user = db.query(User).filter(User.id == ref.user_id).first()
    if not user:
        db.rollback()
        return None
    ref.revoked = "Y"
    raw_new, _ = create_refresh_token(db, user.id, commit=False)
    db.commit()
    return raw_new, user


def revoke_all_refresh_tokens_for_user(db: Session, user_id: UUID) -> None:
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).update(
        {"revoked": "Y"}
    )
    db.commit()
