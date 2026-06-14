# ========== API (backend) ==========
FROM python:3.12-slim AS api
WORKDIR /app
RUN pip install poetry
COPY backend/pyproject.toml backend/poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --without dev --no-root --no-interaction
COPY backend/ .
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "log_config.json"]

# ========== API test (backend + dev deps, для task test) ==========
FROM api AS api-test
RUN apt-get update && apt-get install -y --no-install-recommends coreutils && rm -rf /var/lib/apt/lists/*
RUN poetry install --no-root --no-interaction
# Явно копируем скрипт создания тестовой БД (нужен в command сервиса test)
COPY backend/scripts/ensure_test_db.py /app/scripts/ensure_test_db.py
# Миграции и pytest выполняются в command сервиса test

# ========== WEB (frontend SPA) ==========
FROM node:26.3.0-alpine AS web-builder
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
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ========== Notifier (RabbitMQ consumer, uses app.core.config) ==========
FROM api AS notifier
CMD ["python", "-m", "notifier.consume"]
