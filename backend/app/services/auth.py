import secrets
from datetime import timedelta
from uuid import UUID

import bcrypt
from jose import JWTError, jwt
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
    except JWTError:
        return None


def create_refresh_token(db: Session, user_id: UUID) -> tuple[str, RefreshToken]:
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
    db.commit()
    db.refresh(ref)
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
    ref = find_valid_refresh_token(db, old_token_hash)
    if not ref:
        return None
    ref.revoked = "Y"
    db.commit()
    user = db.query(User).filter(User.id == ref.user_id).first()
    if not user:
        return None
    raw_new, _ = create_refresh_token(db, user.id)
    return raw_new, user


def revoke_all_refresh_tokens_for_user(db: Session, user_id: UUID) -> None:
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).update(
        {"revoked": "Y"}
    )
    db.commit()
