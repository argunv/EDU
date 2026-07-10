import logging

import redis
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.deps import DbSession

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


def _check_redis() -> bool:
    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=2)
        return bool(client.ping())
    except Exception as exc:
        logger.warning("Readiness Redis check failed: %s", type(exc).__name__)
        return False


def _check_rabbitmq() -> bool:
    try:
        import pika

        params = pika.URLParameters(settings.rabbitmq_url)
        params.socket_timeout = 2
        params.blocked_connection_timeout = 2
        conn = pika.BlockingConnection(params)
        conn.close()
        return True
    except Exception as exc:
        logger.warning("Readiness RabbitMQ check failed: %s", type(exc).__name__)
        return False


@router.get("/ready")
def ready(db: DbSession):
    checks: dict[str, str] = {}
    try:
        db.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as exc:
        logger.warning(
            "Readiness DB check failed: %s",
            type(exc).__name__,
            exc_info=False,
        )
        checks["db"] = "error"

    checks["redis"] = "ok" if _check_redis() else "error"
    checks["rabbitmq"] = "ok" if _check_rabbitmq() else "error"

    if any(v != "ok" for v in checks.values()):
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", **checks},
        )
    return {"status": "ready", **checks}
