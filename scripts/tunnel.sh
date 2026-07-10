#!/usr/bin/env bash
# Public tunnel for local Docker stack (port 80).
#
# Usage:
#   ./scripts/tunnel.sh start
#   ./scripts/tunnel.sh stop
#   ./scripts/tunnel.sh status
#   ./scripts/tunnel.sh url
#
# Optional:
#   TUNNEL_PROVIDER=localtunnel|cloudflared|ngrok
#   NGROK_AUTHTOKEN=...
#
set +H
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STATE_DIR="${TMPDIR:-/tmp}/edu-tunnel"
PID_FILE="$STATE_DIR/supervisor.pid"
CHILD_PID_FILE="$STATE_DIR/child.pid"
LOG_FILE="$STATE_DIR/tunnel.log"
SUP_LOG="$STATE_DIR/supervisor.log"
URL_FILE="$STATE_DIR/url.txt"
PROVIDER="${TUNNEL_PROVIDER:-localtunnel}"

mkdir -p "$STATE_DIR"

compose_dev() {
  docker compose -f docker-compose.yml -f docker-compose.override.yml "$@"
}

is_pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

is_running() {
  is_pid_alive "$(cat "$PID_FILE" 2>/dev/null || true)"
}

read_url() {
  [[ -f "$URL_FILE" ]] && tr -d '[:space:]' < "$URL_FILE"
}

patch_env() {
  local pub="$1"
  python3 - "$pub" "$ROOT/.env" <<'PY'
import re
import sys
from pathlib import Path

pub = sys.argv[1]
env = Path(sys.argv[2])
if not env.exists():
    raise SystemExit(f"Missing {env}")
t = env.read_text()
domain = pub.replace("https://", "").replace("http://", "")
t = re.sub(r"^FRONTEND_URL=.*$", f"FRONTEND_URL={pub}", t, flags=re.M)
t = re.sub(r"^DOMAIN=.*$", f"DOMAIN={domain}", t, flags=re.M)
t = re.sub(
    r"^CORS_ORIGINS=.*$",
    f"CORS_ORIGINS='[\"{pub}\",\"http://localhost\",\"http://127.0.0.1\"]'",
    t,
    flags=re.M,
)
if re.search(r"^ENVIRONMENT=.*$", t, flags=re.M):
    t = re.sub(r"^ENVIRONMENT=.*$", "ENVIRONMENT=development", t, flags=re.M)
else:
    t += "\nENVIRONMENT=development\n"
env.write_text(t)
print(f"Updated .env → FRONTEND_URL={pub}")
PY
}

recreate_api_if_needed() {
  compose_dev up -d --force-recreate --no-deps api >/dev/null 2>&1 || true
}

ensure_local_stack() {
  if ! curl -fsS -m 3 http://127.0.0.1/api/health >/dev/null 2>&1; then
    echo "Local stack on :80 is not healthy. Start it first, e.g.:" >&2
    echo "  docker compose -f docker-compose.yml -f docker-compose.override.yml up -d" >&2
    exit 1
  fi
}

extract_url_from_log() {
  case "$PROVIDER" in
    localtunnel)
      grep -Eo 'https://[a-zA-Z0-9.-]+\.loca\.lt' "$LOG_FILE" 2>/dev/null | head -1 || true
      ;;
    cloudflared)
      grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | head -1 || true
      ;;
    ngrok)
      local url
      url="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.ngrok(-free)?\.app' "$LOG_FILE" 2>/dev/null | head -1 || true)"
      if [[ -z "$url" ]]; then
        url="$(curl -fsS -m 2 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
          | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next((t["public_url"] for t in d.get("tunnels",[]) if t["public_url"].startswith("https")),""))' \
          2>/dev/null || true)"
      fi
      printf '%s' "$url"
      ;;
  esac
}

start_child() {
  : > "$LOG_FILE"
  case "$PROVIDER" in
    localtunnel)
      # Prefer installed lt; fall back to npx package binary.
      if command -v lt >/dev/null 2>&1; then
        lt --port 80 >>"$LOG_FILE" 2>&1 &
      else
        npx --yes --package=localtunnel lt --port 80 >>"$LOG_FILE" 2>&1 &
      fi
      ;;
    cloudflared)
      command -v cloudflared >/dev/null 2>&1 || {
        echo "cloudflared not found" >&2
        exit 1
      }
      cloudflared tunnel --url http://127.0.0.1:80 --protocol http2 --no-autoupdate >>"$LOG_FILE" 2>&1 &
      ;;
    ngrok)
      command -v ngrok >/dev/null 2>&1 || {
        echo "ngrok not found" >&2
        exit 1
      }
      if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
        ngrok config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null
      fi
      if ! ngrok config check >/dev/null 2>&1; then
        echo "ngrok is not configured. Run: ngrok config add-authtoken <token>" >&2
        exit 1
      fi
      ngrok http 80 --log=stdout --log-format=logfmt >>"$LOG_FILE" 2>&1 &
      ;;
    *)
      echo "Unknown TUNNEL_PROVIDER=$PROVIDER" >&2
      exit 1
      ;;
  esac
  echo $! > "$CHILD_PID_FILE"
}

