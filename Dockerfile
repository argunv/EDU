# ========== API dependencies ==========
FROM python:3.12-slim AS api-builder
ARG POETRY_VERSION=2.1.3
RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}"
WORKDIR /build
COPY backend/pyproject.toml backend/poetry.lock ./
RUN python -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN poetry install --only main --no-root --no-interaction

# ========== API (backend) ==========
FROM python:3.12-slim AS api
ARG PIP_VERSION=26.1.2
RUN python -m pip install --no-cache-dir --upgrade "pip==${PIP_VERSION}"
WORKDIR /app
COPY --from=api-builder /opt/venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/notifier ./notifier
COPY backend/scripts/restore_media.py ./scripts/restore_media.py
COPY backend/alembic.ini backend/log_config.json backend/run_migrate.sh ./
ENV PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=172.16.0.0/12", "--log-config", "log_config.json"]

# ========== API test (backend + dev deps, для task test) ==========
FROM api-builder AS api-test-builder
RUN poetry install --with dev --no-root --no-interaction

FROM api AS api-test
COPY --from=api-test-builder /opt/venv /opt/venv
RUN apt-get update && apt-get install -y --no-install-recommends coreutils && rm -rf /var/lib/apt/lists/*
COPY backend/tests ./tests
COPY backend/scripts/ensure_test_db.py /app/scripts/ensure_test_db.py
# Миграции и pytest выполняются в command сервиса test

# ========== WEB (frontend SPA) ==========
FROM node:22.12.0-alpine AS web-builder
WORKDIR /app
ENV VITE_API_URL=/api
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY vite.config.ts tsconfig.app.json tsconfig.json tsconfig.node.json components.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:alpine AS web
COPY --from=web-builder /app/dist /usr/share/nginx/html
COPY web.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ========== Notifier (RabbitMQ consumer, uses app.core.config) ==========
FROM api AS notifier
CMD ["python", "-m", "notifier.consume"]
