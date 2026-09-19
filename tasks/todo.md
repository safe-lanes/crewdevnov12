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

---

# Phase 3 — Hardening: Security, Performance, Query Quality, Deployment, Testing

Source: full architecture review (security, code quality, error handling, deployment readiness,
performance & scalability, testing coverage, API query quality) conducted this session across
`mobile/` and `server/v2/crew-app/` + `server/v2/crew-pool`. Goal: mobile app smooth and secure —
work through every item below, not just a subset.

## Tier 1 — Do immediately (secrets + crash safety)
- [x] **[S3, Critical]** Add `.env`, `.env copy`, `mobile/.env` to `.gitignore` (root and `mobile/`) — done, both `.gitignore` files now have a `.env*` rule. **Not done, by explicit user decision this session**: `.env.dev` and `.env.local` are *already tracked in git* (discovered mid-fix, not just untracked-and-unignored) and confirmed present on `origin` across 10+ remote branches since Aug 2025, containing real `JWT_SECRET`/`SESSION_SECRET`/`MASTER_DATABASE_URL`/`VITE_CLIENT_ENCRYPTION_KEY`/`SCREENING_API_KEY`/`CREW_APP_ACCESS_TOKEN_SECRET`/`CREW_APP_REFRESH_TOKEN_SECRET` key names (values not printed). Also found: the local `.git/config` remote URL embeds a live GitHub PAT in plaintext. User chose "leave as-is for now, just fix going forward" — **still needs, whenever ready: rotate all secrets in `.env.dev`/`.env.local`, revoke/regenerate the GitHub PAT, and decide on `git rm --cached` + optional history rewrite for the two tracked files.**
- [x] **[S1, High]** Add a dedicated rate limiter on `POST /api/crew-app/auth/login` and `/refresh` — added `authAttemptLimiter` (8/min/IP) directly in `server/v2/crew-app/auth/routes.ts`, applied to both routes.
- [x] **[S2, High]** Enforce `deviceId` match on refresh in `crewAuthService.refresh` (`crewAuthService.ts:159-196`) — a mismatch (or a device-bound token refreshed with no deviceId) now revokes the whole session family and rejects, same as reuse/replay handling.
- [x] **[E1, Critical]** Add a global `ErrorBoundary` (`mobile/src/components/ErrorBoundary.tsx`) wrapping the whole app in `mobile/App.tsx`, plus `mobile/src/globalErrorHandler.ts` registering `ErrorUtils.setGlobalHandler` for uncaught JS exceptions outside render (event handlers/promises). Both log via `console.error` for now — full crash *reporting* (Sentry) is still Tier 2's E2.

## Tier 2 — Before any store submission
- [x] **[D1, Critical]** Hand-authored `mobile/eas.json` (development/preview/production profiles, `appVersionSource: "local"`, `autoIncrement: true` on production) — `eas-cli`/`npx eas` isn't available in this environment (no network install + no Expo login here), so it wasn't run interactively; the file matches `eas build:configure`'s standard template. **Still needed**: the user runs `eas login` + links a real EAS project on first actual build.
- [x] **[D2, Critical]** Added `ios.buildNumber: "1.0.0"` and `android.versionCode: 1` to `mobile/app.json`, consistent with `eas.json`'s `appVersionSource: "local"` + `autoIncrement: true` on production builds.
- [x] **[D3, Critical]** Wired `icon`, `splash.image`, and `android.adaptiveIcon.foregroundImage` in `mobile/app.json` — using `mobile/assets/login-ocean.png` as an explicit **temporary placeholder**, per user's choice (no real app icon exists yet). ⚠️ **Caveat found while wiring it**: the image is 752×1422 (portrait, not square) — fine for `splash.image` (uses `resizeMode: contain`), but not a real app icon shape; `icon`/`adaptiveIcon.foregroundImage` will look stretched/cropped on-device and EAS may warn at build time. **Still needed**: a real square (1024×1024 recommended) icon asset before actual store submission.
- [ ] **[E2, Critical]** Add a crash/error reporting service (Sentry Expo SDK) — **skipped this session per user's choice** ("skip Sentry for now"). Still open; needs a real Sentry account + DSN when picked back up.
- [x] **[D5, High]** Drafted the PII / data-safety inventory at `mobile/docs/privacy-data-inventory.md` — maps this app's actual data categories (contact info, user IDs, sensitive PII, travel documents, health data, family/dependents, employment records, photos/files, auth data) to Apple App Privacy / Google Play Data Safety form categories, with notes on third-party sharing (currently none), health-data review friction, and retention questions to confirm with whoever owns that policy.
- [ ] **[D6, Medium]** Verify iOS usage-description strings for `expo-document-picker`/`expo-file-system`/`expo-sharing` at first EAS build (no native `ios/` project exists yet to check Info.plist directly) — still open, genuinely needs a real build to verify.

