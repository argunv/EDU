import hashlib
import secrets
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timeutil import now
from app.deps import DbSession
from app.models.user import User, PasswordResetToken, RefreshToken
from app.models.role_profiles import UserRole
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    OkResponse,
)
from app.schemas.user import UserResponse
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    decode_access_token,
)
from app.services.rate_limit import check_rate_limit
from app.services.email_queue import publish_email_task
from app.services.relation_access import has_user_role

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_HTTPONLY = True
REFRESH_COOKIE_SAMESITE = "lax"


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _ensure_login_or_refresh_allowed(db: Session, user: User) -> None:
    """Вход и ротация refresh: как в deps — отклонённые и ожидающие не получают сессию."""
    if user.role == "rejected" or has_user_role(db, user.id, "rejected"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Доступ отклонён"
        )
    if user.role == "pending" or has_user_role(db, user.id, "pending"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учётная запись ожидает одобрения администратором",
        )


def _ensure_auth_me_bearer_allowed(db: Session, user: User) -> None:
    """GET /auth/me по Bearer: ожидающие видят профиль (фронт /pending); отклонённые — нет."""
    if user.role == "rejected" or has_user_role(db, user.id, "rejected"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Доступ отклонён"
        )


def _reject_or_revoke_new_refresh(
    db: Session,
    user: User,
    raw_new: str,
    request: Request,
    response: Response,
) -> None:
    """Отклонённые и ожидающие: отзываем только что выданный refresh и cookie."""
    if user.role == "rejected" or has_user_role(db, user.id, "rejected"):
        revoke_refresh_token(db, _refresh_token_hash(raw_new))
        _clear_refresh_cookie(request, response)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Доступ отклонён"
        )
    if user.role == "pending" or has_user_role(db, user.id, "pending"):
        revoke_refresh_token(db, _refresh_token_hash(raw_new))
        _clear_refresh_cookie(request, response)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учётная запись ожидает одобрения администратором",
        )


def _refresh_cookie_secure(request: Request) -> bool:
    if settings.environment_key == "production":
        return True
    return request.url.scheme == "https"


def _set_refresh_cookie(request: Request, response: Response, raw_token: str) -> None:
    """
    Set refresh cookie.

    Production sessions are always Secure. Development follows the ASGI request
    scheme so local plain-HTTP login remains usable.
    """
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        httponly=REFRESH_COOKIE_HTTPONLY,
        samesite=REFRESH_COOKIE_SAMESITE,
        secure=_refresh_cookie_secure(request),
    )


def _clear_refresh_cookie(request: Request, response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        httponly=REFRESH_COOKIE_HTTPONLY,
        samesite=REFRESH_COOKIE_SAMESITE,
        secure=_refresh_cookie_secure(request),
    )


def _get_refresh_token_from_cookie(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE_NAME)


def _refresh_token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post("/register", response_model=TokenResponse)
def register(
    body: RegisterRequest,
    request: Request,
    db: DbSession,
):
    check_rate_limit("register", _client_ip(request), settings.rate_limit_register)
    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован",
        )
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        name=body.name.strip() or "Пользователь",
        role="pending",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="pending"))
    db.commit()
    db.refresh(user)
    # Pending users get a short-lived access token for /pending only — no refresh session.
    access = create_access_token(str(user.id))
    return TokenResponse(
        access_token=access, user=UserResponse.from_orm_user_with_db(user, db)
    )


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: DbSession,
):
    check_rate_limit("login", _client_ip(request), settings.rate_limit_login)
    user = db.query(User).filter(User.email == body.login.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )
    _ensure_login_or_refresh_allowed(db, user)
    user.last_login_at = now()
    raw_refresh, _ = create_refresh_token(db, user.id)
    access = create_access_token(str(user.id))
    _set_refresh_cookie(request, response, raw_refresh)
    return TokenResponse(
        access_token=access, user=UserResponse.from_orm_user_with_db(user, db)
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: DbSession,
):
    raw = _get_refresh_token_from_cookie(request)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )
    token_hash = _refresh_token_hash(raw)
    result = rotate_refresh_token(db, token_hash)
    if not result:
        _clear_refresh_cookie(request, response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    raw_new, user = result
    _reject_or_revoke_new_refresh(db, user, raw_new, request, response)
    _set_refresh_cookie(request, response, raw_new)
    access = create_access_token(str(user.id))
    return TokenResponse(
        access_token=access, user=UserResponse.from_orm_user_with_db(user, db)
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: DbSession,
):
    raw = _get_refresh_token_from_cookie(request)
    if raw:
        token_hash = _refresh_token_hash(raw)
        revoke_refresh_token(db, token_hash)
    _clear_refresh_cookie(request, response)
    return None


@router.post("/forgot-password", response_model=OkResponse)
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: DbSession,
):
    check_rate_limit("forgot", _client_ip(request), settings.rate_limit_forgot)
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user:
        token_raw = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token_raw.encode()).hexdigest()
        expires = now() + timedelta(hours=1)
        pt = PasswordResetToken(
            user_id=user.id, token_hash=token_hash, expires_at=expires
        )
        db.add(pt)
        db.commit()
        cid = request.headers.get("X-Correlation-ID", "")
        publish_email_task(
            {
                "type": "reset_password",
                "email": user.email,
                "token": token_raw,
            },
            correlation_id=cid,
        )
    return OkResponse()


@router.post("/reset-password", response_model=OkResponse)
def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: DbSession,
):
    check_rate_limit("reset", _client_ip(request), settings.rate_limit_reset)
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    pt = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.expires_at > now(),
        )
        .first()
    )
    if not pt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недействительная или устаревшая ссылка. Запросите сброс пароля снова.",
        )
    user = db.query(User).filter(User.id == pt.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь не найден",
        )
    user.password_hash = hash_password(body.password)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id
    ).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update(
        {"revoked": "Y"}, synchronize_session=False
    )
    db.commit()
    return OkResponse()


@router.get("/me", response_model=TokenResponse)
def me(
    request: Request,
    response: Response,
    db: DbSession,
):
    """Return current user. Accepts Bearer or refresh cookie (rotates cookie)."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
            try:
                uid = UUID(user_id) if isinstance(user_id, str) else user_id
            except (ValueError, TypeError):
                uid = None
            if uid is not None:
                user = db.query(User).filter(User.id == uid).first()
                if user:
                    _ensure_auth_me_bearer_allowed(db, user)
                    return TokenResponse(
                        access_token=token,
                        user=UserResponse.from_orm_user_with_db(user, db),
                    )
    raw = _get_refresh_token_from_cookie(request)
    if raw:
        token_hash = _refresh_token_hash(raw)
        result = rotate_refresh_token(db, token_hash)
        if result:
            raw_new, user = result
            _reject_or_revoke_new_refresh(db, user, raw_new, request, response)
            _set_refresh_cookie(request, response, raw_new)
            access = create_access_token(str(user.id))
            return TokenResponse(
                access_token=access,
                user=UserResponse.from_orm_user_with_db(user, db),
            )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
    )
