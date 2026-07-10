# Деплой ABH Edu

Один путь: Docker Compose + скрипты в `scripts/`.
TLS терминирует внешний reverse proxy или Cloudflare; контейнерный nginx принимает HTTP только на loopback.

---

## Требования к серверу

- Linux x86_64/arm64, минимум 2 CPU / 4 GB RAM / 20 GB диска для базового стека;
- Docker Engine и Compose v2 из [официального репозитория Docker](https://docs.docker.com/engine/install/);
- `git`, `curl`; `flock` (обычно пакет `util-linux`) для защиты deploy/backup/restore от параллельного запуска;
- входящие 80/443 только для внешнего TLS-прокси. При Cloudflare Tunnel входящие порты приложению не нужны.

Проверка: `docker version`, `docker compose version`, `git --version`, `curl --version`.

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

Сайт: значение `FRONTEND_URL` (через ваш TLS-прокси на `NGINX_HOST_PORT`, в production example — `127.0.0.1:80`).

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

По умолчанию — localtunnel. Для Cloudflare quick tunnel:

```bash
TUNNEL_PROVIDER=cloudflared ./scripts/tunnel.sh start
```

Нужен установленный `cloudflared`:

```bash
brew install cloudflared
cloudflared --version
```

Скрипт запускает `cloudflared tunnel --url http://127.0.0.1:80`, прописывает публичный `*.trycloudflare.com` в `FRONTEND_URL` / `CORS_ORIGINS` и пересоздаёт `api`.
Если quick tunnel не стартует, проверьте, нет ли локального `~/.cloudflared/config.yaml`: Cloudflare quick tunnels не используют config-файл.
Quick tunnel предназначен только для локального демо: скрипт откажется менять production `.env`.

Другие альтернативы:

```bash
TUNNEL_PROVIDER=ngrok NGROK_AUTHTOKEN=… ./scripts/tunnel.sh start
```

Скрипт сам прописывает `FRONTEND_URL` / `CORS_ORIGINS` в `.env` и пересоздаёт `api`.

Документация Cloudflare: [quick tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

---

## Cloudflare Tunnel на сервере

Вариант без открытого inbound-порта: контейнерный nginx слушает только loopback, а `cloudflared` публикует HTTPS-хост наружу.

1. В Cloudflare Dashboard откройте `Networking` → `Tunnels` → `Create tunnel`.
2. Установите и запустите `cloudflared` командой из Dashboard на сервере.
3. В Routes добавьте `Published application`:
   - hostname: `edu.example.com`
   - service URL: `http://localhost:80`
4. В `.env` на сервере:

```dotenv
DOMAIN=edu.example.com
NGINX_HOST_PORT=127.0.0.1:80
FRONTEND_URL=https://edu.example.com
CORS_ORIGINS=["https://edu.example.com"]
ENVIRONMENT=production
```

5. Проверьте и поднимите стек:

```bash
./scripts/check-env.sh
./scripts/deploy.sh
```

Cloudflare route должен смотреть на локальный nginx, не на `api:8000`: SPA, `/api/*`, security headers и upload limit находятся на nginx.
Между `cloudflared` и loopback origin используется HTTP; публичное соединение браузера с Cloudflare остаётся HTTPS.

Документация Cloudflare: [create tunnel](https://developers.cloudflare.com/tunnel/setup/) и [published applications](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/).

---

## Обновление

```bash
./scripts/deploy.sh              # из текущего дерева
./scripts/deploy.sh --pull main  # только fast-forward из origin/main, затем деплой
# или
task deploy
```

Скрипт: проверяет `.env` → build → data plane → backup работающего стека → миграции → api/web/notifier/nginx → ждёт readiness.
При dirty tracked worktree `--pull` откажется обновлять код. При неуспешном старте скрипт пытается вернуть предыдущие application images; миграции БД автоматически не откатываются.

**Не** подключайте `docker-compose.override.yml` и **не** запускайте `seed_dev.sql` на production.

---

## Полезные команды

| Команда | Назначение |
|---------|------------|
| `./scripts/status.sh` | `compose ps` + health контейнеров и HTTP probes |
| `./scripts/backup.sh` | Дамп БД + media → `./backups/` |
| `./scripts/restore.sh` | Восстановление пары DB/media + повторный deploy |
| `./scripts/create-admin.sh` | Админ из `ADMIN_*` в `.env` |
| `./scripts/check-env.sh` | Валидация production `.env` |
| `./scripts/gen-secrets.sh` | Заменить слабые/пустые секреты на случайные |
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
- свободная `COMPOSE_SUBNET` (RFC1918 `/24`, не пересекающаяся с другими Docker/VPN-сетями)
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

Прокси должен передавать `X-Forwarded-Proto` / `X-Forwarded-For`. Production refresh-cookie всегда имеет `Secure`; публичный URL обязан быть HTTPS.

---

## Бэкапы

```bash
./scripts/backup.sh
# → backups/db_<name>_<stamp>.sql.gz
# → backups/media_<stamp>.tar.gz
```

Хранятся последние 14 копий каждого типа. Каталог `backups/` в `.gitignore`.  
Файлы создаются с приватными permissions; API кратко приостанавливается, чтобы DB и media соответствовали одной точке. Рекомендуется cron, проверка exit code и вынос копий off-host.

Восстановление **заменяет** текущую БД и media, останавливает writers, проверяет архивы, применяет SQL одной транзакцией и повторно запускает deploy:

```bash
./scripts/restore.sh backups/db_….sql.gz backups/media_….tar.gz
# для проверенного non-interactive запуска:
./scripts/restore.sh --yes backups/db_….sql.gz backups/media_….tar.gz
```

Перед реальным restore сохраните копии off-host. Для регулярной проверки восстанавливайте пару архивов в отдельном Compose project/на отдельном сервере.

---

## Rollback

Если новый код не проходит readiness, `deploy.sh` пытается вернуть предыдущие теги `api`, `web`, `notifier`. Затем обязательно выполните `./scripts/status.sh`.

Изменение схемы нельзя безопасно отменить подстановкой старого image. При несовместимой миграции: остановите writers и восстановите последнюю проверенную пару DB/media через `restore.sh`, затем разверните соответствующий commit. Не выполняйте downgrade Alembic без отдельно проверенной процедуры.

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

---

## Типичные ошибки

- `Pool overlaps with other one`: выберите свободную `COMPOSE_SUBNET` в `.env`.
- `port is already allocated`: измените loopback-часть `NGINX_HOST_PORT`, например `127.0.0.1:8080`.
- `/api/ready` возвращает 503: проверьте `./scripts/status.sh` и `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs api postgres redis rabbitmq`.
- notifier unhealthy: проверьте доступность RabbitMQ и `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs notifier`; SMTP проверяется при фактической отправке.
- `flock unavailable`: установите `util-linux`; без него скрипты предупреждают, но не могут предотвратить параллельные операции.
