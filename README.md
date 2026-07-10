# ABH Edu

Школьная платформа: пользователи и роли, расписание, уроки, журнал, домашние задания, просмотр для учеников и родителей.

| Слой | Стек |
|------|------|
| Frontend | React 19, TypeScript, Vite 7, React Router, TanStack Query, Tailwind |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic |
| Infra | PostgreSQL, Redis, RabbitMQ, Docker Compose, nginx |
| Email | Notifier (RabbitMQ → SMTP) для сброса пароля |

**Требования:** Node **22.12.0** (см. `.nvmrc`), Docker Compose v2, опционально [Task](https://taskfile.dev) и Poetry 3.12.

---

## Оглавление

1. [Быстрый старт (dev)](#быстрый-старт-dev)
2. [Что где открывать](#что-где-открывать)
3. [Команды Task](#команды-task)
4. [Demo-данные](#demo-данные)
5. [Production / деплой](#production--деплой)
6. [Тесты и проверка](#тесты-и-проверка)
7. [Переменные окружения](#переменные-окружения)
8. [Безопасность](#безопасность)
9. [API (кратко)](#api-кратко)
10. [Observability](#observability)
11. [Структура репозитория](#структура-репозитория)
12. [Документация](#документация)

---

## Быстрый старт (dev)

Один сценарий «с нуля» — полный сброс томов, стек, **деструктивный** seed и миграции:

```bash
cp .env.example .env
task dev
```

Сайт: [http://localhost](http://localhost)  
(порт nginx: `NGINX_HOST_PORT` в `.env`, по умолчанию `80`)

Без Task — минимальный стек (без seed, без ELK/Grafana):

```bash
cp .env.example .env
docker compose up -d --build
```

Compose-файлы:

| Файл | Назначение |
|------|------------|
| `docker-compose.yml` | Базовый стек |
| `docker-compose.override.yml` | Dev: hot-reload, порты на localhost, `frontend-watch` |
| `docker-compose.prod.yml` | Prod-overlay: без override, без demo-seed |

`docker compose up` автоматически подмешивает **override**. В production используйте только `yml` + `prod.yml` (см. [Production](#production)).

---

## Что где открывать

После `task dev` или `docker compose up` с override:

| Что | URL |
|-----|-----|
| Приложение (nginx → web + `/api`) | http://localhost |
| API напрямую + Swagger | http://localhost:8000/docs |
| Vite на хосте (если `npm run dev`) | http://localhost:5173 |
| Prometheus (профиль `observability`) | http://localhost:9090 |
| Grafana (профиль `observability`, anon Admin в override) | http://localhost:3001 |
| Kibana (профиль `elk`) | http://localhost:5601 |

Без override порт `8000` с хоста не проброшен — Swagger недоступен, сайт по-прежнему через nginx на `:80`.

В `ENVIRONMENT=production` Swagger/OpenAPI **отключены**.

---

## Команды Task

| Команда | Что делает |
|---------|------------|
| `task dev` | Сброс томов, build, up (observability + ELK), seed, migrate |
| `task up` | Поднять базовый стек (с override, если есть) |
| `task deploy` / `task up-prod` | Production: `scripts/deploy.sh` |
| `task status` | Health prod-стека |
| `task backup` | Дамп БД + media → `./backups/` |
| `task create-admin` | Админ из `ADMIN_*` в `.env` |
| `task tunnel` | Публичный HTTPS-туннель на локальный `:80` |
| `task tunnel-status` / `task tunnel-stop` | Статус / остановка туннеля |
| `task down-prod` | Остановить prod (тома сохраняются) |
| `task down` | Остановить и удалить тома |
| `task migrate` | Alembic через Docker |
| `task test` | Backend pytest в Docker |
| `task test-frontend` | Vitest + coverage |
| `task check` | ESLint + build + flake8 + bandit |

---

## Demo-данные

Файл: `backend/scripts/seed_dev.sql`.

- Делает **`TRUNCATE … CASCADE`** и заново вставляет demo-данные.
- **Только для локальной разработки / демо. Не запускать на production БД.**

Пароль всех demo-пользователей: **`123456`**

| Роль | Email |
|------|-------|
| admin | `admin@test.ru` |
| teacher | `teacher@test.ru` |
| student | `user@test.ru` |
| parent | `parent@test.ru` |
| pending | `pending@test.ru` |

Перед сменой роли в демо выходите из аккаунта. Лимит login по умолчанию — 5/мин; для частых переключений: `RATE_LIMIT_LOGIN=30/60` в `.env` и перезапуск `api`.

Подробный сценарий показа — в [`docs/user-guide.md`](docs/user-guide.md).

---

## Production / деплой

Полная инструкция: [`docs/deploy.md`](docs/deploy.md).

Кратко на сервере:

```bash
cp .env.production.example .env
./scripts/gen-secrets.sh
# отредактируйте FRONTEND_URL, CORS_ORIGINS, SMTP_*
./scripts/check-env.sh
./scripts/deploy.sh
./scripts/create-admin.sh
```

Обновление: `./scripts/deploy.sh` или `./scripts/deploy.sh --pull main`.

- Без `docker-compose.override.yml` и без seed.
- TLS — на reverse proxy перед nginx (`NGINX_HOST_PORT`, по умолчанию 80).
- Бэкапы: `./scripts/backup.sh` → `./backups/`.

Шаблон env: [`.env.production.example`](.env.production.example).  
API не стартует с дефолтными секретами при `ENVIRONMENT=production`.

---

## Тесты и проверка

```bash
task check          # lint + build фронта, flake8/bandit бэка
task test           # backend в Docker
task test-frontend  # frontend coverage
```

Backend без Docker (нужна PostgreSQL и тестовая БД):

```bash
cd backend
poetry install --with dev
export DATABASE_URL=postgresql+psycopg2://USER:PASS@localhost:5432/abh_edu_test
export RATE_LIMIT_FAIL_CLOSED=false
poetry run alembic upgrade head
poetry run pytest -v
```

Frontend:

```bash
npm ci
npm run test:coverage   # или: npm test
```

Node для локальной разработки: `nvm use` (версия из `.nvmrc`).

---

## Переменные окружения

```bash
cp .env.example .env
```

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL (в Docker хост — `postgres`) |
| `REDIS_URL` / `RABBITMQ_URL` | Кэш / очередь |
| `JWT_SECRET` | Подпись JWT и media URL |
| `ENVIRONMENT` | `development` \| `staging` \| `production` |
| `FRONTEND_URL` | Публичный URL сайта (ссылки в письмах) |
| `CORS_ORIGINS` | JSON-массив origin’ов |
| `SMTP_*` | Почта для сброса пароля |
| `VITE_API_URL` | Обычно не задавать (`/api` + proxy Vite); в Docker-сборке уже `/api` |
| `NGINX_HOST_PORT` | Порт nginx на хосте (по умолчанию 80) |

`FRONTEND_URL` — то, что открывает пользователь в браузере (`http://localhost` или `https://…`), **не** имя Docker-сервиса.

---

## Безопасность

| Тема | Как устроено |
|------|----------------|
| Access token | Короткоживущий, только в памяти фронта |
| Refresh token | httpOnly cookie, ротация; **не** выдаётся при регистрации `pending` |
| Медиа | `GET /api/media/...` только с HMAC (`exp` + `sig`) в `avatar_url` |
| Пароли | Минимум 8 символов (регистрация / сброс / смена) |
| Prod-секреты | При `ENVIRONMENT=production` API не стартует с дефолтными секретами |
| Docs | `/docs` и OpenAPI выключены в production |

При 401 фронт вызывает `POST /api/auth/refresh` и повторяет запрос; при неудаче — logout.

---

## API (кратко)

Все прикладные роуты — под префиксом **`/api`**. Nginx проксирует `/api/` на backend без обрезки пути.  
Swagger: `http://localhost:8000/docs` (только прямой доступ к `api`, не через nginx `:80`).

| Группа | Примеры |
|--------|---------|
| Auth | `POST /api/auth/login`, `/register`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `GET /api/auth/me` |
| Admin | `/api/admin/users`, `/schedule`, `/journal`, school-settings |
| Teacher | `/api/teacher/lessons`, `/journal` |
| Me | `/api/me/schedule`, `/homework`, `/progress`, `/children` |
| Health | `GET /api/health`, `GET /api/ready` (Postgres + Redis + RabbitMQ) |
| Metrics | `GET /metrics` (не под `/api`; в `test` — 404) |

Полный список — в OpenAPI (`/docs`) в development.

---

## Observability

Опциональные профили Compose (не входят в минимальный `docker compose up`):

| Профиль | Сервисы |
|---------|---------|
| `observability` | Prometheus, Grafana |
| `elk` | Elasticsearch, Logstash, Kibana, vector-logs (~4 GB+ RAM) |

```bash
# Метрики
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  --profile observability up -d postgres redis rabbitmq api prometheus grafana

# Логи (ELK)
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  --profile elk up -d elasticsearch logstash kibana vector-logs api
```

`task dev` поднимает оба профиля. В production Grafana без анонимного входа; порты метрик на хост в prod-overlay не пробрасываются.

---

## Структура репозитория

```text
backend/app/          # routers, services, models, schemas
backend/alembic/      # миграции
backend/tests/        # pytest
backend/scripts/      # seed_dev.sql, утилиты
src/features/         # UI по ролям
src/api/              # HTTP-клиент и контракты
src/components/       # общий UI / layout
deploy/               # prometheus, grafana, logstash, vector
docs/                 # user-guide и индекс
```

Локальный backend без Docker:

```bash
cd backend && poetry install
export DATABASE_URL=postgresql+psycopg2://...@localhost:5432/abh_edu
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --port 8000
```

Локальный frontend:

```bash
nvm use && npm ci && npm run dev
```

---

## Документация

| Файл | Содержание |
|------|------------|
| [`docs/deploy.md`](docs/deploy.md) | Деплой, TLS, бэкапы, автообновление |
| [`docs/user-guide.md`](docs/user-guide.md) | Руководство для ролей |
| [`docs/README.md`](docs/README.md) | Индекс `docs/` |
| `.env.example` | Dev-переменные |
| `.env.production.example` | Production-переменные |

---

## License

См. [`LICENSE`](LICENSE).
