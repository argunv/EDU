from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Hostnames Docker Compose / внутренних сервисов — не использовать в FRONTEND_URL
# (письма и редиректы должны вести на URL из браузера пользователя).
_DOCKER_INTERNAL_FRONTEND_HOSTS = frozenset(
    {
        "web",
        "api",
        "nginx",
        "frontend",
        "backend",
        "notifier",
        "postgres",
        "redis",
        "rabbitmq",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Environment: "development" | "production". In production, secrets are
    # validated at startup.
    environment: str = "development"

    # IANA name: UTC, Europe/Moscow, … (APP_TIMEZONE в .env)
    app_timezone: str = Field(
        default="UTC",
        description="IANA timezone for application 'now' and ORM defaults",
    )

    # Database
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # RabbitMQ
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Notifier (email queue name and consumer config)
    notifier_queue: str = "email_tasks"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    # Внешний URL фронтенда в браузере пользователя (FRONTEND_URL).
    # Используется в письмах (сброс пароля), не смешивать с VITE_API_URL.
    frontend_url: str = "http://localhost:5173"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Rate limit (requests per window)
    rate_limit_login: str = "5/60"  # 5 per 60 seconds
    rate_limit_register: str = "3/60"
    rate_limit_forgot: str = "3/300"
    rate_limit_reset: str = "5/60"
    rate_limit_fail_closed: bool = True

    @field_validator("app_timezone")
    @classmethod
    def timezone_must_be_valid_iana(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except ZoneInfoNotFoundError as e:
            raise ValueError(
                f"Invalid app_timezone / APP_TIMEZONE: {v!r}. Use an IANA name, e.g. UTC."
            ) from e
        return v

    @field_validator("frontend_url")
    @classmethod
    def frontend_url_must_be_public_browser_origin(cls, v: str) -> str:
        raw = v.strip()
        if not raw:
            raise ValueError("FRONTEND_URL must not be empty.")
        parsed = urlparse(raw)
        scheme = (parsed.scheme or "").lower()
        if scheme not in ("http", "https"):
            raise ValueError(
                "FRONTEND_URL must be an absolute URL with http:// or https:// "
                "(the frontend address users open in the browser, not a Docker service name)."
            )
        host = (parsed.hostname or "").lower()
        if host in _DOCKER_INTERNAL_FRONTEND_HOSTS:
            raise ValueError(
                f"FRONTEND_URL hostname {host!r} is a Docker Compose service name. "
                "Use a browser URL, e.g. http://localhost (nginx on host port 80), "
                "http://localhost:5173 (Vite on host), or https://your.domain."
            )
        return raw


settings = Settings()


def reset_password_public_link(token: str) -> str:
    """Ссылка «сброс пароля» для email; база — settings.frontend_url (без лишнего /)."""
    base = settings.frontend_url.rstrip("/")
    return f"{base}/auth/reset-password?token={token}"


def validate_production_secrets() -> None:
    """Fail startup in production if secrets use defaults. Required for audit."""
    env = getattr(settings, "environment", "development")
    if env.lower() != "production":
        return
    if settings.jwt_secret == "change-me-in-production":  # nosec B105
        raise ValueError(
            "JWT_SECRET must be set to a non-default value in production. "
            "Set ENVIRONMENT=production only with secure secrets."
        )
    if "postgres:postgres" in settings.database_url:
        raise ValueError(
            "DATABASE_URL must not contain default credentials "
            "(e.g. postgres:postgres) in production.",
        )
    if "guest:guest@" in settings.rabbitmq_url:
        raise ValueError("RABBITMQ_URL must not use guest credentials in production.")
    if "localhost" in (urlparse(settings.frontend_url).hostname or ""):
        raise ValueError(
            "FRONTEND_URL must not use localhost in production. "
            "For local Docker set ENVIRONMENT=development, or set FRONTEND_URL to your public https URL."
        )
