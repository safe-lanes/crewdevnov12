#!/usr/bin/env bash
set -euo pipefail

PORT="${MOBILE_PREVIEW_PORT:-5005}"

# Workflow restarts can leave Expo's Node child alive after its parent shell
# exits. Stop only this project's Expo web process before starting its
# replacement, so Expo never prompts for a fallback port in headless mode.
pkill -TERM -f '[n]ode .*/mobile/node_modules/.bin/expo start --web --port 5005' 2>/dev/null || true

for _ in {1..20}; do
  if ! grep -qi ':138D ' /proc/net/tcp /proc/net/tcp6 2>/dev/null; then
    break
  fi
  sleep 0.1
done

# SDK 57 uses EXPO_UNSTABLE_HEADLESS to skip installing the optional native
# React Native DevTools shell. CI alone only disables interactive prompts.
export CI=1
export EXPO_UNSTABLE_HEADLESS=1

exec expo start --web --port "$PORT"