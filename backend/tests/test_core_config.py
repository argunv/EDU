"""Проверки жёстких правил production-секретов (регресс на небезопасный деплой)."""

import pytest

from app.core import config
from app.core.config import validate_production_secrets


def test_validate_production_secrets_skips_non_production(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "development")
    validate_production_secrets()  # не бросает


def test_validate_production_secrets_rejects_default_jwt(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "change-me-in-production")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_default_postgres_in_url(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "safe-production-secret-x")
    monkeypatch.setattr(
        config.settings,
        "database_url",
        "postgresql+psycopg2://postgres:postgres@db.example.com:5432/app",
    )
    with pytest.raises(ValueError, match="DATABASE_URL"):
        validate_production_secrets()


def test_validate_production_secrets_rejects_guest_rabbitmq(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "safe-production-secret-x")
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


def test_validate_production_secrets_rejects_localhost_frontend(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    monkeypatch.setattr(config.settings, "jwt_secret", "safe-production-secret-x")
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