# Internal: long-running supervisor (must be detached).
cmd_supervise() {
  echo "$(date -u +%FT%TZ) supervisor start provider=$PROVIDER" >>"$SUP_LOG"
  while true; do
    start_child
    local child
    child="$(cat "$CHILD_PID_FILE")"
    echo "$(date -u +%FT%TZ) child=$child" >>"$SUP_LOG"

    local url=""
    local i
    for i in $(seq 1 45); do
      url="$(extract_url_from_log)"
      if [[ -n "$url" ]]; then
        break
      fi
      if ! is_pid_alive "$child"; then
        break
      fi
      sleep 1
    done

    if [[ -n "$url" ]]; then
      local old
      old="$(read_url || true)"
      printf '%s' "$url" > "$URL_FILE"
      echo "$(date -u +%FT%TZ) url=$url" >>"$SUP_LOG"
      if [[ "$url" != "$old" ]]; then
        patch_env "$url" >>"$SUP_LOG" 2>&1 || true
        recreate_api_if_needed
      fi
    else
      echo "$(date -u +%FT%TZ) no url yet" >>"$SUP_LOG"
    fi

    # Wait until child dies
    while is_pid_alive "$child"; do
      sleep 5
    done
    echo "$(date -u +%FT%TZ) child died; restarting in 3s" >>"$SUP_LOG"
    sleep 3
  done
}

# Detach supervisor from this shell/session so agent/IDE cannot reap it.
detach_supervisor() {
  # Python double-fork + setsid is reliable on macOS.
  PROVIDER="$PROVIDER" ROOT="$ROOT" STATE_DIR="$STATE_DIR" \
  NGROK_AUTHTOKEN="${NGROK_AUTHTOKEN:-}" \
  python3 - "$ROOT/scripts/tunnel.sh" <<'PY'
import os, sys, subprocess

script = sys.argv[1]
env = os.environ.copy()
# First fork
if os.fork() > 0:
    sys.exit(0)
os.setsid()
# Second fork
if os.fork() > 0:
    sys.exit(0)
# Redirect stdio
devnull = open(os.devnull, "r+b", 0)
os.dup2(devnull.fileno(), 0)
sup_log = open(os.path.join(env["STATE_DIR"], "supervisor.log"), "a", buffering=1)
os.dup2(sup_log.fileno(), 1)
os.dup2(sup_log.fileno(), 2)
os.chdir(env["ROOT"])
# Replace with bash supervise loop
os.execve("/bin/bash", ["bash", script, "_supervise"], env)
PY
}

cmd_stop() {
  if is_running; then
    local sup
    sup="$(cat "$PID_FILE")"
    # Kill process group if possible, else supervisor + child
    kill "$sup" 2>/dev/null || true
    if is_pid_alive "$(cat "$CHILD_PID_FILE" 2>/dev/null || true)"; then
      kill "$(cat "$CHILD_PID_FILE")" 2>/dev/null || true
    fi
    sleep 1
    if is_running; then
      kill -9 "$sup" 2>/dev/null || true
    fi
  fi
  if is_pid_alive "$(cat "$CHILD_PID_FILE" 2>/dev/null || true)"; then
    kill "$(cat "$CHILD_PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" "$CHILD_PID_FILE"
  echo "Tunnel stopped."
}

