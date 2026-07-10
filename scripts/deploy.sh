#!/usr/bin/env bash
# Deploy / update production stack (no override, no demo seed).
#
# Usage:
#   ./scripts/deploy.sh              # build + up from current tree
#   ./scripts/deploy.sh --pull main  # git fetch/reset to origin/main, then deploy
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"

PULL=0
BRANCH="main"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pull)
      PULL=1
      if [[ $# -ge 2 && "$2" != -* ]]; then
        BRANCH="$2"
        shift 2
      else
        shift 1
      fi
      ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

require_env_file
"$ROOT/scripts/check-env.sh"

if [[ "$PULL" -eq 1 ]]; then
  echo "[deploy] syncing git → origin/$BRANCH"
  git fetch origin
  if ! git rev-parse -q --verify "$BRANCH" >/dev/null 2>&1; then
    git checkout -b "$BRANCH" "origin/$BRANCH"
  else
    git checkout "$BRANCH"
  fi
  git reset --hard "origin/$BRANCH"
  echo "[deploy] commit=$(git rev-parse --short HEAD)"
fi

# Never pick up docker-compose.override.yml
unset COMPOSE_FILE COMPOSE_PROFILES || true

load_dotenv

echo "[deploy] building…"
compose build

echo "[deploy] starting data plane…"
compose up -d --remove-orphans postgres redis rabbitmq

echo "[deploy] waiting for postgres…"
for i in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[deploy] migrations…"
compose run --rm automigrate

echo "[deploy] starting app…"
compose up -d --remove-orphans api web notifier nginx

echo "[deploy] waiting for /api/ready…"
ok=0
for i in $(seq 1 45); do
  if compose exec -T api python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/ready', timeout=3)" \
    2>/dev/null; then
    echo "[deploy] api /api/ready OK"
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "[deploy] ERROR: api not ready — logs:" >&2
  compose logs --tail=80 api
  exit 1
fi

PORT="${NGINX_HOST_PORT:-80}"
if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "[deploy] nginx /api/health OK (port ${PORT})"
else
  echo "[deploy] WARN: nginx health check failed on :${PORT} (proxy/firewall?)"
fi

echo "[deploy] done"
echo "  Next: ./scripts/create-admin.sh"
echo "        ./scripts/backup.sh"
echo "        ./scripts/status.sh"
