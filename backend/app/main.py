import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    correlation_id = request.headers.get("X-Correlation-ID", "").strip()
    if not correlation_id:
        correlation_id = str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api"
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(classes.router, prefix=API_PREFIX)
app.include_router(students.router, prefix=API_PREFIX)
app.include_router(teacher.router, prefix=API_PREFIX)
app.include_router(me.router, prefix=API_PREFIX)
