#!/usr/bin/env bash
# Pull remote branch and redeploy if commits changed.
# Usage: ./scripts/auto_update.sh [branch]
set -euo pipefail

BRANCH="${1:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[auto_update] check origin/$BRANCH"
git fetch origin "$BRANCH"
CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "[auto_update] ERROR: current branch is '$CURRENT_BRANCH', expected '$BRANCH'" >&2
  exit 1
fi
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "[auto_update] update: $LOCAL → $REMOTE"
  "$ROOT/scripts/deploy.sh" --pull "$BRANCH"
else
  echo "[auto_update] up to date ($LOCAL)"
fi
