import pytest
from fastapi import HTTPException

from app.core.config import settings
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
