#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-dev}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[deploy] branch=$BRANCH root=$ROOT"
git fetch origin
if ! git rev-parse -q --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout -b "$BRANCH" "origin/$BRANCH"
else
  git checkout "$BRANCH"
fi
git reset --hard "origin/$BRANCH"
echo "[deploy] commit=$(git rev-parse --short HEAD)"

# Только основной compose — без override (dev-режим с frontend-watch и --reload не для prod).
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d --remove-orphans
# Перезапуск nginx, чтобы подхватить обновлённый nginx.conf после git pull.
docker compose -f docker-compose.yml restart nginx
# Проверка: API должен отвечать (иначе 502 на /api/*). В .env на сервере DATABASE_URL — с хостом postgres, не localhost.
# Даём до ~60 секунд на старт api (30 попыток по 2 секунды).
for i in $(seq 1 30); do
  if docker compose -f docker-compose.yml exec -T api python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=3)" 2>/dev/null; then
    echo "[deploy] api health OK"
    break
  fi
  if [ "$i" -eq 30 ]; then echo "[deploy] WARNING: api /api/health не отвечает — смотрите: docker compose -f docker-compose.yml logs api"; fi
  sleep 2
done
echo "[deploy] done"
