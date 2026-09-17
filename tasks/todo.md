# Crew Mobile App — Phase 1: Isolated Auth System

Plan: C:\Users\datta\.claude\plans\we-want-to-develop-proud-glade.md

## Backend
- [x] shared/v2/crew-app/schema.ts (appCrewCredentials, appCrewRefreshTokens)
- [x] shared/v2/crew-app/types.ts (insert/select types + request DTOs)
- [x] migrations/0212_create_app_crew_credentials.sql
- [x] server/v2/crew-app/auth/repositories/crewCredentialsRepository.ts
- [x] server/v2/crew-app/auth/repositories/crewRefreshTokensRepository.ts
- [x] server/v2/crew-app/auth/services/crewAuthService.ts
- [x] server/v2/crew-app/auth/crewAuthMiddleware.ts
- [x] server/v2/crew-app/auth/controllers/crewAuthController.ts
- [x] server/v2/crew-app/auth/routes.ts + index.ts barrels
- [x] server/v2/crew-app/scripts/backfillCrewCredentials.ts
- [x] server/v2/crew-app/README.md
- [x] Mount router in server/routes.ts (one line, pre-approved)
- [x] Add bcrypt + @types/bcrypt to package.json (pre-approved), npm install

## Mobile (Expo)
- [x] Scaffold mobile/ project (hand-authored — npx create-expo-app unavailable, network restricted to public npm registry)
- [x] secureStore.ts, tokenStore.ts (module-level store so the fetch interceptor can read/write tokens outside React)
- [x] AuthContext.tsx
- [x] api/client.ts (401 refresh-dedupe interceptor), api/authApi.ts
- [x] LoginScreen, SetPasswordScreen, LandingScreen
- [x] App.tsx wiring
- [x] mobile/README.md (setup/run instructions, since `npm install` couldn't be run here)

## Verification
- [x] grep check: no authMiddleware/tenantMiddleware/JWT_SECRET refs in server/v2/crew-app (only explanatory comments/docs — zero actual imports or process.env.JWT_SECRET reads)
- [x] npm run check (tsc) — see Review below
- [ ] Manual runtime verification (login, lockout, refresh rotation, logout revocation, restart persistence) — needs a running server + DB + device/simulator; not run in this session, see README/plan verification tables

## Review

**Backend**: `shared/v2/crew-app/schema.ts` + `types.ts` (app_crew_credentials, app_crew_refresh_tokens — `app_` prefixed per instruction, `user_type` column added), migration `0212_create_app_crew_credentials.sql`, and the full `server/v2/crew-app/auth/` module (repository → service → controller → middleware → routes) were built following the `crew-pool` module's conventions exactly. `server/routes.ts` got the one pre-approved mount line; `package.json` got `bcrypt`/`@types/bcrypt` via `npm install` (not hand-edited).

**npm install note**: this environment's `npm install` initially failed — `package-lock.json` has ~100 entries resolved against an internal `package-firewall.replit.local` host left over from this repo's original Replit environment, unreachable from here. Installed `bcrypt`/`@types/bcrypt` with `--package-lock=false` (bypassing full lockfile reconciliation) and then ran `npm install --package-lock-only` successfully to bring `package-lock.json` back in sync. This mismatch is pre-existing and unrelated to this task — worth knowing if a future `npm install` here hits the same host again.

**tsc baseline**: this local environment's full `tsc` run reports ~766-770 errors, not the documented 220/40 baseline — traced to `node_modules/drizzle-orm`'s `package.json` main entry (`index.cjs`) not resolving the way this TS config expects (`TS7016: Could not find a declaration file ... 'index.js' implicitly has an 'any' type'), a pre-existing, repo-wide issue affecting every v2 file that imports `drizzle-orm` (210+ occurrences, including existing `crew-pool` files) — an environment/node_modules artifact, not something touched by this work. Per CLAUDE.md, unrelated baseline errors were left alone.
Errors genuinely introduced by this work, and fixed: two `jwt.verify(...) as <Type>` casts TS flagged as unsafe (fixed via `as unknown as <Type>`, in `crewAuthMiddleware.ts` and `crewAuthService.ts`), and two implicit-`any` callback parameters in `backfillCrewCredentials.ts` (given explicit `{ crewUuid: string }` annotations).
**Net new errors in touched files after fixes: 0** (the only errors remaining in the new files are the same pre-existing `drizzle-orm` TS7016 noise present throughout the rest of the v2 codebase).

**Mobile**: no mobile project existed anywhere in the repo, so `mobile/` was hand-authored (Expo SDK 51 template shape) rather than scaffolded via `npx create-expo-app`, since this environment's npm access is restricted to the public registry and a full `create-expo-app` run wasn't attempted. `npm install` inside `mobile/` has **not** been run in this session — do that, then `npx expo start`, before testing on a device. One addition beyond the original plan's file list: `src/auth/tokenStore.ts`, a small module-level (non-React) store holding the current tokens, needed so `api/client.ts`'s fetch interceptor can read/write tokens outside the component tree — `AuthContext` subscribes to it.

**Not done in this session**: actual runtime verification (login success, 5-failure lockout, access-token-expiry silent refresh, refresh rotation/reuse-rejection, logout revocation, restart persistence) — this needs a running server with `CREW_APP_ACCESS_TOKEN_SECRET`/`CREW_APP_REFRESH_TOKEN_SECRET` set, a real tenant DB with the migration applied, a backfilled test credential, and (for the mobile-side checks) `npm install` + a device/simulator. See the verification tables in the plan and in `server/v2/crew-app/README.md` for exact steps.

## Follow-up session — end-to-end setup + Expo SDK 51 → 57 upgrade

- [x] Found LAN IP (192.168.156.62), set `mobile/src/config.ts` `API_BASE_URL` to it.
- [x] Found tenants (`rsms`, `Wah Kwong`) by querying the master DB directly (no `psql` available, used a throwaway `pg` script).
- [x] Discovered `employee_id` was populated on only 64/2052 `rsms` crew but `emp_no` on all 2052 — renamed the login identifier from `employee_id` to `emp_no` everywhere (schema, migration, repository, service, backfill script, mobile UI, README) per your instruction.
- [x] Added `--limit=N` to the backfill script; backfilled one real test credential in `rsms`: `emp_no: "K 1003"`, temp password `icYBQhJfVm`, `must_reset_password: true`.
- [x] Started the backend — came up cleanly, migration `0212` auto-applied to `rsms`.
- [x] Diagnosed the "no login page" issue: Metro was advertising `127.0.0.1` (unreachable from a phone); recommended `npx expo start --tunnel` plus Expo Go on a physical device (no Android SDK/emulator installed on this machine).
- [x] **Upgraded mobile app from Expo SDK 51 → 57**: bumped Node via nvm (22.11.0 → 22.13.0 — hit a real snag: `nvm use` needs an elevated terminal on Windows and silently left `node` completely broken system-wide until the user re-ran it as Administrator), then `expo install --fix` + manual devDependency bumps (`typescript` → `~6.0.3`, `@types/react` → `~19.2.4`, `babel-preset-expo` → `~57.0.0`) + `npm install` (added `mobile/.npmrc` with `legacy-peer-deps=true` — SDK 57's React 19/RN 0.86 peer-dependency graph doesn't resolve cleanly otherwise, matching the root project's own `.npmrc` convention). Added `mobile/.gitignore` (Expo template's, `.expo/` etc. — `expo-doctor` flagged its absence). **Verified**: `expo-doctor` 21/21 passed, `npx tsc --noEmit` clean, no code changes needed in `mobile/src/**` (app uses no custom native modules, only official Expo packages, no navigation library).
- [ ] **Still needed before phone testing**: SDK 57 requires being logged into an Expo account (expo.dev — free) on **both** the CLI (`npx expo login`) and the Expo Go app on the phone — confirmed via `npx expo whoami` → "Not logged in". This is new since SDK 51 and wasn't needed before. User needs to do this (requires their own credentials).
- [ ] Re-run the login round-trip test on-device after logging in (same test credential as before, or a fresh backfill if that one's `must_reset_password` state was already cleared in an earlier attempt).

---

# Phase 2 — Admin Content, Notices, Notifications, Home Screen

Plan: C:\Users\datta\.claude\plans\we-want-to-develop-proud-glade.md (overwritten for Phase 2 — see git/file history if Phase 1 plan text is needed again, it's preserved in this file's Phase 1 section above and in the Phase 1 Review notes)

## Backend
- [x] shared/v2/crew-app/schema.ts — add appCrewContentPages, appCrewNotices, appCrewNotifications
- [x] shared/v2/crew-app/types.ts — insert/select types + request DTOs for the 3 new tables
- [x] migrations/0213_create_app_crew_content_notices_notifications.sql
- [x] server/v2/crew-app/auth/requireCrewAdmin.ts + barrel export
- [x] crewAuthService.ts — add firstName/familyName to login response (crewMembersV2 lookup)
- [x] server/v2/crew-app/content/ (repository/service/controller/routes/index)
- [x] server/v2/crew-app/notices/ (repository/service/controller/routes/index) incl. publish fan-out
- [x] server/v2/crew-app/notifications/ (repository/service/controller/routes/index)
- [x] server/v2/crew-app/notifications/crewNotificationScanner.ts (background scan, mirrors crewingAlertEngine shape, no import from server/v2/alerts)
- [x] server/v2/crew-app/scripts/promoteCrewAdmin.ts
- [x] Mount content/notices/notifications routers in server/routes.ts; start/stop scanner in server/routes.ts + server/index.ts

## Mobile
- [x] Install @react-navigation/native + native-stack + bottom-tabs (+ required peer deps: react-native-screens, react-native-safe-area-context)
- [x] mobile/src/navigation/RootNavigator.tsx, MainTabs.tsx
- [x] Extend AuthContext/tokenStore/secureStore: userType, firstName, familyName
- [x] mobile/src/api/contentApi.ts, noticesApi.ts, notificationsApi.ts
- [x] mobile/src/components/WelcomeBanner.tsx
- [x] mobile/src/screens/HomeScreen.tsx (replaces LandingScreen, which was deleted — no remaining references)
- [x] mobile/src/screens/NoticesListScreen.tsx, NoticeDetailScreen.tsx
- [x] mobile/src/screens/ContentPageScreen.tsx (generic, reused for About Us/Contact Us/Forum)
- [x] mobile/src/screens/NotificationsScreen.tsx
- [x] mobile/src/screens/admin/AdminContentEditScreen.tsx, AdminNoticeEditScreen.tsx
      (simplification vs. the plan's file list: no separate AdminNoticesListScreen — NoticesListScreen
      does double duty for admins, showing drafts + a "+ New Notice" button, since it would otherwise
      have been a near-duplicate of the crew-facing list)

## Verification
- [x] promoteCrewAdmin.ts dry-run + real run — promoted emp_no "K 1006" to Admin in domain rsms
- [x] Admin-only writes rejected 403 for Crew-role token (curl check) — both content PUT and notices POST confirmed
- [x] Crew reads render correctly, notice publish fans out notifications correctly (row count check) —
      unread count went 0→1 on publish, notification row matched (crewUuid, dedupeKey, notificationType: "notice")
- [x] Notification scanner dedupe check (run twice, no duplicates) — first run created 1 new document_expiry
      notification (real data — 2 crew members had documents expiring within 30 days), second run created 0
- [x] Mark-read scoping check (can't mark another crew member's notification) — Admin token attempting to
      mark Crew's notification read got 404 "Notification not found", not success
- [x] npm run check (tsc) — 0 new errors in any Phase 2 backend file (only pre-existing repo-wide drizzle-orm
      TS7016 noise, same as Phase 1)
- [x] mobile: npx tsc --noEmit clean; expo-doctor 21/21

## Review

Backend and mobile are both built and verified end-to-end via curl against the real `rsms` tenant DB (2,052
real crew records) — not just unit-level checks. Two throwaway test scripts were used for DB inspection during
verification (listing tenants, directly invoking the scanner twice to prove dedupe) and deleted immediately
after use; nothing was left behind.

**Known gaps / deliberate simplifications, for awareness:**
- `bodyHtml` on content pages is plain multi-line text in the admin editor and rendered as plain `<Text>` on
  the read screen — not actually parsed/rendered as HTML. Naming matches the schema field, but there's no
  rich-text editor or HTML rendering; revisit if real formatting (bold, links, images) is wanted later.
- Per the Phase 2 plan's explicit scope decision, there is no in-app "promote another user to Admin" flow —
  `promoteCrewAdmin.ts` is the only way to mint an Admin. Two admin test accounts now exist in `rsms`:
  `K 1003` (promoted first, in the earlier session — its password is whatever the user set via the app's
  first-login reset, unknown to me) and `K 1006` (promoted this session specifically for curl testing,
  temp password `eFhV8Tkxgg`, still has `must_reset_password: true`). A third test account, `K 1004`
  (plain Crew, temp password `Efd4nCSmSz`), also exists for crew-side testing.
- The background scanner's 30-minute-class interval (default 15 min) means a *newly* expiring document won't
  show up as a notification instantly — only on the next scan tick (or the 30s-after-boot initial scan).
- Have not yet done an on-device (Expo Go) pass through the new screens — all backend verification was via
  curl; the mobile UI itself has only been verified via `tsc`/`expo-doctor`, not run interactively. Worth
  doing a real walkthrough (Admin editing About Us/Notices from the phone, Crew seeing them, tapping the
  bell) next.
