from datetime import datetime
from zoneinfo import ZoneInfo

from app.core import timeutil


def test_app_today_uses_application_aware_now(monkeypatch):
    local_now = datetime(2026, 7, 11, 0, 30, tzinfo=ZoneInfo("Europe/Moscow"))
    monkeypatch.setattr(timeutil, "now", lambda: local_now)

    assert timeutil.app_today().isoformat() == "2026-07-11"
