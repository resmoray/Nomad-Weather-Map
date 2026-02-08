#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="${TMPDIR:-/tmp}/nomad-weather-map"
LAUNCHER_TTY_FILE="$STATE_DIR/launcher.tty"
cd "$PROJECT_DIR"

if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
  echo "Installing dependencies (first run)..."
  if ! npm ci; then
    npm install
  fi
fi

mkdir -p "$STATE_DIR"
CURRENT_TTY="$(tty 2>/dev/null || true)"
if [[ "$CURRENT_TTY" == /dev/* ]]; then
  echo "$CURRENT_TTY" > "$LAUNCHER_TTY_FILE"
fi

if ! npm run dev:health; then
  exit 1
fi

echo "Starting Nomad Weather Map (backend + frontend)..."
npm run dev &
DEV_PID=$!

cleanup() {
  if kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup INT TERM

for _ in {1..120}; do
  if curl -sf "http://localhost:5173" >/dev/null 2>&1; then
    open "http://localhost:5173"
    break
  fi
  sleep 1
done

wait "$DEV_PID"
