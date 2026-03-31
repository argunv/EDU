"""
Aware datetime для всего приложения.

Вместо устаревших datetime.utcnow() / datetime.utcfromtimestamp() здесь
datetime.now(tz=...) и fromtimestamp(..., tz=...) с часовым поясом из конфига
(APP_TIMEZONE, по умолчанию UTC).
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo


def app_tz() -> ZoneInfo:
    """Часовой пояс приложения (IANA), из settings.app_timezone."""
    from app.core.config import settings

    return ZoneInfo(settings.app_timezone)


def now() -> datetime:
    """Текущий момент в app_tz() (всегда timezone-aware)."""
    return datetime.now(app_tz())


def from_timestamp(ts: float) -> datetime:
    """Unix timestamp → aware datetime в app_tz() (аналог utcfromtimestamp с TZ)."""
    return datetime.fromtimestamp(ts, tz=app_tz())