cmd_start() {
  if [[ -f .env ]] && python3 - <<'PY'
from pathlib import Path

values = {}
for raw in Path(".env").read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    values[key.strip()] = value.strip().strip("'\"")
raise SystemExit(0 if values.get("ENVIRONMENT", "").lower() == "production" else 1)
PY
  then
    echo "Refusing to modify a production .env; configure a named Cloudflare Tunnel separately" >&2
    exit 1
  fi
  ensure_local_stack
  if is_running; then
    echo "Already running: $(read_url)"
    echo "Use: ./scripts/tunnel.sh status   or   ./scripts/tunnel.sh stop"
    exit 0
  fi

  # Clean only the process recorded by this script.
  if is_pid_alive "$(cat "$CHILD_PID_FILE" 2>/dev/null || true)"; then
    kill "$(cat "$CHILD_PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" "$CHILD_PID_FILE" "$URL_FILE"

  echo "Starting tunnel supervisor ($PROVIDER)..."
  : > "$SUP_LOG"
  detach_supervisor

  # Discover supervisor pid (child of setsid). Poll for URL instead.
  local url=""
  local i
  for i in $(seq 1 60); do
    # Record supervisor pid once we see the process
    if [[ ! -f "$PID_FILE" ]] || ! is_running; then
      local found
      found="$(pgrep -f 'scripts/tunnel.sh _supervise' | head -1 || true)"
      if [[ -n "$found" ]]; then
        echo "$found" > "$PID_FILE"
      fi
    fi
    url="$(read_url || true)"
    if [[ -n "$url" ]]; then
      local code
      code="$(curl -sS -m 12 -H 'bypass-tunnel-reminder: 1' -o /dev/null -w '%{http_code}' "$url/api/health" 2>/dev/null || echo 000)"
      if [[ "$code" == "200" ]]; then
        break
      fi
    fi
    # Also peek log while waiting
    local peek
    peek="$(extract_url_from_log || true)"
    if [[ -n "$peek" && "$peek" != "$url" ]]; then
      printf '%s' "$peek" > "$URL_FILE"
      url="$peek"
      patch_env "$url" >/dev/null
      recreate_api_if_needed
    fi
    sleep 1
  done

  url="$(read_url || true)"
  if [[ -z "$url" ]]; then
    echo "Failed to start tunnel. Supervisor log:" >&2
    tail -40 "$SUP_LOG" >&2 || true
    tail -40 "$LOG_FILE" >&2 || true
    exit 1
  fi

  # Ensure api has latest CORS even if URL matched old file
  patch_env "$url"
  recreate_api_if_needed
  for i in $(seq 1 25); do
    curl -fsS -m 3 http://127.0.0.1/api/ready >/dev/null 2>&1 && break
    sleep 1
  done

  local code myip
  code="$(curl -sS -m 20 -H 'bypass-tunnel-reminder: 1' -o /dev/null -w '%{http_code}' "$url/api/health" || echo 000)"
  myip="$(curl -sS -m 10 https://api.ipify.org 2>/dev/null || true)"

  echo
  echo "========================================"
  echo "PUBLIC: $url"
  echo "Local:  http://127.0.0.1"
  echo "health: $code"
  if [[ "$PROVIDER" == "localtunnel" && -n "$myip" ]]; then
    echo "loca.lt password (if asked): $myip"
  fi
  echo "Stop with: ./scripts/tunnel.sh stop"
  echo "========================================"
}

cmd_status() {
  local url
  url="$(read_url || true)"
  if is_running; then
    echo "running  supervisor_pid=$(cat "$PID_FILE")  provider=$PROVIDER"
  else
    echo "stopped"
  fi
  if is_pid_alive "$(cat "$CHILD_PID_FILE" 2>/dev/null || true)"; then
    echo "child_pid=$(cat "$CHILD_PID_FILE")"
  fi
  if [[ -n "$url" ]]; then
    echo "url=$url"
    local code
    code="$(curl -sS -m 12 -H 'bypass-tunnel-reminder: 1' -o /dev/null -w '%{http_code}' "$url/api/health" 2>/dev/null || echo 000)"
    echo "public_health=$code"
  fi
  local local_code
  local_code="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health 2>/dev/null || echo 000)"
  echo "local_health=$local_code"
}

cmd_url() {
  local url
  url="$(read_url || true)"
  if [[ -z "$url" ]]; then
    echo "No tunnel URL. Run: ./scripts/tunnel.sh start" >&2
    exit 1
  fi
  printf '%s\n' "$url"
}

usage() {
  cat <<'EOF'
Usage: ./scripts/tunnel.sh <start|stop|status|url>

Expose local Docker (nginx :80) via a public HTTPS URL.
Default provider: localtunnel

  TUNNEL_PROVIDER=cloudflared ./scripts/tunnel.sh start
  TUNNEL_PROVIDER=ngrok NGROK_AUTHTOKEN=… ./scripts/tunnel.sh start
EOF
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    start) cmd_start ;;
    stop) cmd_stop ;;
    status) cmd_status ;;
    url) cmd_url ;;
    _supervise) cmd_supervise ;;
    -h|--help|help|"") usage; [[ -n "$cmd" ]] || exit 1 ;;
    *) echo "Unknown command: $cmd" >&2; usage; exit 1 ;;
  esac
}

main "$@"
