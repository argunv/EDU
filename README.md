# ABH Edu

Full-stack educational platform: React (Vite) frontend and FastAPI backend with PostgreSQL, Redis, RabbitMQ, and email notifier.

## Stack

- **Frontend:** React 19, TypeScript, Vite, TanStack Query, Tailwind, React Router
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic
- **Infra:** PostgreSQL, Redis, RabbitMQ, Docker Compose, nginx

## Environment

Copy `.env.example` to `.env` and set variables (see below).

### Variables (from .env.example)

- `DATABASE_URL` — PostgreSQL URL (e.g. `postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu`)
- `REDIS_URL` — Redis URL
- `RABBITMQ_URL` — RabbitMQ URL
- `JWT_SECRET` — Secret for access tokens (use a strong value in production)
- `NOTIFIER_QUEUE` — Queue name for email tasks (default `email_tasks`)
- `SMTP_*` — SMTP settings for the notifier (password reset emails)
- `FRONTEND_URL` / `VITE_API_URL` — Frontend URL and API base URL for the client
- `CORS_ORIGINS` — Allowed origins (JSON array or comma-separated)

## Backend (FastAPI)

### Local (without Docker)

```bash
cd backend
poetry install
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Or with Taskfile from repo root:

```bash
# If using Docker for Postgres: run migrations in container
task migrate-docker

# Or start Postgres only, then run migrations locally
docker compose up -d postgres
task migrate

task api
```

### Tests

```bash
cd backend
poetry install --with dev
# Use PostgreSQL for tests (SQLite may fail on UUID types)
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu_test
pytest -v
```

Lint:

```bash
task lint-backend
# or: flake8 app && bandit -r app
```

## Frontend

```bash
npm install
# Set VITE_API_URL to backend URL (default http://localhost:8000)
npm run dev
```

Build:

```bash
npm run build
```

## Docker Compose

Starts API, PostgreSQL, Redis, RabbitMQ, notifier, automigrate, and nginx:

```bash
docker compose up -d --build
```

- API: http://localhost:8000 (or via nginx on port 80)
- Migrations run automatically via the `automigrate` service on first start.

Healthchecks are enabled for all services except nginx.

### Dev: обновление кода без пересборки

В проекте есть **docker-compose.override.yml**: при `docker compose up` монтируется код backend в контейнер `api` и включён **uvicorn --reload** — изменения в `backend/` подхватываются без перезапуска. Контейнер `notifier` тоже монтирует свой код (после правок: `docker compose restart notifier`). БД и тома данных не затрагиваются. Для фронта: либо собирайте образ как раньше (`docker compose up --build` при смене фронта), либо запускайте `npm run dev` на хосте и заходите на http://localhost:5173.

## Dev seed data

Тестовые данные в БД (идемпотентно, без конфликтов при повторном запуске):

```bash
docker compose up -d postgres
task migrate
task seed
```

SQL: `backend/scripts/seed_dev.sql`. Пароль для всех пользователей: **123456**.

| Роль    | Email           |
|--------|------------------|
| admin  | admin@test.ru    |
| teacher| teacher@test.ru  |
| student| user@test.ru     |
| parent | parent@test.ru   |
| pending| pending@test.ru  |

Только для dev/тестовой среды.

## Реализованный функционал

- **Регистрация и роли:** регистрация пользователя (роль `pending`), одобрение/отклонение админом, назначение роли (student, parent, teacher, admin), привязка к классу, предметам, детям.
- **Расписание (админ):** настройка слотов по классу, смене и дню недели; сохранение изменений. Уроки на дату **автоматически создаются из расписания**, когда учитель открывает день в «Сегодня».
- **Учитель:** просмотр уроков по дням, ввод темы и ДЗ, сохранение посещаемости и оценок; ДЗ попадает в раздел ученика на следующий день. Журнал по классу и предмету с сохранением оценок с привязкой к предмету (корректный «Прогресс» у ученика).
- **Ученик/родитель:** расписание, ДЗ (по диапазону), прогресс по предметам. Родитель может выбрать ребёнка.
- **Сброс пароля:** запрос ссылки по email, отправка через RabbitMQ + notifier (SMTP).

## API Overview

- **Auth:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`
- **Admin:** `GET/POST /admin/users`, `POST /admin/users/{id}/approve`, `POST /admin/users/{id}/reject`, `PATCH /admin/users/{id}/role`, `GET /admin/school-settings`, `GET /admin/schedule`, `POST /admin/schedule/changes`, `GET /admin/journal`, etc.
- **Domain:** `GET /classes`, `GET /classes/{id}`, `GET /students?search=...`
- **Teacher:** `GET /teacher/lessons` (при запросе создаёт уроки из расписания на дату), `GET /teacher/lessons/{id}/students`, `POST /teacher/lessons/grades` (topic, homework_text → запись в ДЗ), `GET /teacher/journal?class_id=&subject_id=`, `POST /teacher/journal/grade` (subject_id для прогресса)
- **Me (student/parent):** `GET /me/children`, `GET /me/schedule`, `GET /me/homework`, `GET /me/progress`
- **Health:** `GET /health`

OpenAPI docs: http://localhost:8000/docs

## Auth Flow

- Access token: short-lived, kept only in memory on the frontend (no localStorage).
- Refresh token: httpOnly cookie; rotated on each use; revoked on password change.
- On 401, the frontend calls `POST /auth/refresh` and retries the request; on refresh failure, the user is logged out.
