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

### Версии для локальной разработки

- **Node.js** для фронта: минимальная версия задаётся в **`package.json` → `engines.node`** и в **`.nvmrc`** (сейчас **22.12.0** — её же использует стадия сборки `web` в `Dockerfile` и job’ы Node в CI через `node-version-file`). При [nvm](https://github.com/nvm-sh/nvm) из корня: `nvm install` и `nvm use`.
- **Vite 7** при `npm run dev` / `npm run build` предупреждает, если Node ниже порога: нужен **20.19+** или **22.12+** (на ветке 22 недостаточно «любого» 22.x: например **22.11.x** уже вызывает предупреждение, хотя сборка может завершиться успешно). Чтобы убрать предупреждение и совпасть с CI/Docker, держите ровно версию из `.nvmrc` или новее в рамках поддерживаемой линии.
- **Python** 3.12 и Poetry — для backend без Docker (см. `backend/pyproject.toml`). Корневой **`pyrightconfig.json`** направляет Pyright на каталог `backend/` и локальный venv `backend/.venv` (в репозиторий секреты не кладутся).
- **Docker** с Compose Plugin v2 — для PostgreSQL, API, nginx и остального стека.
- Опционально **[Task](https://taskfile.dev)** — команды `task dev`, `task migrate`, `task check` и др. читают корневой `Taskfile.yml` и при необходимости `.env`.

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

### 1. Переменные окружения

```bash
cp .env.example .env
```

При необходимости отредактируйте `.env` (секреты, URL, SMTP). Для первого запуска достаточно значений из `.env.example`.

### 2. Запуск через Docker Compose

```bash
docker compose up -d --build
```

Поднимаются (без профиля `elk` / `test`): PostgreSQL, Redis, RabbitMQ, **api**, **web** (статика фронта), **notifier**, **automigrate**, **nginx**, а также **Prometheus** и **Grafana** (см. `docker-compose.yml`).

### После запуска

Сервис **api** в базовом `docker-compose.yml` слушает порт **8000 только внутри** сети Compose; с хоста API и Swagger удобнее открывать так:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

Тогда:

* API и OpenAPI: [http://localhost:8000](http://localhost:8000) и [http://localhost:8000/docs](http://localhost:8000/docs)
* Сайт (статика фронта через nginx): [http://localhost](http://localhost) (порт задаётся `NGINX_HOST_PORT` в `.env`, по умолчанию 80)
* Локальный Vite (если запускаете фронт на хосте): [http://localhost:5173](http://localhost:5173)

Без `docker-compose.override.yml` документация по API из браузера на хосте недоступна, пока вы сами не пробросите порт сервиса `api`.

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

* либо пересобирать образ `web` при изменениях;
* либо в dev использовать сервис **`frontend-watch`** из override (пересборка `dist` в томе) и volume у **`web`**;
* либо запускать Vite на хосте (нужен Node из `.nvmrc`):

```bash
npm ci
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
* `SMTP_*` — параметры SMTP для писем сброса пароля; в `docker-compose.yml` для сервиса **notifier** они обязательны и должны быть **непустыми** (в `.env.example` заданы безопасные заглушки — без реального SMTP письма не уйдут)
* `FRONTEND_URL` — URL фронтенда
* `VITE_API_URL` — base URL для HTTP-клиента фронта (часто не задают: тогда используется `/api`; при полном URL к API указывайте суффикс `/api`, например `http://localhost:8000/api`)
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

### Taskfile (из корня)

Полный сброс и подъём dev-стека (БД, API, nginx, Prometheus, Grafana, ELK, seed, миграции) — команда **`task dev`** (см. описание в `Taskfile.yml`; первый холодный старт ELK может занять несколько минут).

Точечные шаги без полного `task dev`:

```bash
docker compose up -d postgres
task migrate
docker compose up -d api web nginx redis rabbitmq notifier
```

Имени задачи `task api` в репозитории нет — поднимайте сервисы через `docker compose up` (см. список сервисов в `docker-compose.yml`).

---

## Локальный запуск frontend

Из корня репозитория (после `nvm use` по `.nvmrc` или другой Node **20.19+** / **22.12+**, см. раздел «Версии» выше):

```bash
npm ci
npm run dev
```

По умолчанию:

* frontend dev server: [http://localhost:5173](http://localhost:5173)
* базовый URL API в коде: `import.meta.env.VITE_API_URL ?? '/api'` (см. `src/api/client.ts`). Для `npm run dev` чаще всего **ничего не задавайте** — запросы идут на тот же origin с префиксом `/api` (proxy в `vite.config.ts`). Если задаёте полный URL на контейнер/хост API, укажите **с префиксом `/api`**, например `http://localhost:8000/api`.

### Production build

```bash
npm run build
```

---

## Seed / тестовые данные

Для dev и демонстрации есть идемпотентный seed (`backend/scripts/seed_dev.sql`). Удобный полный сценарий с правильным порядком миграций и seed — **`task dev`**. Вручную (значения `POSTGRES_USER` / `POSTGRES_DB` должны совпадать с `.env`):

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d postgres
task migrate
docker compose -f docker-compose.yml -f docker-compose.override.yml exec -T postgres \
  psql -U postgres -d abh_edu < backend/scripts/seed_dev.sql
```

Если в `.env` заданы другие `POSTGRES_USER` или `POSTGRES_DB`, подставьте их вместо `postgres` / `abh_edu`.

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

**Legacy-аккаунты** (тоже в seed, пароль `123456`): `admin@abh-edu.local`, `t.rus.1@school.abh`, `t.lit.1@school.abh`, `s.5a.01.c1@school.abh`, `parent01@school.abh`.

**Pending:** `pending@test.ru` виден администратору в списке заявок без входа под этим пользователем. Прямой вход через `/auth/login` вернёт сообщение «Учётная запись ожидает одобрения»; экран `/pending` доступен после регистрации с этим email.

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
npm run test:coverage
```

(то же, что job **frontend-tests** в CI и команда **`task test-frontend`**.)

Альтернатива без отчёта по покрытию:

```bash
npm test
```

или:

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

Задача **`check`** повторяет основную часть CI по фронту и линтам бэка: **ESLint**, production **сборка Vite** (`npm run build`), **flake8** и **bandit**. Отдельно в CI гоняются backend **pytest** (нужна PostgreSQL и `DATABASE_URL`) и frontend **Vitest**; локально для паритета с CI используйте `task test` (Docker) и **`task test-frontend`**.

---

## API Overview

Префикс приложения **`/api`**: все роутеры подключаются с `prefix="/api"` (см. `backend/app/main.py`). Запросы через корневой nginx (`nginx.conf`) на `http://localhost/api/...` уходят на бэкенд **с тем же путём** (`proxy_pass` без обрезки префикса). Документация OpenAPI и Swagger UI у FastAPI остаются на **корне приложения** (`/docs`, `/openapi.json`), они **не** под `/api` и через публичный nginx на порт 80 **не** проксируются на API (только на прямой доступ к сервису `api`, например `http://localhost:8000/docs` с `docker-compose.override.yml`).

В **`ENVIRONMENT=test`** (pytest) те же маршруты дополнительно дублируются **без** префикса `/api` для совместимости со старыми тестами.

### Auth

* `POST /api/auth/register`
* `POST /api/auth/login`
* `POST /api/auth/refresh`
* `POST /api/auth/logout`
* `POST /api/auth/forgot-password`
* `POST /api/auth/reset-password`
* `GET /api/auth/me`

### Admin

* `GET /api/admin/users`
* `POST /api/admin/users/{id}/approve`
* `POST /api/admin/users/{id}/reject`
* `PATCH /api/admin/users/{id}/role`
* `GET /api/admin/school-settings`
* `GET /api/admin/schedule`
* `POST /api/admin/schedule/changes`
* `GET /api/admin/journal`

### Domain

* `GET /api/classes`
* `GET /api/classes/{id}`
* `GET /api/students?search=...`

### Teacher

* `GET /api/teacher/lessons`
* `GET /api/teacher/lessons/{id}/students`
* `POST /api/teacher/lessons/grades`
* `GET /api/teacher/journal?class_id=&subject_id=`
* `POST /api/teacher/journal/grade`

### Me (student / parent)

* `GET /api/me/children`
* `GET /api/me/schedule`
* `GET /api/me/homework`
* `GET /api/me/progress`

### Health

* `GET /api/health`
* `GET /api/ready`

## Observability

Минимальный observability-слой для backend FastAPI:

* `GET /metrics` — Prometheus metrics в корне API (не под `/api`), только при **`ENVIRONMENT`** после нормализации (`strip` + lower) равном `development`, `staging` или `production` (см. `Settings.expose_prometheus_metrics` в `app/core/config.py`). В `test` и остальных значениях — **404** (в т.ч. в pytest).
* `GET /api/health` — liveness
* `GET /api/ready` — readiness с проверкой PostgreSQL через `SELECT 1`

Сервисы в Docker Compose:

* Prometheus scrape-ит `api:8000/metrics` внутри docker network; данные TSDB в томе `prometheus_data`.
* Grafana доступна локально в dev на [http://localhost:3001](http://localhost:3001) с **анонимным входом** (роль Admin, только в `docker-compose.override.yml`, без дефолтного `admin`/`admin` в compose).
* Prometheus доступен локально в dev на [http://localhost:9090](http://localhost:9090)

Быстрая проверка (из корня репозитория; нужен `docker-compose.override.yml`, чтобы API был на `localhost:8000`):

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build postgres redis rabbitmq api prometheus grafana
curl -fsS http://localhost:8000/api/health
curl -fsS http://localhost:8000/api/ready
curl -fsS http://localhost:8000/metrics | sed -n '1,20p'
curl -fsS http://localhost:9090/-/ready
```

### ELK stack (опционально)

Профиль Compose `elk` поднимает **Elasticsearch**, **Logstash**, **Kibana** и коллектор **vector-logs** (читает логи контейнеров через Docker API и отправляет JSON в Logstash по TCP — так стек работает и на macOS, и на Linux, без монтирования `/var/lib/docker/containers` с хоста).

Безопасность Elasticsearch **отключена** (только для локальной разработки).

Рекомендуется выделить Docker Desktop / Orbstack **не меньше ~4 GB RAM** под JVM Elasticsearch/Logstash.

Подъём вместе с API (чтобы в Kibana пошли логи `api` и остальных сервисов):

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml --profile elk up -d elasticsearch logstash kibana vector-logs api
```

Команда **`task dev`** из корня уже использует `--profile elk` и поднимает весь стек (включая Prometheus, Grafana и ELK), дожидается `healthy` через `docker compose up --wait` (таймаут 10 минут на первый холодный старт), затем выполняет seed и миграции.

Порты на хосте (см. `docker-compose.override.yml`):

* Elasticsearch: [http://localhost:9200](http://localhost:9200)
* Kibana: [http://localhost:5601](http://localhost:5601)
* Logstash monitoring API: [http://localhost:9600](http://localhost:9600)

В Kibana создайте **Data view** с шаблоном `docker-logs-*` (индексы вида `docker-logs-YYYY.MM.dd` пишет Logstash). Через минуту-две после трафика по API в **Discover** должны появиться события.

OpenAPI / Swagger (только прямой доступ к процессу API, не через nginx на `:80`):

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

* frontend вызывает `POST /api/auth/refresh` (через `baseURL` из `VITE_API_URL` или `/api`)
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

* `docs/user-guide.md` — пользовательское руководство (роли, сценарии, демо-логины)
* расширенные заметки по frontend testing при необходимости можно добавить отдельным файлом в `docs/`

---

## License

См. файл `LICENSE`.