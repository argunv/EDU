# ABH Edu

ABH Edu — full-stack MVP-платформа для школы: управление пользователями и ролями, расписанием, уроками, журналом, домашними заданиями и просмотром данных учениками/родителями.

Проект состоит из:
- **Frontend** на React + Vite
- **Backend** на FastAPI
- **Инфраструктуры** на PostgreSQL, Redis, RabbitMQ, Docker Compose и nginx
- **Email notifier** для сценария сброса пароля

---

## Стек

### Frontend
- React 19
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Vitest + Testing Library + MSW

### Backend
- Python 3.12
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic
- Pytest

### Infrastructure
- PostgreSQL
- Redis
- RabbitMQ
- Docker Compose
- nginx

---

## Что реализовано (MVP)

### Аутентификация и роли
- регистрация пользователя с ролью `pending`
- вход / выход
- refresh access token через httpOnly cookie
- запрос на сброс пароля
- подтверждение / отклонение пользователя админом
- назначение ролей:
  - `admin`
  - `teacher`
  - `student`
  - `parent`

### Администратор
- просмотр и модерация пользователей
- одобрение / отклонение заявок
- назначение ролей
- управление школьными настройками
- настройка расписания по:
  - классу
  - смене
  - дню недели
  - слотам уроков
- просмотр журнала

### Учитель
- просмотр уроков по дням
- автоматическое создание уроков на дату из расписания при открытии дня
- ввод темы урока
- ввод домашнего задания
- сохранение посещаемости
- выставление оценок
- работа с журналом по классу и предмету

### Ученик / Родитель
- просмотр расписания
- просмотр домашнего задания
- просмотр прогресса по предметам
- у родителя — выбор ребёнка

### Сброс пароля
- запрос письма
- отправка задачи через RabbitMQ
- обработка через notifier
- отправка email через SMTP

---

## Архитектура (кратко)

### Frontend
- `src/features/*` — feature-based UI по ролям и сценариям
- `src/api/*` — API-клиенты и контракты
- `src/components/*` — общие UI и layout-компоненты
- `src/test/*` — тестовая инфраструктура (MSW, render helpers)

### Backend
- `backend/app/routers/*` — API endpoints
- `backend/app/services/*` — прикладная логика
- `backend/app/models/*` — SQLAlchemy модели
- `backend/app/schemas/*` — Pydantic схемы
- `backend/app/repositories/*` — точечный repository-слой для сложного admin schedule сценария
- `backend/alembic/*` — миграции БД
- `backend/tests/*` — backend tests

---

## Быстрый старт (рекомендуемый способ)

### Запуск через Docker Compose

```bash
docker compose up -d --build
````

Поднимаются:

* API
* PostgreSQL
* Redis
* RabbitMQ
* notifier
* automigrate
* nginx

### После запуска

* API: [http://localhost:8000](http://localhost:8000)
* OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)
* Frontend (через nginx): обычно [http://localhost](http://localhost)
* Frontend dev server (если запускается отдельно): [http://localhost:5173](http://localhost:5173)

---

## Docker Compose: dev-режим без полной пересборки

В проекте есть `docker-compose.override.yml`.

При обычном:

```bash
docker compose up
```

для backend:

* код `backend/` монтируется в контейнер `api`
* включён `uvicorn --reload`
* изменения в backend подхватываются без полной пересборки

Для notifier:

* код тоже монтируется
* после правок обычно достаточно:

```bash
docker compose restart notifier
```

Для frontend:

* либо пересобирать образ при изменениях
* либо запускать локально:

```bash
npm run dev
```

и открывать:

* [http://localhost:5173](http://localhost:5173)

---

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения.

### Основные переменные

* `DATABASE_URL` — PostgreSQL URL
  пример: `postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu`
* `REDIS_URL` — Redis URL
* `RABBITMQ_URL` — RabbitMQ URL
* `JWT_SECRET` — секрет для access token
* `NOTIFIER_QUEUE` — очередь email-задач (обычно `email_tasks`)
* `SMTP_*` — SMTP-параметры для писем сброса пароля
* `FRONTEND_URL` — URL фронтенда
* `VITE_API_URL` — base URL для frontend API client
* `CORS_ORIGINS` — разрешённые origin'ы (JSON array или comma-separated)

---

## Локальный запуск backend (без Docker)

```bash
cd backend
poetry install
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Альтернатива через Taskfile (из корня)

```bash
docker compose up -d postgres
task migrate

task api
```

---

## Локальный запуск frontend

```bash
npm install
npm run dev
```

По умолчанию:

