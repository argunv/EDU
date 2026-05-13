# ABH Edu

Full-stack MVP школьной платформы. Покрывает управление пользователями и ролями, расписание, уроки, журнал, домашние задания и просмотр данных учениками и родителями.

---

## Что реализовано

**Auth и роли**
- Регистрация с начальной ролью `pending`, вход / выход
- Refresh token в httpOnly cookie, access token только в памяти
- Одобрение / отклонение заявок администратором, назначение ролей (`admin`, `teacher`, `student`, `parent`)
- Сброс пароля через RabbitMQ + email (notifier)

**Администратор**
- Управление пользователями: одобрение, отклонение, назначение ролей
- Настройка расписания: класс → смена → день → слоты уроков
- Просмотр журнала

**Учитель**
- Уроки по дням (создаются из расписания автоматически при открытии дня)
- Тема урока, домашнее задание, посещаемость, оценки
- Журнал по классу и предмету

**Ученик / Родитель**
- Расписание, домашние задания, прогресс по предметам
- Родитель выбирает ребёнка, после чего данные переключаются на него

---

## Стек

**Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS  
**Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic  
**Infra:** PostgreSQL, Redis, RabbitMQ, Docker Compose, nginx

---

## Состав сервисов

| Сервис | Роль |
|---|---|
| `postgres` | Основная БД |
| `redis` | Rate limiting |
| `rabbitmq` | Очередь задач для email notifier |
| `api` | FastAPI приложение |
| `notifier` | Воркер, читает задачи из очереди и отправляет письма через SMTP |
| `automigrate` | Одноразовый контейнер, запускает `alembic upgrade head` при старте стека |
| `web` | nginx, раздаёт собранный фронт |
| `nginx` | Точка входа: `/api/*` → api, `/*` → web |

---

## Быстрый старт

Отредактируйте .env

```bash
cp .env.example .env
docker compose up -d --build
```

