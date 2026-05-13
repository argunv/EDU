import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings, validate_production_secrets
from app.routers import auth, health, admin, classes, students, teacher, me

logger = logging.getLogger("app.access")


def _configure_access_log():
    if logger.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


_configure_access_log()


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_production_secrets()
    yield


app = FastAPI(
    title="ABH Edu API",
    description="Backend API for ABH Edu",
    version="0.1.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
)


@app.middleware("http")
async def correlation_id_middleware(request, call_next):
    start = time.perf_counter()
    correlation_id = request.headers.get("X-Correlation-ID", "").strip()
    if not correlation_id:
        correlation_id = str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    # Access log with correlation ID: [uuid] "METHOD path" status size
    content_length = response.headers.get("content-length", "-")
    logger.info(
        '[%s] "%s %s" %s %s',
        correlation_id,
        request.method,
        request.url.path or "/",
        response.status_code,
        content_length,
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    correlation_id = getattr(request.state, "correlation_id", None)
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "detail": exc.errors(),
            "correlation_id": correlation_id,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    correlation_id = getattr(request.state, "correlation_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "http_error",
            "detail": exc.detail,
            "correlation_id": correlation_id,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", None)
    logger.exception("Unhandled exception [%s]: %s", correlation_id, exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "detail": "Internal server error",
            "correlation_id": correlation_id,
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root metrics endpoint for Prometheus scrape.
Instrumentator(
    should_group_status_codes=True,
    should_group_untemplated=True,
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

API_PREFIX = "/api"
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(classes.router, prefix=API_PREFIX)
app.include_router(students.router, prefix=API_PREFIX)
app.include_router(teacher.router, prefix=API_PREFIX)
app.include_router(me.router, prefix=API_PREFIX)

# Backward-compatible routes for existing test suite.
if settings.environment.lower() == "test":
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(classes.router)
    app.include_router(students.router)
    app.include_router(teacher.router)
    app.include_router(me.router)
