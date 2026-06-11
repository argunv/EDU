from collections.abc import Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.relation_access import get_user_roles, has_user_role


def get_db() -> Generator[Session, None, None]:
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


optional_bearer = HTTPBearer(auto_error=False)


def get_current_user_optional(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(optional_bearer)
    ],
) -> User | None:
    """Return current user from Bearer token or None if no/invalid token."""
    if not credentials:
        return None
    from app.services.auth import decode_access_token

    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    try:
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError):
        return None
    user = db.query(User).filter(User.id == uid).first()
    return user


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    """Require authenticated user. Raises 401 if not authenticated."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    if user.role == "rejected" or has_user_role(db, user.id, "rejected"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ отклонён",
        )
    if user.role == "pending" or has_user_role(db, user.id, "pending"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учётная запись ожидает одобрения администратором",
        )
    return user


def require_roles(allowed_roles: list[str]):
    """Require current user to have one of allowed_roles (dependency factory)."""

    def _require_roles(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        roles = get_user_roles(db, current_user.id)
        if not roles.intersection(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _require_roles


# Type aliases for injection
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles(["admin"]))]
TeacherUser = Annotated[User, Depends(require_roles(["teacher"]))]
