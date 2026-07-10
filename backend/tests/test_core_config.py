"""Проверки жёстких правил production-секретов (регресс на небезопасный деплой)."""

import pytest
from pydantic import ValidationError

from app.core import config
from app.core.config import Settings, validate_production_secrets


def test_settings_rejects_invalid_app_timezone():
    with pytest.raises(ValidationError, match="app_timezone|Invalid"):
        Settings(app_timezone="NotA/Valid_Timezone_Name_XXX")


def test_settings_rejects_docker_service_as_frontend_url_hostname():
    with pytest.raises(ValidationError, match="FRONTEND_URL|Docker"):
        Settings(frontend_url="https://web:5173")


def test_settings_rejects_frontend_url_without_scheme():
    with pytest.raises(ValidationError, match="FRONTEND_URL|http"):
        Settings(frontend_url="localhost:80")


def test_reset_password_public_link_trims_slash(monkeypatch):
    monkeypatch.setattr(config.settings, "frontend_url", "https://example.org/")
    from app.core.config import reset_password_public_link

    assert (
        reset_password_public_link("tok")
        == "https://example.org/auth/reset-password?token=tok"
    )


def test_validate_production_secrets_skips_non_production(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "development")
    validate_production_secrets()  # не бросает


def test_validate_production_secrets_trims_environment(monkeypatch):
    """Пробелы вокруг ENVIRONMENT=production не должны отключать проверки секретов."""
    monkeypatch.setattr(config.settings, "environment", "  production  ")
    monkeypatch.setattr(config.settings, "jwt_secret", "change-me-in-production")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_default_jwt(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "change-me-in-production")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_dev_jwt_alias(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "dev-only-change-me")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_short_jwt(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "short-but-not-default")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_default_postgres_in_url(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(
        config.settings, "jwt_secret", "safe-production-secret-at-least-32-chars"
    )
    monkeypatch.setattr(
        config.settings,
        "database_url",
        "postgresql+psycopg2://postgres:postgres@db.example.com:5432/app",
    )
    with pytest.raises(ValueError, match="DATABASE_URL"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_guest_rabbitmq(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(
        config.settings, "jwt_secret", "safe-production-secret-at-least-32-chars"
    )
    monkeypatch.setattr(
        config.settings,
        "database_url",
        "postgresql+psycopg2://app:secret@db.example.com:5432/app",
    )
    monkeypatch.setattr(
        config.settings,
        "rabbitmq_url",
        "amqp://guest:guest@rabbit:5672/",
    )
    with pytest.raises(ValueError, match="RABBITMQ_URL"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_example_rabbitmq_password(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(
        config.settings, "jwt_secret", "safe-production-secret-at-least-32-chars"
    )
    monkeypatch.setattr(
        config.settings,
        "database_url",
        "postgresql+psycopg2://app:secret@db.example.com:5432/app",
    )
    monkeypatch.setattr(
        config.settings,
        "rabbitmq_url",
        "amqp://edu_mq:edu_mq_dev_pass@rabbit:5672/",
    )
    with pytest.raises(ValueError, match="RABBITMQ_URL"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_localhost_frontend(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(
        config.settings, "jwt_secret", "safe-production-secret-at-least-32-chars"
    )
    monkeypatch.setattr(
        config.settings,
        "database_url",
        "postgresql+psycopg2://app:secret@db.example.com:5432/app",
    )
    monkeypatch.setattr(
        config.settings,
        "rabbitmq_url",
        "amqp://user:pass@rabbit:5672/",
    )
    monkeypatch.setattr(config.settings, "frontend_url", "http://localhost:5173")
    with pytest.raises(ValueError, match="FRONTEND_URL"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_http_frontend(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(
        config.settings, "jwt_secret", "safe-production-secret-at-least-32-chars"
    )
    monkeypatch.setattr(
        config.settings,
        "database_url",
        "postgresql+psycopg2://app:secret@db.example.com:5432/app",
    )
    monkeypatch.setattr(
        config.settings,
        "rabbitmq_url",
        "amqp://user:pass@rabbit:5672/",
    )
    monkeypatch.setattr(config.settings, "frontend_url", "http://school.example.com")
    with pytest.raises(ValueError, match="https"):
        validate_production_secrets()
