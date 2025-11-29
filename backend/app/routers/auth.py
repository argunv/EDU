import hashlib
import secrets
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.deps import get_db, DbSession
from app.models.user import User, PasswordResetToken
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
    revoke_all_refresh_tokens_for_user,
)
from app.services.rate_limit import check_rate_limit
from app.services.email_queue import publish_email_task

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_HTTPONLY = True
REFRESH_COOKIE_SAMESITE = "lax"
REFRESH_COOKIE_MAX_AGE_DAYS = 7


def _set_refresh_cookie(request: Request, response: Response, raw_token: str) -> None:
    """
    Set refresh cookie.

    Cookie `secure` flag is determined by the actual request scheme (taking into account
    reverse proxies via X-Forwarded-Proto). This avoids issuing Secure cookies over
    plain HTTP, which would then never be sent back by the browser and break refresh
    flow after page reload.
    """
    # Prefer real scheme from proxy headers, fallback to request.url.scheme.
    proto = request.headers.get("X-Forwarded-Proto") or request.url.scheme
    secure = proto == "https"
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=REFRESH_COOKIE_MAX_AGE_DAYS * 24 * 3600,
        httponly=REFRESH_COOKIE_HTTPONLY,
        samesite=REFRESH_COOKIE_SAMESITE,
        secure=secure,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, samesite=REFRESH_COOKIE_SAMESITE)


def _get_refresh_token_from_cookie(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE_NAME)


def _refresh_token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post("/register", response_model=TokenResponse)
def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: DbSession,
):
    check_rate_limit("register", request.client.host if request.client else "unknown", settings.rate_limit_register)
    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пользователь с таким email уже зарегистрирован")
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        name=body.name.strip() or "Пользователь",
        role="pending",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    raw_refresh, _ = create_refresh_token(db, user.id)
    access = create_access_token(str(user.id))
    _set_refresh_cookie(request, response, raw_refresh)
    return TokenResponse(access_token=access, user=UserResponse.from_orm_user_with_db(user, db))


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: DbSession,
):
    check_rate_limit("login", request.client.host if request.client else "unknown", settings.rate_limit_login)
    user = db.query(User).filter(User.email == body.login.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    if user.role == "rejected":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ отклонён")
    raw_refresh, _ = create_refresh_token(db, user.id)
    access = create_access_token(str(user.id))
    _set_refresh_cookie(request, response, raw_refresh)
    return TokenResponse(access_token=access, user=UserResponse.from_orm_user_with_db(user, db))


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: DbSession,
):
    raw = _get_refresh_token_from_cookie(request)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")
    token_hash = _refresh_token_hash(raw)
    result = rotate_refresh_token(db, token_hash)
    if not result:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    raw_new, user = result
    _set_refresh_cookie(request, response, raw_new)
    access = create_access_token(str(user.id))
    return TokenResponse(access_token=access, user=UserResponse.from_orm_user_with_db(user, db))


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
    _clear_refresh_cookie(response)
    return None


@router.post("/forgot-password", response_model=OkResponse)
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: DbSession,
):
    check_rate_limit("forgot", request.client.host if request.client else "unknown", settings.rate_limit_forgot)
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user:
        token_raw = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token_raw.encode()).hexdigest()
        expires = datetime.utcnow() + timedelta(hours=1)
        pt = PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires)
        db.add(pt)
        db.commit()
        cid = request.headers.get("X-Correlation-ID", "")
        publish_email_task(
            {"type": "reset_password", "email": user.email, "token": token_raw},
            correlation_id=cid,
        )
    return OkResponse()


@router.post("/reset-password", response_model=OkResponse)
def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: DbSession,
):
    check_rate_limit("reset", request.client.host if request.client else "unknown", settings.rate_limit_reset)
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    pt = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.expires_at > datetime.utcnow(),
    ).first()
    if not pt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недействительная или устаревшая ссылка. Запросите сброс пароля снова.")
    user = db.query(User).filter(User.id == pt.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пользователь не найден")
    user.password_hash = hash_password(body.password)
    db.delete(pt)
    db.commit()
    revoke_all_refresh_tokens_for_user(db, user.id)
    return OkResponse()


@router.get("/me", response_model=TokenResponse)
def me(
    request: Request,
    response: Response,
    db: DbSession,
):
    """Return current user. Accepts Bearer token or refresh cookie (will rotate and set new cookie)."""
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        from app.services.auth import decode_access_token
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return TokenResponse(access_token=token, user=UserResponse.from_orm_user_with_db(user, db))
    raw = _get_refresh_token_from_cookie(request)
    if raw:
        token_hash = _refresh_token_hash(raw)
        result = rotate_refresh_token(db, token_hash)
        if result:
            raw_new, user = result
            _set_refresh_cookie(request, response, raw_new)
            access = create_access_token(str(user.id))
            return TokenResponse(access_token=access, user=UserResponse.from_orm_user_with_db(user, db))
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
