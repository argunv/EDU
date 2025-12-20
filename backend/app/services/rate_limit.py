"""Rate limiting via Redis."""
import logging
import re

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Optional Redis; if not available, rate limit is skipped.
# _redis_failed: после первой неудачной попытки не повторяем (избегаем таймаутов на каждый запрос).
_redis_client = None
_redis_failed = False


def get_redis():
    global _redis_client, _redis_failed
    if _redis_failed:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        from app.core.config import settings
        # Короткий таймаут, чтобы в тестах/без Redis не зависать на каждом auth-запросе
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        _redis_client.ping()
    except Exception:
        _redis_failed = True
        _redis_client = None
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
    r = get_redis()
    if not r:
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
        logger.warning("Rate limit check failed (skipping limit): %s", e)
