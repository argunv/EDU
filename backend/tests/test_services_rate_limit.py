import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services import rate_limit
from app.services.rate_limit import check_rate_limit, parse_rate, rate_limit_key


def test_parse_rate():
    assert parse_rate("5/60") == (5, 60)
    assert parse_rate("3/300") == (3, 300)
    assert parse_rate("  10/120  ") == (10, 120)


def test_parse_rate_invalid():
    assert parse_rate("invalid") == (10, 60)
    assert parse_rate("") == (10, 60)


def test_rate_limit_key():
    assert rate_limit_key("login", "192.168.1.1") == "rate:login:192.168.1.1"
    assert rate_limit_key("register", "unknown") == "rate:register:unknown"


def test_check_rate_limit_no_redis_fail_closed(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_fail_closed", True)
    monkeypatch.setattr("app.services.rate_limit.get_redis", lambda: None)
    with pytest.raises(HTTPException) as exc:
        check_rate_limit("login", "127.0.0.1", "5/60")
    assert exc.value.status_code == 503


def test_check_rate_limit_no_redis_allows_when_fail_open(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_fail_closed", False)
    monkeypatch.setattr("app.services.rate_limit.get_redis", lambda: None)
    check_rate_limit("login", "127.0.0.1", "5/60")


def test_check_rate_limit_exceeds_returns_429(monkeypatch):
    count_holder = {"n": 6}

    class Pipe:
        def incr(self, _k):
            return self

        def expire(self, _k, _w):
            return self

        def execute(self):
            return [count_holder["n"]]

    class FakeRedis:
        def pipeline(self):
            return Pipe()

    monkeypatch.setattr("app.services.rate_limit.get_redis", lambda: FakeRedis())
    with pytest.raises(HTTPException) as exc:
        check_rate_limit("login", "192.168.0.1", "5/60")
    assert exc.value.status_code == 429


def test_check_rate_limit_redis_pipeline_error_fail_closed(monkeypatch):
    class BadPipe:
        def incr(self, _k):
            return self

        def expire(self, _k, _w):
            return self

        def execute(self):
            raise ConnectionError("redis flaky")

    class FakeRedis:
        def pipeline(self):
            return BadPipe()

    monkeypatch.setattr(settings, "rate_limit_fail_closed", True)
    monkeypatch.setattr("app.services.rate_limit.get_redis", lambda: FakeRedis())
    with pytest.raises(HTTPException) as exc:
        check_rate_limit("login", "10.0.0.1", "5/60")
    assert exc.value.status_code == 503


def test_check_rate_limit_redis_pipeline_error_fail_open(monkeypatch):
    class BadPipe:
        def incr(self, _k):
            return self

        def expire(self, _k, _w):
            return self

        def execute(self):
            raise ConnectionError("redis flaky")

    class FakeRedis:
        def pipeline(self):
            return BadPipe()

    monkeypatch.setattr(settings, "rate_limit_fail_closed", False)
    monkeypatch.setattr("app.services.rate_limit.get_redis", lambda: FakeRedis())
    check_rate_limit("login", "10.0.0.2", "5/60")


def test_get_redis_retries_after_temporary_failure(monkeypatch):
    class FakeRedis:
        def ping(self):
            return True

    calls = {"count": 0}

    def from_url(*_args, **_kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise ConnectionError("temporary outage")
        return FakeRedis()

    clock = {"now": 100.0}
    monkeypatch.setattr(rate_limit.redis, "from_url", from_url)
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock["now"])
    monkeypatch.setattr(rate_limit, "_redis_client", None)
    monkeypatch.setattr(rate_limit, "_redis_failed", False)
    monkeypatch.setattr(rate_limit, "_redis_retry_at", 0.0)

    assert rate_limit.get_redis() is None
    assert rate_limit.get_redis() is None
    assert calls["count"] == 1

    clock["now"] += rate_limit._REDIS_RETRY_SECONDS
    assert rate_limit.get_redis() is not None
    assert calls["count"] == 2
    assert rate_limit._redis_failed is False
