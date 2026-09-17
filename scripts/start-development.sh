#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env.dev ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.dev
  set +a
fi

export PORT=5000
export MOBILE_PREVIEW_PORT=5005
export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-http://localhost:5000}"

cleanup() {
  kill "${mobile_pid:-}" "${web_pid:-}" 2>/dev/null || true
  wait "${mobile_pid:-}" "${web_pid:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd mobile && npm run preview:web) &
mobile_pid=$!

npm run dev &
web_pid=$!

wait -n "$mobile_pid" "$web_pid"