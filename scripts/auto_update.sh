#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-dev}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[auto_update] check $BRANCH"
git fetch origin "$BRANCH"
LOCAL="$(git rev-parse "$BRANCH")"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "[auto_update] update: $LOCAL -> $REMOTE, deploying"
  "$ROOT/scripts/deploy.sh" "$BRANCH"
else
  echo "[auto_update] up to date"
fi
