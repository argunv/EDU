"""Поведение окружения и флагов observability без поднятого приложения."""
from app.core.config import Settings


def test_environment_key_strips_and_lowercases():
    s = Settings.model_construct(environment="  Production  ")
    assert s.environment_key == "production"


def test_expose_prometheus_metrics_true_for_dev_staging_prod():
    assert Settings.model_construct(environment="development").expose_prometheus_metrics is True
    assert Settings.model_construct(environment="staging").expose_prometheus_metrics is True
    assert Settings.model_construct(environment="production").expose_prometheus_metrics is True


def test_expose_prometheus_metrics_false_for_test_and_empty():
    assert Settings.model_construct(environment="test").expose_prometheus_metrics is False
    assert Settings.model_construct(environment="").expose_prometheus_metrics is False
