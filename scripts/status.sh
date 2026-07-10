#!/usr/bin/env bash
# Show production compose status + quick health probes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"

require_env_file
unset COMPOSE_FILE COMPOSE_PROFILES || true
load_dotenv

echo "=== compose ps ==="
compose ps

echo
echo "=== health ==="
if compose exec -T api python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).read().decode())" \
  2>/dev/null; then
  :
else
  echo "api /api/health: FAIL"
fi

if compose exec -T api python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/ready', timeout=5).read().decode())" \
  2>/dev/null; then
  :
else
  echo "api /api/ready: FAIL"
fi

PORT="${NGINX_HOST_PORT:-80}"
echo
echo "=== nginx :${PORT} ==="
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:${PORT}/api/health" || echo "nginx probe failed"
