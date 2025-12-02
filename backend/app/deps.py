from collections.abc import Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User


def get_db() -> Generator[Session, None, None]:
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


security = HTTPBearer(auto_error=False)
optional_bearer = HTTPBearer(auto_error=False)


def get_current_user_optional(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(optional_bearer)],
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
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    """Require authenticated user. Raises 401 if not authenticated."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


def require_roles(allowed_roles: list[str]):
    """Dependency factory: require current user to have one of the given roles."""
    def _require_roles(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
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
