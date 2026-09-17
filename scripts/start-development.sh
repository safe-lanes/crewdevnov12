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
export CREW_APP_TENANCY_MODE="${CREW_APP_TENANCY_MODE:-single}"
export CREW_APP_SINGLE_TENANT_DOMAIN="${CREW_APP_SINGLE_TENANT_DOMAIN:-local}"

case "$CREW_APP_TENANCY_MODE" in
  single)
    ;;
  multi)
    if [[ -z "${MASTER_DATABASE_URL:-}" ]]; then
      echo "MASTER_DATABASE_URL is required when CREW_APP_TENANCY_MODE=multi" >&2
      exit 1
    fi
    ;;
  auto)
    ;;
  *)
    echo "CREW_APP_TENANCY_MODE must be single, multi, or auto" >&2
    exit 1
    ;;
esac

if [[ -n "${REPLIT_DEV_DOMAIN:-}" ]]; then
  export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-https://${REPLIT_DEV_DOMAIN}}"
else
  export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-http://localhost:5000}"
fi

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