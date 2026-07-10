# Деплой ABH Edu

Один путь: Docker Compose + скрипты в `scripts/`.  
TLS обычно терминирует внешний reverse proxy (Caddy / Traefik / nginx / cloud LB) → контейнерный nginx на `:80`.

---

## Первый запуск на сервере

```bash
# 1. Клонировать репозиторий
git clone <repo-url> /opt/abh-edu && cd /opt/abh-edu

# 2. Production .env + секреты
cp .env.production.example .env
./scripts/gen-secrets.sh

# 3. Отредактировать вручную:
#    DOMAIN, FRONTEND_URL=https://…, CORS_ORIGINS, SMTP_*
nano .env

# 4. Проверка и деплой
./scripts/check-env.sh
./scripts/deploy.sh

# 5. Первый администратор
./scripts/create-admin.sh
```

Сайт: значение `FRONTEND_URL` (через ваш TLS-прокси на `NGINX_HOST_PORT`, по умолчанию 80).

---

## Локальный публичный туннель (демо)

Если сервер недоступен, можно поднять стек локально и открыть его наружу одним скриптом:

```bash
# стек уже на http://127.0.0.1:80
task tunnel
task tunnel-status
task tunnel-stop
# или: ./scripts/tunnel.sh start|status|stop
```

По умолчанию — localtunnel. Альтернативы:

```bash
TUNNEL_PROVIDER=cloudflared ./scripts/tunnel.sh start
TUNNEL_PROVIDER=ngrok NGROK_AUTHTOKEN=… ./scripts/tunnel.sh start
```

Скрипт сам прописывает `FRONTEND_URL` / `CORS_ORIGINS` в `.env` и пересоздаёт `api`.

---

## Обновление

```bash
./scripts/deploy.sh              # из текущего дерева
./scripts/deploy.sh --pull main  # git reset --hard origin/main, затем деплой
# или
task deploy
```

Скрипт: проверяет `.env` → build → postgres/redis/rabbitmq → миграции → api/web/notifier/nginx → ждёт `/api/ready`.

**Не** подключайте `docker-compose.override.yml` и **не** запускайте `seed_dev.sql` на production.

---

## Полезные команды

| Команда | Назначение |
|---------|------------|
| `./scripts/status.sh` | `compose ps` + health |
| `./scripts/backup.sh` | Дамп БД + media → `./backups/` |
| `./scripts/create-admin.sh` | Админ из `ADMIN_*` в `.env` |
| `./scripts/check-env.sh` | Валидация production `.env` |
| `./scripts/gen-secrets.sh` | Сгенерировать слабые/пустые секреты |
| `task down-prod` | Остановить prod-стек (тома сохраняются) |

Эквиваленты Task: `task deploy`, `task status`, `task backup`, `task create-admin`.

---

## Что должно быть в `.env`

Шаблон: [`.env.production.example`](../.env.production.example).

Обязательно:

- `ENVIRONMENT=production`
- `JWT_SECRET` ≥ 32 символов (не из example)
- сильные `POSTGRES_PASSWORD` / `RABBITMQ_PASSWORD`
- `DATABASE_URL` с хостом `postgres` (имя сервиса Compose)
- `FRONTEND_URL=https://your.domain`
- `CORS_ORIGINS=["https://your.domain"]`
- реальный SMTP

`./scripts/check-env.sh` и старт API (`validate_production_secrets`) не дадут поднять стек с дефолтами.

---

## TLS (перед nginx)

Контейнерный nginx слушает HTTP. Пример Caddy:

```caddyfile
edu.example.com {
  reverse_proxy 127.0.0.1:80
}
```

Прокси должен передавать `X-Forwarded-Proto` / `X-Forwarded-For` (prod nginx их учитывает; refresh-cookie `Secure` зависит от proto).

---

## Бэкапы

```bash
./scripts/backup.sh
# → backups/db_<name>_<stamp>.sql.gz
# → backups/media_<stamp>.tar.gz
```

Хранятся последние 14 копий каждого типа. Каталог `backups/` в `.gitignore`.  
Рекомендуется cron, например раз в сутки, и вынос копий off-host.

Восстановление БД (осторожно):

```bash
gunzip -c backups/db_….sql.gz | \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

---

## Автообновление (опционально)

```bash
# поправить WorkingDirectory / ExecStart под ваш путь
sudo cp deploy/systemd/abh-edu-auto-update.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now abh-edu-auto-update.timer
```

Таймер раз в ~15 минут вызывает `scripts/auto_update.sh` (fetch + deploy при новых коммитах).

---

## Состав prod-стека

`postgres`, `redis`, `rabbitmq`, `automigrate`, `api`, `web`, `notifier`, `nginx`.

Без профилей `observability` / `elk` / `test`.  
Prod nginx: `deploy/nginx/nginx.prod.conf` (HSTS, real IP, CSP).
