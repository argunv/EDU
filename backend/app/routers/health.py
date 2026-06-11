import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.deps import DbSession

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/ready")
def ready(db: DbSession):
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning(
            "Readiness DB check failed: %s",
            type(exc).__name__,
            exc_info=False,
        )
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "db": "error"},
        )
    return {"status": "ready", "db": "ok"}
