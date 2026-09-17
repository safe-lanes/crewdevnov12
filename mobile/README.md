# SAIL Crew — Mobile App

Expo app for authenticated crew self-service on Android, iOS, and the managed
web preview. It includes first-login password reset, notices, notifications,
Crew Information editing, and authorized crew-file access.

## Setup

```
cd mobile
npm install
```

Set `EXPO_PUBLIC_API_BASE_URL` to your development API origin when testing on a
physical device. Do not use `localhost` unless the simulator or emulator has
port forwarding configured.

## Run

```
npx expo start
```

Scan the QR code with Expo Go (Android/iOS), or press `a`/`i` for an
emulator/simulator.

## Main flows

- `LoginScreen` → `SetPasswordScreen` when the server requires a first-login
  password change → authenticated bottom-tab navigation.
- Home, notices, notifications, profile, Crew Information collections, and
  permitted attachments are available from the authenticated navigation tree.
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