* frontend dev server: [http://localhost:5173](http://localhost:5173)
* убедитесь, что `VITE_API_URL` указывает на backend (обычно `http://localhost:8000`)

### Production build

```bash
npm run build
```

---

## Seed / тестовые данные

Для dev и демонстрации есть идемпотентный seed.

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d postgres
task migrate
task dev-seed
```

SQL-файл:

* `backend/scripts/seed_dev.sql`

### Пароль для всех тестовых пользователей

**123456**

### Тестовые аккаунты

| Роль    | Email                                     |
| ------- | ----------------------------------------- |
| admin   | [admin@test.ru](mailto:admin@test.ru)     |
| teacher | [teacher@test.ru](mailto:teacher@test.ru) |
| student | [user@test.ru](mailto:user@test.ru)       |
| parent  | [parent@test.ru](mailto:parent@test.ru)   |
| pending | [pending@test.ru](mailto:pending@test.ru) |

> Использовать только для dev / demo / test среды.

---

## Тесты

---

## Backend tests

```bash
cd backend
poetry install --with dev
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu_test
pytest -v
```

### Важно

Для backend tests используется **PostgreSQL**, а не SQLite, потому что часть сценариев и типов (в частности UUID / миграции / поведение ORM) может вести себя иначе на SQLite.

### Примеры покрываемых зон

* auth
* admin
* classes
* me
* students
* teacher
* services (`auth`, `schedule`, `journal_dates`, `rate_limit`, `email_queue`)
* relation access
* config / schemas

---

## Frontend tests

Frontend тесты написаны на:

* **Vitest**
* **React Testing Library**
* **MSW**

### Что покрывается

* API-клиент и контракты
* routing
* auth flow
* ключевые страницы:

  * Login
  * Admin Users
  * Admin Schedule
  * Classes
  * Journal
  * Teacher Journal

### Запуск

```bash
npm test
```

или (если в проекте используется отдельный скрипт):

```bash
npx vitest run
```

### Подход

Во frontend используются:

* unit tests для API / utility / contract слоёв
* component/integration-style tests для ключевых страниц
* MSW для контролируемого mock API поведения

---

## Линтинг

```bash
task check
```

Скрипт гоняет **ESLint** (фронт), **flake8** и **bandit** (бэк). Сборку и тесты смотри `npm run build`, `npm run test`, `task test` и раздел **Тесты** ниже.

---

## API Overview

### Auth

* `POST /auth/register`
* `POST /auth/login`
* `POST /auth/refresh`
* `POST /auth/logout`
* `POST /auth/forgot-password`
* `POST /auth/reset-password`
* `GET /auth/me`

### Admin

* `GET /admin/users`
* `POST /admin/users`
* `POST /admin/users/{id}/approve`
* `POST /admin/users/{id}/reject`
* `PATCH /admin/users/{id}/role`
* `GET /admin/school-settings`
* `GET /admin/schedule`
* `POST /admin/schedule/changes`
* `GET /admin/journal`

### Domain

* `GET /classes`
* `GET /classes/{id}`
* `GET /students?search=...`

### Teacher

* `GET /teacher/lessons`
* `GET /teacher/lessons/{id}/students`
* `POST /teacher/lessons/grades`
* `GET /teacher/journal?class_id=&subject_id=`
* `POST /teacher/journal/grade`

### Me (student / parent)

* `GET /me/children`
* `GET /me/schedule`
* `GET /me/homework`
* `GET /me/progress`

### Health

* `GET /health`

OpenAPI:

* [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Auth / Security Notes

### Access token

* short-lived
* хранится только в памяти frontend-приложения
* **не** хранится в `localStorage`

### Refresh token

* хранится в **httpOnly cookie**
* ротируется при использовании
* инвалидируется при смене пароля

### Поведение frontend при 401

* frontend вызывает `POST /auth/refresh`
* затем повторяет запрос
* если refresh неуспешен — пользователь разлогинивается

---

## Короткий demo-сценарий для научрука / проверки

### 1. Войти как admin

* `admin@test.ru / 123456`
* открыть список пользователей
* показать pending user
* показать управление ролями
* открыть расписание
* показать журнал

### 2. Войти как teacher

* `teacher@test.ru / 123456`
* открыть “Сегодня”
* показать список уроков
* открыть урок
* выставить оценки / посещаемость
* добавить тему и домашнее задание
* открыть журнал

### 3. Войти как student

* `user@test.ru / 123456`
* показать расписание
* показать домашнее задание
* показать прогресс

### 4. Войти как parent

* `parent@test.ru / 123456`
* показать выбор ребёнка
* показать расписание / ДЗ / прогресс

---

## Ограничения текущего MVP

* проект ориентирован на **MVP / demo / учебный сценарий**, а не на production-scale эксплуатацию
* часть frontend-структуры развивалась итеративно и может быть не полностью унифицирована по внутренним соглашениям
* backend intentionally сохраняет часть логики в router/service слое без полного repository abstraction
* часть инфраструктурных скриптов и служебных файлов ориентирована на ускорённую разработку и демонстрационный контур
* приоритет проекта — **стабильность демонстрационного сценария**, а не максимальная архитектурная абстракция

---

## Краткая структура проекта

```text
backend/
  app/
    routers/       # API endpoints
    services/      # business / application logic
    models/        # SQLAlchemy models
    schemas/       # Pydantic schemas
    repositories/  # точечный repository для admin schedule сценария
  alembic/         # migrations
  tests/           # backend tests

src/
  features/        # role-based and feature-based frontend pages
  api/             # API client and contracts
  components/      # shared UI / layout
  test/            # frontend test infra
```

---

## Дополнительные материалы

При необходимости можно вынести/оставить отдельные документы:

* `docs/testing-frontend.md` — расширенные заметки по frontend testing
* `docs/user-guide.md` — расширенное пользовательское руководство

---

## License

См. файл `LICENSE`.