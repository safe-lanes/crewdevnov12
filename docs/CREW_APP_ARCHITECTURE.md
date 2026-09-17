# Crew Mobile App — Architecture

> Covers the crew-facing Android/iOS mobile app: the isolated backend module at
> `server/v2/crew-app/` + `shared/v2/crew-app/`, and the Expo app at `mobile/`.
> This is a subsystem of the wider SAIL Crewing platform (see `docs/ARCHITECTURE.md`
> for the platform generally — note that document predates this subsystem and the
> v2/multi-tenant architecture, and is not being updated as part of this document).

## 1. Overview

Seafarers need a mobile login separate from the office/ship web users who use the
existing SAIL Crewing web app. That existing auth (`server/middleware/authMiddleware.ts`,
`server/middleware/tenantMiddleware.ts`) verifies JWTs issued by a parent app (SAIL
Audits) using `JWT_SECRET`, applied globally to every `/api/v2/*` request. The crew
app needed its own login system that could not depend on that flow at all — different
users, different token issuer, different lifecycle — without touching or risking the
existing system.

The result is a **fully self-contained subsystem**: its own database tables, its own
JWT secrets, its own middleware, its own route prefix. Nothing under
`server/v2/crew-app/` imports from `authMiddleware.ts` or `tenantMiddleware.ts`, and
nothing in it reads `JWT_SECRET`. This is enforced by convention, not by tooling —
verify at any time with:

```sh
grep -rn "authMiddleware\|tenantMiddleware\|JWT_SECRET" server/v2/crew-app
```
(only comments/docs should match, never an `import`).

Built in two phases:
- **Phase 1** — login, refresh, logout, forced first-login password reset. A bare
  3-screen mobile app just to prove the token round-trip worked.
- **Phase 2** — an in-app Admin role; admin-authored About Us / Contact Us / Forum
  pages; Notices (announcements); a Notifications feed covering both published
  notices and document/visa expiry reminders; a real Home screen and bottom-tab
  navigation.

## 2. System diagram

Two parallel, non-intersecting paths into the same tenant databases:

```
┌─────────────────────┐        ┌──────────────────────────┐
│   Web app (office/   │        │  Crew mobile app (Expo)  │
│   ship users)        │        │                           │
└──────────┬───────────┘        └──────────────┬────────────┘
           │ JWT (JWT_SECRET)                   │ JWT (CREW_APP_ACCESS_TOKEN_SECRET)
           ▼                                    ▼
┌─────────────────────┐        ┌──────────────────────────┐
│ tenantMiddleware.ts  │        │  crewAuthMiddleware.ts   │
│ authMiddleware.ts    │        │  (server/v2/crew-app/    │
│ (server/middleware/) │        │   auth/)                 │
│ — applied globally   │        │  — applied per-route,    │
│   to /api/v2/*        │        │    only on this module's │
└──────────┬───────────┘        │    own routes            │
           │                    └──────────────┬────────────┘
           ▼                                    ▼
   /api/v2/* routers                  /api/crew-app/* routers
   (crew-pool, admin, ...)            (auth, content, notices,
                                        notifications)
           │                                    │
           └─────────────┬──────────────────────┘
                          ▼
              tenantConnectionManager
           (resolveTenant / runInTenantContext /
                     getDb() per tenant)
                          │
                          ▼
              Tenant-scoped Postgres DB
     (crew_members_v2, crew_visas, crew_documents, ...
      app_crew_credentials, app_crew_notices, ...)
```

The isolation boundary is **path-based, not code-based**: `server/index.ts` applies
`tenantMiddleware`/`authMiddleware` globally to every request under `/api/v2/`.
`server/middleware/exemptPaths.ts::isExempt()` treats any path that does **not**
start with `/api/v2/` as exempt from both. The crew-app routers are deliberately
mounted at `/api/crew-app/...` (see `server/routes.ts`) specifically to land outside
that prefix — so the legacy middleware never runs against them, with zero special-case
edits to `exemptPaths.ts` or any shared file. Both paths still end up at the same
`tenantConnectionManager`, which is a shared low-level utility (connection pooling,
tenant resolution), not part of the "legacy auth" being avoided.

## 3. Backend module structure

Four modules under `server/v2/crew-app/`, each following the same layering, copied
from the wider codebase's `server/v2/crew-pool/` convention:

