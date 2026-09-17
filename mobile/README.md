# SAIL Crew — Mobile App (Phase 1: Auth)

Bare Expo app proving the login/refresh/logout token round-trip against
`server/v2/crew-app/auth`. No feature screens yet.

## Setup

```
cd mobile
npm install
```

Edit `src/config.ts` and point `API_BASE_URL` at your dev machine's LAN IP
(not `localhost`) if you're testing on a physical device via Expo Go —
`localhost` only resolves correctly in a simulator/emulator with port
forwarding.

## Run

```
npx expo start
```

Scan the QR code with Expo Go (Android/iOS), or press `a`/`i` for an
emulator/simulator.

## What's here

- `LoginScreen` → `SetPasswordScreen` (only shown when the server returns
  `mustResetPassword: true`) → `LandingScreen`, switched purely on auth status
  in `App.tsx` (no navigation library yet).
- `src/auth/tokenStore.ts` — the source of truth for the current tokens,
  readable/writable outside the component tree so `src/api/client.ts`'s
  fetch interceptor can attach the access token and trigger a refresh
  without needing React context.
- `src/api/client.ts` — `apiFetch()` wraps every authenticated call: attach
  token, retry once after a silent refresh on 401, with concurrent 401s
  deduplicated behind a single in-flight refresh (the server's refresh
  tokens are single-use, so two independent refresh calls would make the
  second one look like a replay attack).
- `src/auth/secureStore.ts` — all token persistence goes through
  `expo-secure-store`, never `AsyncStorage`.
