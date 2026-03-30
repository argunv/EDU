from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    # Базовый URL для ссылок в письмах (сброс пароля и т.д.). В production
    # задайте домен (FRONTEND_URL).
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


settings = Settings()


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
    if settings.frontend_url.startswith("http://localhost"):
        raise ValueError("FRONTEND_URL must be a real domain in production.")
