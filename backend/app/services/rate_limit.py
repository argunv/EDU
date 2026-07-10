"""Rate limiting via Redis."""

import logging
import re
import time

from fastapi import HTTPException, status
import redis

logger = logging.getLogger(__name__)

# Redis-backed limiter. If Redis is down and fail-closed is enabled,
# auth endpoints are temporarily protected with 503 instead of fail-open.
# _redis_failed: после первой неудачной попытки не повторяем (избегаем
# таймаутов на каждый запрос).
_redis_client = None
_redis_failed = False
_redis_retry_at = 0.0
_REDIS_RETRY_SECONDS = 5.0


def get_redis():
    global _redis_client, _redis_failed, _redis_retry_at
    if _redis_failed and time.monotonic() < _redis_retry_at:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        from app.core.config import settings

        # Короткий таймаут, чтобы в тестах/без Redis не зависать на каждом
        # auth-запросе
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        _redis_client.ping()
    except Exception:
        _redis_failed = True
        _redis_retry_at = time.monotonic() + _REDIS_RETRY_SECONDS
        _redis_client = None
    else:
        _redis_failed = False
        _redis_retry_at = 0.0
    return _redis_client


def parse_rate(rate: str) -> tuple[int, int]:
    """Parse '5/60' -> (5, 60)."""
    m = re.match(r"^(\d+)/(\d+)$", rate.strip())
    if not m:
        return 10, 60
    return int(m.group(1)), int(m.group(2))


def rate_limit_key(prefix: str, identifier: str) -> str:
    return f"rate:{prefix}:{identifier}"


def check_rate_limit(prefix: str, identifier: str, rate: str) -> None:
    """Raises HTTPException 429 if over limit."""
    from app.core.config import settings

    r = get_redis()
    if not r:
        if settings.rate_limit_fail_closed:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Rate limiter temporarily unavailable. Try again later.",
            )
        return
    try:
        limit, window = parse_rate(rate)
        key = rate_limit_key(prefix, identifier)
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        results = pipe.execute()
        count = results[0]
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Try again later.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Rate limit check failed: %s", e)
        if settings.rate_limit_fail_closed:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Rate limiter temporarily unavailable. Try again later.",
            )
