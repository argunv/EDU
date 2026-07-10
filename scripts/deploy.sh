#!/usr/bin/env bash
# Deploy / update production stack (no override, no demo seed).
#
# Usage:
#   ./scripts/deploy.sh              # build + up from current tree
#   ./scripts/deploy.sh --pull main  # fast-forward from origin/main, then deploy
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"
acquire_operation_lock

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

if [[ "$PULL" -eq 1 ]]; then
  echo "[deploy] fetching origin/$BRANCH"
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    echo "[deploy] ERROR: tracked files have local changes; refusing to update" >&2
    exit 1
  fi
  git fetch origin "$BRANCH"
  current_branch="$(git branch --show-current)"
  if [[ "$current_branch" != "$BRANCH" ]]; then
    echo "[deploy] ERROR: current branch is '$current_branch', expected '$BRANCH'" >&2
    exit 1
  fi
  if ! git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
    echo "[deploy] ERROR: local branch diverged from origin/$BRANCH; update manually" >&2
    exit 1
  fi
  git merge --ff-only "origin/$BRANCH"
  echo "[deploy] commit=$(git rev-parse --short HEAD)"
fi

"$ROOT/scripts/check-env.sh"

# Never pick up docker-compose.override.yml
unset COMPOSE_FILE COMPOSE_PROFILES || true

load_dotenv

old_api_image="$(compose images -q api 2>/dev/null | awk 'NR==1 {print; exit}')"
old_web_image="$(compose images -q web 2>/dev/null | awk 'NR==1 {print; exit}')"
old_notifier_image="$(compose images -q notifier 2>/dev/null | awk 'NR==1 {print; exit}')"
app_update_started=0

restore_image_tag() {
  local image_id="$1"
  local service="$2"
  [[ -n "$image_id" ]] || return 0
  local current_id current_tag
  current_id="$(compose images -q "$service" 2>/dev/null | awk 'NR==1 {print; exit}')"
  [[ -n "$current_id" ]] || return 0
  current_tag="$(docker image inspect --format '{{index .RepoTags 0}}' "$current_id" 2>/dev/null || true)"
  [[ -n "$current_tag" && "$current_tag" != "<none>:<none>" ]] || return 0
  docker image tag "$image_id" "$current_tag"
}

rollback_app_images() {
  local exit_code=$?
  if [[ "$exit_code" -eq 0 || "$app_update_started" -ne 1 ]]; then
    return "$exit_code"
  fi
  trap - ERR
  set +e
  echo "[deploy] ERROR: deployment failed; restoring previous application images" >&2
  restore_image_tag "$old_api_image" api
  restore_image_tag "$old_web_image" web
  restore_image_tag "$old_notifier_image" notifier
  compose up -d --no-build --remove-orphans api web notifier nginx
  echo "[deploy] rollback attempted; verify ./scripts/status.sh" >&2
  return "$exit_code"
}
trap rollback_app_images ERR

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

if [[ -n "$old_api_image" && -n "$(compose ps --status running -q api)" ]]; then
  echo "[deploy] pre-deploy backup…"
  "$ROOT/scripts/backup.sh"
fi

echo "[deploy] migrations…"
compose run --rm automigrate

echo "[deploy] starting app…"
app_update_started=1
compose up -d --remove-orphans api web notifier

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

echo "[deploy] waiting for web…"
ok=0
for i in $(seq 1 30); do
  if compose exec -T web wget -q --spider http://127.0.0.1/ 2>/dev/null; then
    echo "[deploy] web OK"
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "[deploy] ERROR: web not ready — logs:" >&2
  compose logs --tail=80 web
  exit 1
fi

compose up -d --remove-orphans nginx

NGINX_HEALTH_URL="$(nginx_health_url)"
if curl -fsS "$NGINX_HEALTH_URL" >/dev/null 2>&1; then
  echo "[deploy] nginx /api/health OK (${NGINX_HEALTH_URL})"
else
  echo "[deploy] ERROR: nginx health check failed (${NGINX_HEALTH_URL})" >&2
  compose logs --tail=80 nginx web api >&2
  exit 1
fi

echo "[deploy] done"
trap - ERR
echo "  Next: ./scripts/create-admin.sh"
echo "        ./scripts/backup.sh"
echo "        ./scripts/status.sh"