## Tier 3 — Before scaling past a pilot group
- [x] **[N1, High]** Removed the 11x redundant `crew_members_v2` existence-check queries — `getInformation()` in `crew-information/controller.ts` now calls the 8 collection repositories directly (new module-level `info*Repository` instances, mirroring the file's existing `MastersRepository` precedent) instead of going through each service's `getAll()`/`getLicenses()`/etc., which each redundantly re-verified crew existence. `getFullProfile()` (still going through the service layer) is the one remaining existence check, run once as part of the same `Promise.all`. Service layer itself untouched — other callers of those services are unaffected.
- [x] **[N2, Medium]** Fixed DELETE-path over-fetch in `collectionHandler` — added `findChildByUuid` to `crewFamilyRepository`/`crewProfileService.getChildByUuid` (children had no direct id lookup at all before, so both `adapter.get` and the old `adapter.list` call fired the identical `getChildren()` query). Replaced the DELETE branch's `adapter.list(crewUuid)` re-fetch with a new `attachmentsByCollection` map that fetches only the target record's own attachments (via each service's existing `getAttachments()`, or the licenses/training repositories directly where no service wrapper existed) — no more full-collection re-fetch to delete one record.
- [x] **[P1, High]** Added limit/offset pagination to notices and notifications. New shared `server/v2/crew-app/pagination.ts` (`parsePageParams`, and a `paginate()` helper that fetches `limit+1` rows and slices — tells the caller `hasMore` without a second COUNT query). Applied to `crewNoticesRepository`/`Service`/`Controller` (both `listPublished` and `listAllForAdmin`) and `crewNotificationsRepository`/`Service`/`Controller`. Response shape changed from a bare array to `{items, hasMore}` — a breaking API change, so the mobile client (`noticesApi.ts`, `notificationsApi.ts`) and screens were updated in the same pass (see Q2/E5 above for those screens — they're the same files). Added `mobile/src/hooks/usePaginatedList.ts` (load page 1 on focus, `loadMore()` for `FlatList.onEndReached`) and wired it into `NoticesListScreen.tsx`/`NotificationsScreen.tsx`; `HomeScreen.tsx`'s 3-notice preview now requests `limit: 3` directly instead of over-fetching and slicing. **Deliberately not extended to crew-information collections**: those are naturally bounded per crew member (a person has a handful of documents/visas/licenses, not hundreds) and readonly collections (medicals, doctorVisits, briefings, debriefings) come from the `get()` aggregate rather than a dedicated list endpoint, so pagination doesn't cleanly apply without restructuring that endpoint — the original review's own risk assessment centered on notices/notifications as the actual unbounded-growth case.
- [x] **[P2, High]** Added `@tanstack/react-query` (`npm install` — confirmed working in this environment). **Scoped deliberately, not a full rewrite**: cached specifically `crewInformationApi.get()`/`getMasters()` (`mobile/src/hooks/useCrewInformationQuery.ts`) — the payload independently re-fetched by Home/Profile/Collection screens on every focus, the highest-value target. `HomeScreen`, `CrewProfileScreen`, `CrewCollectionScreen` now read from the cache (instant paint from cached data + background revalidation on focus, instead of a blank/spinner flash every time). Wired `useInvalidateCrewInformation()` into every mutation path that touches crew-information (`ProfileEditor.save`, `RecordEditor.save`/`remove` in `CrewCollectionScreen.tsx`) so other screens get fresh data on their next focus. `queryClient.clear()` wired into both logout (`AuthContext.tsx`) and forced-session-expiry (`client.ts`'s `performRefresh` catch) so cached data never leaks across a login boundary on a shared device. Notices/notifications intentionally **not** moved to React Query — they're cheap, single-screen, lower-value, and stayed on the Q2 `useAsyncOnFocus` hook to limit blast radius. `CrewCollectionScreen`'s per-collection `crewInformationApi.list(collection)` calls (for non-readonly, non-children collections) also stayed outside the cache — genuinely one collection at a time, less redundant than the aggregate `get()` call was.
- [x] **[Q1, High]** Consolidated the 5 duplicated `parseOrThrow` helpers into one in `client.ts` (now also attaches `.status`/`.details` everywhere, a strict superset of what each file checked before — verified server error shapes across content/notices/notifications/auth controllers only ever set `error`, never `message`, so prioritizing `message` first is safe). `rawPost` now delegates to it too. All 5 `api/*.ts` files updated.
- [x] **[Q2, High]** Added `mobile/src/hooks/useAsyncOnFocus.ts` (owns loading/error/retry/`useFocusEffect` wiring; the caller's `task` callback still owns its own `setState` calls, so screens loading multiple pieces of data into multiple state vars work unchanged). Applied to `HomeScreen.tsx`, `NoticesListScreen.tsx`, `NotificationsScreen.tsx`, `ContentPageScreen.tsx`, `CrewProfileScreen.tsx`, `CrewCollectionScreen.tsx` — six of the seven. **`CrewAttachments.tsx` deliberately left out**: its `load` is mount-triggered (`useEffect` + a `mounted` ref guarding updates after unmount during in-flight transfers), not focus-triggered, and is tangled up with the upload/download cancellation state machine that Tier 4's Q3 already scopes as its own careful pass — folding it into this hook now would risk that transfer-safety logic for a mechanical de-dup win.
- [x] **[E5, Medium]** Fixed via the Q2 refactor: `NoticesListScreen.tsx` and `NotificationsScreen.tsx` now render through `StateView` with real `error`+`retry`, same as every other list screen. Also fixed `NotificationsScreen`'s silent mark-read failure (`onPressItem`) to show `Alert.alert("Could not mark as read", ...)` instead of a bare empty catch.
- [x] **[Testing]** Stood up test infrastructure from scratch (none existed) — `jest-expo`, `@testing-library/react-native`, `@react-native/jest-preset`, `expo-modules-core` (hoisting fix — was nested under `expo/node_modules/`, invisible to `jest-expo`'s own resolution; pulled to top-level). `mobile/jest.setup.ts` sets `EXPO_PUBLIC_API_BASE_URL` for the test env (native `config.ts` throws without it). Added `mobile/tsconfig.test.json` (`types: ["jest","node"]`) since `@types/jest`'s ambient globals weren't resolving under the main tsconfig for an unclear reason — main `tsconfig.json` now excludes `**/__tests__/**` so the app's own typecheck (used in CI, matches this repo's "0 new tsc errors" convention) stays test-free, with a separate `typecheck:test` script for the tests themselves. Added all 4 flagged high-risk suites, 33 tests total, all passing:
  1. `src/api/__tests__/client.test.ts` (10 tests) — token refresh single-flight dedup, concurrent-401 sharing one `/refresh` call, refresh-failure session clearing, `parseOrThrow`.
  2. `src/api/__tests__/crewInformationApi.uploadAttachment.test.ts` (9 tests) — the raw-XHR upload path's 401-refresh-retry, cancel-races-retry, and network-error-vs-real-failure distinction (needed a hand-rolled `FakeXHR` — `XMLHttpRequest` isn't defined in this jest environment).
  3. `src/auth/__tests__/AuthContext.test.tsx` (7 tests) — the full `loading → loggedOut → mustResetPassword → loggedIn` state machine, isAdmin derivation, logout clearing both crew identity and the query cache.
  4. `src/components/__tests__/CrewAttachments.test.tsx` (7 tests) — the ambiguous-upload retry-reconciliation heuristic specifically (both the "finds a match, skips duplicate upload" and "no match, re-uploads for real" branches — this was flagged as a real correctness risk in the review), plus the transfer lock and cancel-aborts-underlying-transfer behavior.
  Also wired `npm test`, `npm run typecheck:test`, and both into `.github/workflows/mobile-ci.yml` (D4, above).
- [x] **[D4, High]** Added `.github/workflows/mobile-ci.yml` (`npm ci` + `tsc --noEmit`, triggered on any push/PR touching `mobile/**`). **Lint step not added**: `mobile/` has no ESLint config or dependency at all yet — adding one is a separate setup task, not "wire CI for what exists." Worth doing as a follow-up once a lint config exists.

## Tier 4 — Lower priority / opportunistic
- [x] **[Q3a, High]** Extracted the duplicated operationId/mounted/cancel-lock bookkeeping into `mobile/src/hooks/useCancelableTransfer.ts` (`begin()`/`isCurrent()`/`setCancel()`/`finish()`/`withLock()`). `CrewAttachments.tsx`'s `startUpload`, `openAttachment`, `remove`, and `load` all now go through it instead of hand-rolling their own refs. Verified with the existing 7-test `CrewAttachments.test.tsx` suite (covers exactly this bookkeeping) — all still pass unchanged, confirming the refactor preserved exact behavior.
- [ ] **[Q3b, High]** Idempotency-key replacement for the ambiguous-upload retry heuristic — **deliberately deferred**, not done this session. Requires a schema migration (a `client_upload_id`-style column) across all 6 attachment tables (documents/visas/education/licenses/training/sea-service) plus matching endpoint changes in each — a standalone task of its own, not a safe fit for a Tier-4 pass. The existing heuristic (covered by tests) stays as the interim mitigation.
- [x] **[E3, High]** Added Zod runtime validation at the `api/*.ts` boundary. `client.ts`'s `parseOrThrow`/`rawPost` now take an optional schema and validate the body after the ok-check, throwing a clear "unexpected response shape" error (with `.details` from Zod's flattened issues) instead of silently trusting `as T`. Full field-level schemas for `Notice`, `AppNotification`, `ContentPage`, the auth `LoginResponse`, and `CrewAttachment` (including the XHR upload path in `crewInformationApi.uploadAttachment`, which now rejects instead of resolving with a malformed body). `CrewInformation`/`CrewInformationMasters` intentionally got a *structural* schema, not exhaustive per-field validation — `sections` stays `z.record(z.string(), z.any())` since it's a deliberately flexible passthrough bag across 11+ collections; over-constraining it would just break on the next legitimate field the server adds. New shared `pageSchema()` helper in `pagination.ts` for the `{items, hasMore}` envelope. Added `zod` as a direct mobile dependency (was only present transitively before). One test fixture had to be corrected (an abbreviated mock response body that the new validation correctly started rejecting) plus one new test added for that rejection path — 34/34 tests passing.
- [x] **[E4, High]** Null-guarded `info.sections?.family?.children`, `info.sections?.[collection]` in `CrewCollectionScreen.tsx`'s `loadRows`, and `masters.vessels`/`masters.vesselTypes`/`masters.countries`/`masters.nationalities`/`masters.languages` (with `|| []` fallbacks) in both `CrewCollectionScreen.tsx`'s `optionsFor` and `CrewProfileScreen.tsx`'s `renderField` — these ran unguarded assuming the server always returns every masters array.
- [ ] **[Q4, Medium]** Break up the 800–1400+ character single-statement JSX blocks in `CrewCollectionScreen.tsx:52,64-65` and `CrewProfileScreen.tsx:41,51,56` — not done; a pure readability pass with real regression risk against dense, already-tested JSX, deprioritized in favor of the higher-value items above.
- [x] **[Q5, Medium]** Documented (not changed) `requireCurrentCrew`'s hard `userType !== "Crew"` lockout — added a comment in `crewInformationGuard.ts` explaining the current behavior (Admin gets a blanket 403 on their own profile) and exactly what to change (`userType === "Crew" || userType === "Admin"`, scoped to own crewUuid) if a future product decision says it's unintended. Left the actual access-control behavior alone since changing who can access what isn't a call to make unilaterally.
- [x] **[Q6, Medium]** Adopted one typed-error convention across the content/notices/notifications crew-app controllers. New `server/v2/crew-app/errors.ts` (`httpError`/`notFound`/`sendCrewAppError`) — services now throw `notFound("X not found")` (status attached via `Object.assign`, matching the pattern `attachmentController.ts` already used) instead of plain `Error`, and controllers call `sendCrewAppError` instead of hand-written `error?.message === "X not found"` checks. **`crew-information/controller.ts`'s own `sendError` deliberately left untouched** — its string-matching fallback is load-bearing there specifically because its errors originate from shared `crew-pool` services (used by the main web app too) that this pass didn't touch, so removing the fallback would have turned real 404s into generic 400/500s. Auth's `statusForError` also left alone — different, but not less correct, and security-sensitive code already confirmed good in the review.
- [x] **[Q7, Low]** `CrewAttachments.tsx` now takes `maxBytes` as a prop (defaulting to the old hardcoded 5MB if not supplied) instead of a fixed constant; `CrewCollectionScreen.tsx` passes `attachmentRules?.maxBytes` from the server response at both call sites. Validation message and the "Maximum file size" subtitle both reflect the real limit now.
- [x] **[S7, Low]** `crewNoticesService.getByUuid` now takes an `isAdmin` flag and only returns unpublished notices when true — a non-admin fetching a draft's UUID directly now gets the same "not found" as a nonexistent notice, matching `listPublished`'s filter. Controller passes `req.crewUser!.userType === "Admin"`. Verified `AdminNoticeEditScreen`'s draft-editing flow still works (it's the one caller that needs `isAdmin: true`).
- [x] **[S5, Medium]** Added a dummy `bcrypt.compare()` (against a `DUMMY_PASSWORD_HASH` computed once at startup, same cost factor as real hashes) on the "identifier not found" login path, so it burns comparable time to the real "wrong password" path's `bcrypt.compare()` — closes the timing side-channel that let an attacker distinguish a real identifier from a fake one despite both returning the identical error text.
- [x] **[S6, Low]** Pinned `{ algorithms: ["HS256"] }` on both `jwt.verify()` call sites (`crewAuthMiddleware.ts`, `crewAuthService.ts`).
- [x] **[S4, Medium]** `mobile/src/config.ts` now throws at startup if `API_BASE_URL` doesn't start with `https://` and `__DEV__` is false (real RN/Expo global, false in a release build) — a misconfigured production build can no longer silently ship credentials over plaintext HTTP. Dev/local-web `http://localhost` usage is unaffected.
- [x] **[P3, Medium]** Converted `CrewCollectionScreen.tsx`'s row list from `ScrollView` + `.map()` to `FlatList` (title/tabs via `ListHeaderComponent`, the "Add" button via `ListFooterComponent`, loading/error/empty via `StateView` rendered through `ListHeaderComponent`/`ListEmptyComponent`) — done now rather than waiting for an observed scale problem, since the review's condition ("if any collection grows past ~50-100 rows") is hard to actually monitor for in practice.
- [x] **[P4, Medium]** `pickPhoto()`'s `ImagePicker.launchImageLibraryAsync` now requests `quality: 0.7` instead of `1` — no new dependency, gives most camera-roll photos real headroom under the 5MB cap instead of routinely tripping it.
- [x] **[P5, Medium]** `AuthContext.Provider`'s value is now `useMemo`'d over its actual dependencies instead of a fresh object literal every render.

Full Tier 4 verification: `mobile/npx tsc --noEmit` clean, `npx tsc --noEmit -p tsconfig.test.json` clean, `npm test -- --ci` → 4 suites, **34 tests, all passing** (33 pre-existing + 1 new for E3's malformed-response rejection). Root backend `npx tsc --noEmit -p .` shows zero new errors across every touched file (`crewAuthMiddleware.ts`, `crewAuthService.ts`, `crewInformationGuard.ts`, `errors.ts`, the content/notices/notifications services+controllers) — only pre-existing baseline noise elsewhere.

**What's left, deliberately, across the whole hardening pass:**
- Q3b (idempotency keys) and Q4 (JSX readability) — noted above.
- Everything flagged as needing the user's own action across Tiers 1-2: rotating the already-committed `.env.dev`/`.env.local` secrets, Sentry account/DSN, a real square app icon, a real `eas-cli` sanity-check.
- Manual on-device/runtime verification — every check across all 4 tiers was `tsc` + automated tests, never a running server + phone/simulator.

## Review

**Tier 1 — done.** `mobile/tsc --noEmit` clean; root `tsc` shows zero new errors in the two touched backend
files (only the pre-existing repo-wide `drizzle-orm` TS7016 baseline noise). No manual runtime verification
yet (rate limiter under real load, device-mismatch rejection, refresh rotation, ErrorBoundary catching a
real thrown error) — needs a running server + device/simulator pass, same as Phase 1/2's outstanding items.

**Escalation found while fixing S3, not in the original review**: `.env.dev`/`.env.local` are tracked in git
and already pushed to `origin` across 10+ branches (since Aug 2025) with real secret key names present; the
local git remote URL also has a live GitHub PAT in plaintext. Flagged to the user immediately via
AskUserQuestion rather than acted on unilaterally (rotating secrets/revoking tokens are account actions only
they can take; rewriting shared git history is destructive). User chose to leave the tracked files and
history untouched for now and only fix `.gitignore` going forward — **carry this forward as still-open,
it is not resolved, only deferred.**

**Tier 2 — mostly done, two items deliberately deferred by user choice.** `mobile/tsc --noEmit` still clean
after `app.json`/`eas.json` changes; `app.json` validated as well-formed JSON. `eas.json` and the version
numbers are config-only and needed no external account. E2 (Sentry) was explicitly skipped this session —
still open. D3 (icon/splash) is wired but only as a placeholder — `login-ocean.png` is portrait (752×1422),
not square, so it's a real gap for the icon specifically (splash is fine), not just "needs swapping before
launch." Neither `eas build:configure` nor `expo-doctor` was actually run (no `eas-cli`/network login in this
environment) — the hand-authored `eas.json` should be sanity-checked with a real `eas` CLI run once the user
has it available. D6 remains genuinely unverifiable without a real build.

**Tier 3 — complete.** This was the largest tier: backend query fixes (N1/N2), mobile API-layer de-duplication
(Q1), a shared focus-fetch hook applied to 6 screens (Q2), real error UI on the two screens that silently
swallowed failures (E5), React Query caching for the crew-information payload with invalidation wired into
every mutation path and cache-clearing on logout/session-expiry (P2), limit/offset pagination on notices and
notifications with a `FlatList.onEndReached`-driven client (P1), a CI workflow (D4), and — the biggest single
piece — test infrastructure built from nothing plus all 4 flagged high-risk suites (33 tests).

Verification for the whole tier: `mobile/npx tsc --noEmit` clean (app code) and `npx tsc --noEmit -p
tsconfig.test.json` clean (app + tests); `npm test -- --ci` — 4 suites, 33 tests, all passing; root `npx tsc
--noEmit -p .` shows zero new errors in every file touched this session (`crew-information/controller.ts`,
`crewFamilyRepository.ts`, `crewProfileService.ts`, the notices/notifications repository-service-controller
trios, `pagination.ts`) — the errors that do print are 100% pre-existing baseline noise in `client/src/**`
(the main web app), untouched by any of this work.

**What's still open, deliberately, and needs a decision from the user before it's truly done:**
- The already-committed `.env.dev`/`.env.local` secrets (S3) — needs rotation + a decision on history rewrite.
- Sentry crash reporting (E2) — needs a real account/DSN.
- A real square app icon (D3) — the current one is a stretched placeholder.
- `eas build:configure`/`expo-doctor` were never actually run against the hand-authored `eas.json` (no
  `eas-cli`/Expo login in this environment) — sanity-check with the real CLI before the first real build.
- Manual on-device/runtime verification of anything in Tiers 1-3 — every check this session was `tsc` +
  automated tests, never a running server + phone/simulator, consistent with every prior phase in this file.

Tier 4 (lower-priority/opportunistic polish) remains open below.

_(continue filling in as Tier 4 items are picked up)_