```
server/v2/crew-app/
  auth/
    routes.ts, crewAuthMiddleware.ts, requireCrewAdmin.ts
    controllers/crewAuthController.ts
    services/crewAuthService.ts
    repositories/crewCredentialsRepository.ts, crewRefreshTokensRepository.ts
  content/          # About Us / Contact Us / Forum
    routes.ts, controllers/, services/, repositories/
  notices/          # Announcements
    routes.ts, controllers/, services/, repositories/
  notifications/    # Per-crew notification feed + background scanner
    routes.ts, crewNotificationScanner.ts, controllers/, services/, repositories/
  scripts/
    backfillCrewCredentials.ts, promoteCrewAdmin.ts
```

- **Repositories** are classes. Every method calls `getDb()` (from `server/v2/db.ts`)
  fresh — never cached at module or constructor scope — because it reads the
  tenant-scoped Drizzle instance out of `AsyncLocalStorage`, which is only populated
  for the duration of one request/scan.
- **Services** are singleton objects holding all business logic (validation,
  cross-repository orchestration, the notice-publish notification fan-out).
- **Controllers** are singleton objects: parse the request with a zod schema, call
  the service, map errors to HTTP status by message (`instanceof z.ZodError` → 400,
  specific known messages → 404/403/401, everything else → 500 + `console.error`).
- **Routes** wire `router.<verb>(path, [crewAuthMiddleware], [requireCrewAdmin],
  controller.method)` directly — no other middleware.

**Tenant resolution without the legacy middleware**: `login` and `refresh` have no
prior session, so they call `tenantConnectionManager.resolveTenant(domain)` directly
(`domain` from the request body for login; decoded from the refresh JWT's own payload
for refresh) and run the rest of the work inside
`tenantConnectionManager.runInTenantContext(tuid, ...)`. `crewAuthMiddleware` does the
equivalent for every other route: verify the access token, resolve tenant, wrap
`next()` in the same tenant context — so every repository call downstream just calls
`getDb()` normally, unaware of how the context got established.

**Admin enforcement** (`requireCrewAdmin.ts`) is a one-line role check on
`req.crewUser.userType` (already decoded onto the request by `crewAuthMiddleware`) —
not a second auth system. Mounted after `crewAuthMiddleware` on any admin-write route.

## 4. Database schema

All five tables live in `shared/v2/crew-app/schema.ts`, duplicated locally rather than
importing shared pieces from other v2 modules (keeps this module self-contained). Every
table follows the project-wide convention: `serial id` primary key + a business
`*_uuid` text column (the externally-referenced identifier — never join on `id` across
modules) + the standard audit columns (`createdAt`, `updatedAt`, `createdByUuid`,
`updatedByUuid`, `isDeleted`, `isSync`).

| Table | Purpose | Notable columns |
|---|---|---|
| `app_crew_credentials` | One row per crew member's mobile login | `crewUuid` (soft ref to `crew_members_v2.crew_uuid`), `domain`, `empNo`/`mobile`/`email` (any usable as login identifier), `passwordHash`, `userType` (`"Crew"` \| `"Admin"`), lockout fields |
| `app_crew_refresh_tokens` | One row per issued refresh token | `crewCredentialId` (hard FK, same-module), `tokenHash` (SHA-256 of the raw JWT — raw token never stored), `revokedAt` |
| `app_crew_content_pages` | About Us / Contact Us / Forum — one flexible table, not three | `pageKey` (`about_us`\|`contact_us`\|`forum`, zod-validated, not a DB constraint), unique on `(domain, pageKey)` |
| `app_crew_notices` | Announcements | `isPublished`, `publishedAt` (set on publish — also the fan-out trigger) |
| `app_crew_notifications` | Per-crew notification feed | `crewUuid` (recipient), `notificationType` (`notice`\|`document_expiry`\|`visa_expiry`), `dedupeKey` (**unique** — this is the actual dedupe mechanism), `isRead`/`readAt` |

Cross-module reads (the notification scanner reading `crewVisas`/`crewDocuments` from
`shared/v2/crew-pool/schema.ts`, or `crewAuthService` reading `crewMembersV2` for the
display name) are normal and expected — the isolation rule is specifically about not
depending on the legacy *auth* files, not about avoiding reads of other domains' data.

**Migrations**: `drizzle.config.ts` only watches `shared/schema.ts` (the single legacy
file) — a new `shared/v2/crew-app/schema.ts` table is invisible to `drizzle-kit
generate`/`db:push`. Every table here was instead created by a hand-written, idempotent
SQL file in `migrations/` (`0212_create_app_crew_credentials.sql`,
`0213_create_app_crew_content_notices_notifications.sql`), auto-discovered and applied
per-tenant on first connection by `server/migrationRunner.ts`. The Drizzle schema file
is purely a typed query-builder layer for app code — same pattern every other v2 module
in this codebase uses.