или используйте [утилиту task](https://taskfile.dev/).

```bash
cp .env.example .env
task dev
```

После запуска:
- Приложение: `http://localhost`
- API напрямую (dev): `http://localhost:8000`
- OpenAPI docs (dev): `http://localhost:8000/docs`

Миграции применяются автоматически через сервис `automigrate`.

### Dev-режим с hot reload

`docker-compose.override.yml` подхватывается Docker Compose автоматически. В dev-режиме:

- `backend/` монтируется в контейнер `api`, включён `uvicorn --reload`
- `frontend-watch` пересобирает `dist/` при изменениях в `src/`
- Порты 5432, 6379, 5672, 8000 пробрасываются на localhost (только 127.0.0.1)

После правок в notifier нужно перезапустить вручную:

```bash
docker compose restart notifier
```

---

## Локальный запуск backend (без Docker)

Требуется запущенный PostgreSQL (можно через `docker compose up -d postgres`).

```bash
cd backend
poetry install
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/abh_edu
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

---

## Локальный запуск frontend

```bash
npm install
npm run dev
```

Frontend dev server: `http://localhost:5173`  
Vite проксирует `/api` на `http://localhost:8000`. `VITE_API_URL` для dev не нужен.

---

## Переменные окружения

Скопируйте `.env.example` в `.env`. Значения, которые обязательно нужно проверить:

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://user:pass@host:5432/db` |
| `REDIS_URL` | `redis://host:6379/0` |
| `RABBITMQ_URL`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | RabbitMQ (должны совпадать) |
| `JWT_SECRET` | Секрет для подписи токенов |
| `FRONTEND_URL` | Публичный URL фронта в браузере — используется в ссылках письма сброса пароля |
| `CORS_ORIGINS` | JSON array разрешённых origins |
| `SMTP_*` | SMTP для отправки писем (опционально; без них сброс пароля не отправляет письма) |

`FRONTEND_URL` должен быть реальным browser URL — не именем Docker-сервиса. В dev: `http://localhost`. API не запустится, если передать имя вроде `web` или `nginx`.

---

## Seed / тестовые данные

Для demo и проверки есть идемпотентный SQL-seed (`backend/scripts/seed_dev.sql`).

Полный сброс + подъём стека + seed:

```bash
task dev
```

Команда: `down -v` → сборка → запуск сервисов → миграции до 007 → seed → миграции до head.  
Такой порядок нужен, потому что миграция 008 (backfill) читает данные, которые seed заполняет.

**Тестовые аккаунты** (пароль для всех: `123456`):

---

## Тесты

### Backend

Backend тесты используют PostgreSQL (не SQLite). Запуск через Docker:

```bash
task test
```

Строит тестовый образ, поднимает postgres, создаёт тестовую БД `abh_edu_test`, прогоняет миграции, запускает pytest с coverage (порог 80%).

Покрытие: auth, admin, classes, me, students, teacher, schedule, journal, rate limit, email queue.

### Frontend

```bash
npm test
```

Vitest + React Testing Library + MSW.  
Покрывает: API-клиент, routing, auth flow, ключевые страницы (Login, Admin Users, Admin Schedule, Classes, Journal).

### Линтинг

```bash
task check
```

Запускает ESLint (frontend), flake8 и bandit (backend).

---

## API Overview

Все маршруты имеют префикс `/api`. Полная документация: `http://localhost:8000/docs`.

**Auth**
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

**Admin**
```
GET    /api/admin/users
POST   /api/admin/users
POST   /api/admin/users/{id}/approve
POST   /api/admin/users/{id}/reject
PATCH  /api/admin/users/{id}/role
GET    /api/admin/school-settings
GET    /api/admin/schedule
POST   /api/admin/schedule/changes
GET    /api/admin/journal
```

**Classes / Students**
```
GET /api/classes
GET /api/classes/{id}
GET /api/students
```

**Teacher**
```
GET  /api/teacher/lessons
GET  /api/teacher/lessons/{id}/students
POST /api/teacher/lessons/grades
GET  /api/teacher/journal
POST /api/teacher/journal/grade
```

**Me (student / parent)**
```
GET /api/me/children
GET /api/me/schedule
GET /api/me/homework
GET /api/me/progress
```

**Health**
```
GET /api/health
GET /api/ready
```


## Observability

Минимальный observability-слой для backend FastAPI:

* `GET /metrics` — Prometheus metrics в корне API (не под `/api`)
* `GET /api/health` — liveness (как и раньше)
* `GET /api/ready` — readiness с проверкой PostgreSQL через `SELECT 1`

Сервисы в Docker Compose:

* Prometheus scrape-ит `api:8000/metrics` внутри docker network
* Grafana доступна локально в dev на [http://localhost:3001](http://localhost:3001)
* Prometheus доступен локально в dev на [http://localhost:9090](http://localhost:9090)

Dev-учётка Grafana задаётся через `.env`:

* `GF_SECURITY_ADMIN_USER` (по умолчанию `admin`)
* `GF_SECURITY_ADMIN_PASSWORD` (по умолчанию `admin`)

Быстрая проверка:

```bash
docker compose up -d --build api prometheus grafana
curl -fsS http://localhost:8000/api/health
curl -fsS http://localhost:8000/api/ready
curl -fsS http://localhost:8000/metrics | sed -n '1,20p'
curl -fsS http://localhost:9090/-/ready
```
---

## Сброс пароля

Флоу: пользователь запрашивает письмо → API помещает задачу в RabbitMQ → notifier берёт задачу и отправляет письмо через SMTP. Ссылка в письме строится на основе `FRONTEND_URL`. Если SMTP не настроен, задача кладётся в очередь, но письмо не уходит — остальной стек при этом работает нормально.

---

## Ограничения MVP

- Проект рассчитан на demo / учебный сценарий, не на production-нагрузку
- Frontend структура развивалась итеративно, не везде унифицирована
- Часть логики осознанно оставлена в router/service слое без полного repository abstraction
- Приоритет — стабильность demo-сценария

---

## Полезные команды

```bash
task dev          # полный сброс + запуск стека + seed
task up           # запустить стек без пересборки
task down         # остановить и удалить volumes
task migrate      # применить миграции через Docker
task test         # backend тесты в Docker
task check        # ESLint + flake8 + bandit
task create-admin # создать admin из переменных ADMIN_* в .env
```

---

## License

Copyright © 2026 Vladislav Argun. All rights reserved. See `LICENSE`.
