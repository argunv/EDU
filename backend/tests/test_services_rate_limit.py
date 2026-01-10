import pytest

from app.services.rate_limit import parse_rate, rate_limit_key, check_rate_limit


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


def test_check_rate_limit_no_redis():
    # When Redis is not available, check_rate_limit does nothing (no exception)
    check_rate_limit("login", "127.0.0.1", "5/60")
