#!/usr/bin/env bash
# Show production compose status + quick health probes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"

require_env_file
unset COMPOSE_FILE COMPOSE_PROFILES || true
load_dotenv
failed=0

echo "=== compose ps ==="
compose ps

for service in postgres redis rabbitmq api web notifier nginx; do
  container_id="$(compose ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    echo "$service container: MISSING"
    failed=1
    continue
  fi
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
  if [[ "$health" != "healthy" ]]; then
    echo "$service container health: ${health:-UNKNOWN}"
    failed=1
  fi
done

echo
echo "=== health ==="
if compose exec -T api python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).read().decode())" \
  2>/dev/null; then
  :
else
  echo "api /api/health: FAIL"
  failed=1
fi

if compose exec -T api python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/ready', timeout=5).read().decode())" \
  2>/dev/null; then
  :
else
  echo "api /api/ready: FAIL"
  failed=1
fi

NGINX_HEALTH_URL="$(nginx_health_url)"
echo
echo "=== nginx ${NGINX_HEALTH_URL} ==="
if ! curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "$NGINX_HEALTH_URL"; then
  echo "nginx probe failed"
  failed=1
fi

exit "$failed"