## 5. Auth & token design

Both access and refresh tokens are JWTs, signed with two dedicated env vars
(`CREW_APP_ACCESS_TOKEN_SECRET`, `CREW_APP_REFRESH_TOKEN_SECRET` — both required at
module load, both must differ from each other and from `JWT_SECRET`).

- **Access token** — 15 min TTL. Payload: `{ sub: crewCredentialId, crewId: crewUuid,
  domain, userType }`.
- **Refresh token** — 45 day TTL, sliding (each refresh issues a fresh 45-day token).
  Payload adds a `jti`. Making it a JWT (not opaque random bytes) is what lets
  `/refresh` — which has no prior session — read `domain` straight out of the token to
  resolve the tenant, without the client separately tracking/resending it. The **raw
  token is never persisted**; only its SHA-256 hash (`token_hash`) is stored, so a
  token can be looked up/revoked without the DB ever holding a bearer credential.

**Rotation & reuse detection**: every `/refresh` call atomically marks the presented
token's row `revoked_at = now() WHERE revoked_at IS NULL` (single UPDATE, no separate
existence check — 0 rows affected means it was already used). A 0-row result is treated
as replay: **every** refresh token for that credential is revoked, forcing a fresh
login, and the client must dedupe concurrent 401s behind one in-flight refresh call
(see §7) so it never triggers this itself.

**Lockout**: 5 consecutive wrong-password attempts locks the account 15 minutes
(`failed_login_attempts`/`locked_until`, reset on success or once the lock expires).
Login returns the same generic `"Invalid credentials"` for both not-found and
wrong-password (no enumeration); a locked account gets a disclosed
`"Account locked until <time>"` message instead — a deliberate, narrow exception to
the no-enumeration rule, acceptable for this internal user base.

**Admin role**: `userType` on the credential row, set only via
`scripts/promoteCrewAdmin.ts` (no in-app "promote another admin" flow — deliberately
out of scope, see §9). Carried through the access token, read by `requireCrewAdmin`.

## 6. API reference

All routes mounted under `/api/crew-app/` (see `server/routes.ts`).
**Auth column**: `public` = no token; `crew` = valid access token; `admin` = valid
access token + `userType === "Admin"`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{identifier, password, domain, deviceId?, deviceLabel?}` |
| POST | `/auth/refresh` | public (token in body) | rotating, single-use |
| POST | `/auth/logout` | crew | revokes one or all refresh tokens |
| POST | `/auth/set-password` | crew | requires current password |
| GET | `/content` | admin | list all pages (incl. unpublished) |
| GET | `/content/:pageKey` | crew | published page only, 404 if unauthored |
| PUT | `/content/:pageKey` | admin | upsert |
| GET | `/notices` | crew | published only, own domain |
| GET | `/notices/admin` | admin | all, incl. drafts |
| GET | `/notices/:noticeUuid` | crew | |
| POST | `/notices` | admin | create; fans out notifications if published immediately |
| PUT | `/notices/:noticeUuid` | admin | edit; false→true publish transition fans out |
| DELETE | `/notices/:noticeUuid` | admin | soft delete |
| GET | `/notifications` | crew | own notifications, newest first |
| GET | `/notifications/unread-count` | crew | for the bell badge |
| POST | `/notifications/:notificationUuid/read` | crew | scoped to caller's own `crewUuid` |
| POST | `/notifications/read-all` | crew | |

## 7. Background jobs

**`crewNotificationScanner.ts`** — shape-mirrors the platform's existing
`server/v2/alerts/crewingAlertEngine.ts` (same `setInterval` + 30s-deferred-initial-scan
pattern, same `start()`/`stop()` lifecycle, started/stopped alongside it in
`server/routes.ts`/`server/index.ts`) but is a **fully separate instance** — no import
from `server/v2/alerts/`, since that system is tightly coupled to the legacy web app's
role-based recipient model and hardcoded to its own three scan types.

Runs every `CREW_APP_NOTIFICATION_SCAN_INTERVAL_MS` (default 15 min), only when
multi-tenant mode is enabled. Per tenant: loads every `app_crew_credentials` row with
`is_active = true` (the set of crew who actually have app accounts — nobody else is
scanned), reads `crewVisas`/`crewDocuments` for those crew members, and for anything
expiring within `CREW_APP_NOTIFICATION_EXPIRY_DAYS` (default 30) builds a
`dedupeKey` (e.g. `visa-<crewUuid>-<visaUuid>-<expiry>` — including the expiry date
means a renewed document naturally produces a fresh notification) and inserts via
`INSERT ... ON CONFLICT (dedupe_key) DO NOTHING`, so repeated scans never duplicate.
Verified directly (not just by code review): running the scan twice against real
tenant data produced N new rows on the first pass and 0 on the second.

## 8. Mobile app architecture

`mobile/` — Expo (SDK 57), TypeScript, no custom native modules.

```
mobile/
  App.tsx                    # AuthProvider > NavigationContainer > RootNavigator
  src/
    navigation/
      RootNavigator.tsx       # loading | LoginScreen | SetPasswordScreen | MainTabs
      MainTabs.tsx             # bottom tabs, each its own native-stack:
                                #   Home:    HomeScreen -> NotificationsScreen
                                #   Notices: NoticesList -> NoticeDetail -> AdminNoticeEdit
                                #   More:    More -> ContentPage -> AdminContentEdit
    auth/
      secureStore.ts           # raw expo-secure-store key read/write (NOT AsyncStorage)
      tokenStore.ts             # module-level (non-React) store + pub/sub
      AuthContext.tsx           # React state derived from tokenStore; login/logout/setPassword
    api/
      client.ts                 # apiFetch() — token attach + 401 refresh-and-retry
      authApi.ts, contentApi.ts, noticesApi.ts, notificationsApi.ts
    screens/, screens/admin/, components/
