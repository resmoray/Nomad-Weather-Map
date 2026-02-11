#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "[ERROR] ripgrep (rg) is required for security scan." >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# Keep this list conservative to reduce noisy false positives.
PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'ASIA[0-9A-Z]{16}'
  'sk_live_[0-9A-Za-z]{16,}'
  'rk_live_[0-9A-Za-z]{16,}'
  'pk_live_[0-9A-Za-z]{16,}'
  'sk_test_[0-9A-Za-z]{16,}'
  'sk-[A-Za-z0-9_-]{20,}'
  'ghp_[A-Za-z0-9]{36}'
  'github_pat_[A-Za-z0-9_]{82}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'AIza[0-9A-Za-z_-]{35}'
  'SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}'
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  '-----BEGIN (RSA|DSA|EC|OPENSSH|PGP|PRIVATE) KEY-----'
  '-----BEGIN OPENSSH PRIVATE KEY-----'
  '(postgres|postgresql|mysql|mongodb(\+srv)?|redis|mariadb|mssql)://[^\s\"'"'"']+'
  '[a-z]+://[^\s:/]+:[^\s@/]+@'
)

EXCLUDES=(
  --glob '!.git'
  --glob '!node_modules'
  --glob '!dist'
  --glob '!.cache'
  --glob '!.venv-meteostat'
  --glob '!scripts/security/scan-secrets.sh'
)

echo "[INFO] Running current-state secret scan..."
found=0
for pattern in "${PATTERNS[@]}"; do
  if rg -n --hidden -S "${EXCLUDES[@]}" -- "$pattern" .; then
    found=1
  fi
done

if [[ "$found" -eq 1 ]]; then
  echo "[FAIL] Potential secrets found. Review matches above." >&2
  exit 1
fi

echo "[OK] No known secret patterns found in current tracked workspace files."
