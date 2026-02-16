#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="${TMPDIR:-/tmp}/nomad-weather-map"
LAUNCHER_TTY_FILE="$STATE_DIR/launcher.tty"

PIDS="$(
  {
    pgrep -f "$PROJECT_DIR.*server/index.ts" 2>/dev/null || true
    pgrep -f "$PROJECT_DIR.*vite" 2>/dev/null || true
  } | sort -u
)"

if [[ -z "${PIDS// }" ]]; then
  echo "No Nomad Weather Map dev processes found."
  exit 0
fi

echo "Stopping processes:"
echo "$PIDS"
echo "$PIDS" | xargs kill

echo "Stopped."

if [[ -f "$LAUNCHER_TTY_FILE" ]]; then
  LAUNCHER_TTY="$(cat "$LAUNCHER_TTY_FILE" 2>/dev/null || true)"
  if [[ -n "$LAUNCHER_TTY" ]]; then
    osascript >/dev/null 2>&1 <<EOF || true
tell application "Terminal"
  repeat with w in windows
    repeat with t in tabs of w
      if (tty of t) is "$LAUNCHER_TTY" then
        if (count of tabs of w) > 1 then
          close t
        else
          close w saving no
        end if
        return
      end if
    end repeat
  end repeat
end tell
EOF
  fi
  rm -f "$LAUNCHER_TTY_FILE"
fi