```

**Why a non-React token store exists**: `api/client.ts`'s fetch interceptor needs to
read/write the current tokens from outside the component tree (it isn't a hook or a
component). `tokenStore.ts` is a plain module-level object with `get()`/`set()`/
`subscribe()`; `AuthContext` subscribes to it and turns it into React state
(`status: "loading" | "loggedOut" | "mustResetPassword" | "loggedIn"`, plus `userType`/
`firstName`/`familyName`/`isAdmin`). Both layers persist through `secureStore.ts`.

**`apiFetch`'s refresh-and-retry**: attaches the access token, and on a 401 refreshes
once and retries. Because refresh tokens are server-side single-use, concurrent 401s
share one in-flight refresh promise (`inFlightRefresh`) rather than each independently
calling `/refresh` — two independent calls would make the loser look like a replay and
force-logout the whole session for no reason.

**Admin gating in the UI** (`isAdmin` from `AuthContext`) is convenience only — screens
like `ContentPageScreen`/`NoticesListScreen` show Edit/New buttons when `isAdmin` is
true, but the real enforcement is server-side `requireCrewAdmin` (verified with curl
using a non-admin token — see `tasks/todo.md`).

## 9. Key design decisions

| Decision | Reasoning |
|---|---|
| Routes at `/api/crew-app/...`, not `/api/v2/crew-app/...` | `/api/v2/*` gets the legacy middleware applied globally; this path choice gives full isolation with zero edits to shared middleware files |
| `emp_no` as the login identifier, not `employee_id` (as originally specified) | Real tenant data showed `employee_id` populated on ~3% of crew, `emp_no` on ~100% — using the field that's actually populated everywhere |
| One `app_crew_content_pages` table with a `pageKey`, not three separate tables | About Us / Contact Us / Forum are structurally identical; a `pageKey` column avoids three near-duplicate tables/modules |
| Forum is a static read-only page | Explicit scope decision — not an interactive discussion board (no threads/posts/moderation) |
| Admin promotion is script-only (`promoteCrewAdmin.ts`), no in-app "manage admins" screen | Rare, high-privilege operation; a one-line script is safer and simpler than a self-service admin-management UI, and limits the blast radius of a compromised Admin session |
| Refresh token is a JWT, not opaque bytes | Lets `/refresh` (no prior session) resolve tenant from the token's own payload |
| `@react-navigation` (bottom-tabs + native-stack), not `expo-router` | The app already had a hand-rolled `AuthContext`-driven root switch; React Navigation slots into that as-is, `expo-router`'s file-based routing would have required restructuring around its own conventions for no real benefit at this app's size |

## 10. Known limitations

- `bodyHtml` on content pages is plain text in the admin editor and rendered as plain
  `<Text>` — not actually parsed/rendered as HTML. No rich-text editor or real HTML
  rendering yet.
- The scanner's interval (default 15 min) means a newly-expiring document doesn't
  produce a notification instantly — only on the next scan tick.
- No on-device (Expo Go) interactive walkthrough of the Phase 2 screens has been done
  yet — verified via `tsc`, `expo-doctor`, and direct `curl` calls against the real
  backend, not by operating the actual UI.
- `docs/ARCHITECTURE.md` (the platform-wide document) has not been updated to
  reference this subsystem.
