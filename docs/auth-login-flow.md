# Authentication & Login Flow

This document is the complete reference for how a user becomes authenticated and authorized in Crewing — from the moment a token is generated to the moment the server lets a request through. It covers both supported runtime modes and every environment variable involved.

> Companion docs: [`jwt-authentication.md`](./jwt-authentication.md), [`jwt-authentication-flow.md`](./jwt-authentication-flow.md), [`multitenant-token-sequence-diagram.md`](./multitenant-token-sequence-diagram.md).

---

## 1. Modes at a glance

Crewing can run in one of two modes. The mode is selected at **client build time** through `VITE_AUTH_MODE`.

| Mode | Who shows the login form? | Who issues the JWT? | Where does logout / 401 send the user? | Required env |
|---|---|---|---|---|
| **`standalone`** *(default)* | Crewing's own `/login` page | Crewing's own `/api/v2/auth/login` | `/login` (in-app, via `window.location.replace`) | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `VITE_CLIENT_ENCRYPTION_KEY` |
| **`parent`** | Parent app (e.g. SAIL ERP) | Parent app — Crewing reads the token from `sessionStorage` | `VITE_PARENT_LOGIN_URL` (external) | All of the above + `VITE_PARENT_LOGIN_URL`, **and** the parent app's `JWT_SECRET` must match Crewing's |

Decision matrix:

```
VITE_AUTH_MODE=standalone   → in-app login form
VITE_AUTH_MODE=parent       + VITE_PARENT_LOGIN_URL set    → parent handoff
VITE_AUTH_MODE=parent       + VITE_PARENT_LOGIN_URL unset  → production build fails (vite.config.ts guard)
VITE_AUTH_BYPASS=true       → all client guards disabled (dev only)
AUTH_BYPASS=true            → server skips JWT verification (dev only, NODE_ENV=development required)
```

---

## 2. End-to-end login — Standalone

### 2.1 Page load

1. The Express server returns `index.html` with `Cache-Control: no-store, no-cache, must-revalidate` (set in [`server/vite.ts`](../server/vite.ts) for both dev and prod). This keeps the SPA shell out of the browser's back/forward cache.
2. `client/src/main.tsx` mounts `<App />`.
3. [`App.tsx`](../client/src/App.tsx) `ProtectedShell` calls `getAuthToken()` **synchronously during render**. If no token is present it returns `<Redirect to="/login?next=…" replace />` — protected markup is never rendered for an unauthenticated session, even on a BFCache restore.
4. A `pageshow` listener (`BFCacheGuard`) re-runs the same check when the browser restores the page from BFCache (`event.persisted === true`) and calls `redirectToLogin()` if the session is gone.

### 2.2 Login form submit

`POST /api/v2/auth/login` with body:

```json
{
  "username": "jdoe",       // OR "crewId": "C-1029" OR "identifier": "<either>"
  "password": "•••••••••",
  "domain": "acme"
}
```

### 2.3 Server validation

In [`server/v2/auth/routes.ts`](../server/v2/auth/routes.ts):

1. **Zod schema** validates `(username | crewId | identifier) + password + domain`. Bad shape → `400 invalid_request`.
2. **Rate limit** (`loginLimiter`): 20 attempts / 5 min, bucket key = `ip | (identifier|username|crewId) | domain`. Exceeded → `429 rate_limited`.
3. **Audit log** row inserted into `login_audit_log` (success/failure, IP, UA, event reason).

### 2.4 Identity resolution

1. Look up the user **by username first** in the requested domain (case-insensitive).
2. If not found, look up **by `crew_id`** in the same domain.
3. If still not found → respond with the generic `401 invalid_credentials` (no enumeration leak).
4. If account is **locked** (`lockoutUntil > now`) → `401 invalid_credentials` plus an audit row tagged `locked`.

### 2.5 Password verification

`bcrypt.compare(plaintext, user.passwordHash)` in [`server/v2/auth/tokens.ts`](../server/v2/auth/tokens.ts).
- Cost: `BCRYPT_ROUNDS` env, default **12**, clamped to a minimum of 12 (lower values are warned and raised).
- On failure: increment `failedLoginAttempts`, apply progressive lockout (`lockoutUntil`), audit `bad_password` (and `bad_password+lock(Nm)` when the threshold is hit).

### 2.6 Token generation

On success:

```ts
accessToken  = signAccessToken({ id, domain, userType, uuid, username, roleId })
            // jwt.sign(claims, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL })   // default 15m

jti          = generateOpaqueToken(16)            // 16 random bytes hex
refreshToken = signRefreshToken({ id, domain, jti })
            // jwt.sign(claims, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_TTL })  // default 7d
```

A row is inserted into the `refresh_tokens` table:

| column | value |
|---|---|
| `user_id` | resolved user id |
| `token_hash` | `sha256(refreshToken)` (the raw token is **never** stored) |
| `parent_id` | NULL on initial login; set to the previous row id on rotation |
| `ip_address`, `user_agent` | request metadata (UA truncated to 256 chars) |
| `expires_at` | now + `JWT_REFRESH_TTL` |
| `revoked_at`, `revoked_reason` | NULL initially |

The user row is updated: `failedLoginAttempts = 0`, `lockoutUntil = null`, `lastLoginAt`, `lastLoginIp`, `tenantId` (if multi-tenant).

### 2.7 Response

```jsonc
{
  "accessToken":  "<JWT signed with JWT_SECRET>",
  "refreshToken": "<JWT signed with JWT_REFRESH_SECRET>",
  "tenantId":     "<tuid or null>",
  "user": {
    "id": 42, "uuid": "…", "username": "jdoe",
    "fullName": "Jane Doe", "email": "…", "designation": "…",
    "userType": "Office", "roleId": "…", "domain": "acme"
  }
}
```

`GET /api/v2/auth/profile` additionally returns `crewId` so the client can display it.

### 2.8 Client storage

[`client/src/lib/authToken.ts`](../client/src/lib/authToken.ts) `setAuthSession()`:

| Storage | Key | Contents | Encryption |
|---|---|---|---|
| `sessionStorage` | `credentials` | access token | AES (`VITE_CLIENT_ENCRYPTION_KEY`) |
| `sessionStorage` | `refreshCredentials` | refresh token | AES |
| `sessionStorage` | `crewUserName`, `crewDesignation` | display fields | AES |
| `localStorage` | `userProfile` | `{userId, role, roleId, userType}` | AES |
| `localStorage` | `domain`, `crewUserId` | login domain & user id | AES |
| `localStorage` (via `tenantStorage`) | `tenantId`, `tenantDomain` | tenant routing | plain |

### 2.9 Redirect into the app

- `LoginPage` honors `?next=` and navigates to that path.
- `LoginGuard` blocks the `/login` route if a token is already present (renders `<Redirect to="/" replace />`), so a back-step to `/login` after sign-in cannot resurface the form.

---

## 3. End-to-end login — Parent mode

In parent mode, Crewing **does not own the credentials**. The parent app writes them into `sessionStorage` using its own JSON-encoded encrypted format before navigating to the Crewing route.

1. `getAuthToken()` first tries the raw-AES standalone format and falls back to the parent's JSON-encoded format via `getDecryptedSessionStorageItem("credentials", true)`.
2. The token must be a valid JWT signed with the **same `JWT_SECRET`** the parent uses, so Crewing's `authMiddleware` can verify it.
3. On 401 or logout, `redirectToLogin()` / `logout()` clears local state and `window.location.replace(VITE_PARENT_LOGIN_URL)` hands off to the parent.
4. The Vite production build (`vite.config.ts`) hard-fails if `VITE_PARENT_LOGIN_URL` is missing (unless `VITE_AUTH_BYPASS=true`).

---

## 4. Authenticated request lifecycle

Every API call goes through the same chain.

### 4.1 Client — `tenantFetch.ts`

`window.fetch` is wrapped:

1. For non-`/api/*` URLs → pass through.
2. For the public auth endpoints (`/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`) → pass through unauthenticated.
3. Otherwise: attach `Authorization: Bearer <accessToken>` and `x-tenant-id: <tenantId>`.
4. On `401`: single-flight `POST /api/v2/auth/refresh`. If it succeeds, retry the original request with the new token. If it fails, `redirectToLogin()`.

### 4.2 Server — `authMiddleware`

In [`server/middleware/authMiddleware.ts`](../server/middleware/authMiddleware.ts):

1. **Exempt paths** (login, refresh, health, etc.) skip the middleware.
2. Token extraction: `Authorization: Bearer …`, or `?sail=…` for the whitelisted file-serving paths only.
3. `jwt.verify(token, JWT_SECRET)` → populates `req.user` and `req.tokenData`.
4. Errors: `TokenExpiredError → 401 token_expired`; any other verify failure → `401 invalid_token`; missing token → `401 unauthorized`; `JWT_SECRET` not configured (and not in dev bypass) → `500 server_configuration_error`.
5. **Tenant binding** (`proceedWithTenantBinding`): in multi-tenant mode the JWT `domain` claim is resolved to a tenant `tuid` and compared to `req.tenantId`. Mismatch → `403 tenant_mismatch`. In `NODE_ENV=development` without `tenantId`, the check is relaxed.

### 4.3 Silent refresh

`POST /api/v2/auth/refresh`:

1. `verifyRefreshToken(token)` against `JWT_REFRESH_SECRET`.
2. Look up the row by `sha256(token)`.
3. If `revokedAt` is non-null → **reuse detected**: revoke every active refresh token for that user (`revoked_reason = 'reuse_detected'`), audit `refresh_reuse`, return `401 invalid_refresh`.
4. If expired or user inactive → `401 invalid_refresh`.
5. Otherwise rotate: mark the old row `revoked_reason = 'rotated'`, mint a new pair, insert the new row with `parent_id` pointing to the old one, audit `refresh`, return `{accessToken, refreshToken, tenantId}`.

### 4.4 Authorization (RBAC)

Authentication only proves *who* the request is from. Authorization is enforced separately:

1. [`PermissionsContext`](../client/src/contexts/PermissionsContext.tsx) loads the role's menu permissions from `/api/v2/admin/access-control/my-permissions` and caches them.
2. `<ProtectedRoute menuName="Recruitment">` calls `canView(menuName)` and renders a "No Access" page when the role's `canview` flag is false.
3. Per-action checks (`canCreate`, `canEdit`, `canDelete`) gate buttons / mutations inside each module.
4. Server-side, role and permission checks live in the controller / service layer for each module — JWT verification only proves identity, not authority.

---

## 5. Logout & session destruction

1. UI calls `logout()` (`HeaderComponent` user dropdown).
2. Best-effort `POST /api/v2/auth/logout` with `keepalive: true` — the server `verifyRefreshToken`s the token in the body and marks its `refresh_tokens` row `revoked_reason = 'user_logout'`.
3. `clearAuthSession()` removes `credentials`, `refreshCredentials`, `crewUserName`, `crewDesignation`, `userProfile`, `crewUserId`, `domain`, and tenant data.
4. Standalone: `window.location.replace('/login')`. Parent: `window.location.replace(VITE_PARENT_LOGIN_URL)`. `replace` is used so the prior protected URL is **not** left as a back-history entry.
5. BFCache hardening (Task #238): `Cache-Control: no-store` on `index.html` + `pageshow` listener + render-time `<Redirect>` ensure that even if a browser ignores `no-store` the cached protected page cannot render without a token.

---

## 6. Environment variable reference

### 6.1 Client (Vite — must be prefixed `VITE_` to reach the browser)

| Variable | Purpose | Mode | Required? | Example | Failure mode if missing/wrong |
|---|---|---|---|---|---|
| `VITE_AUTH_MODE` | Selects `standalone` (default) or `parent`. | both | optional | `standalone` | Wrong value falls back to `standalone`; parent handoff won't trigger. |
| `VITE_PARENT_LOGIN_URL` | URL to redirect to on logout / 401 in parent mode. | parent | required for parent prod builds (enforced in `vite.config.ts`) | `https://erp.example.com/login` | Production build fails with a clear error. |
| `VITE_AUTH_BYPASS` | Disables every client-side auth guard. **Dev only.** | both | optional | `true` | Bypasses `<Redirect>` and `BFCacheGuard`; do not use in prod. |
| `VITE_CLIENT_ENCRYPTION_KEY` | AES key used to encrypt session/local-storage credentials. | both | required | `sailAdmin` | Tokens are stored in plain text; parent-mode handoff cannot decrypt. |
| `VITE_API_BASE_URL` | External API base URL (used by some legacy modules). | both | optional | `https://dev.sl-sail.com/b/api/v1` | Affected modules cannot reach their backend. |
| `VITE_AG_GRID_LICENSE_KEY` | AG Grid Enterprise license. | both | optional | *(license string)* | AG Grid renders a watermark. |

### 6.2 Server

| Variable | Purpose | Required? | Example | Failure mode if missing/wrong |
|---|---|---|---|---|
| `JWT_SECRET` | HMAC key for **access** tokens. | **required in prod**; dev uses an ephemeral random key with a warning | *(48-byte hex)* | `authMiddleware` returns `500 server_configuration_error`; tokens cannot be verified across restarts in dev. |
| `JWT_REFRESH_SECRET` | HMAC key for **refresh** tokens. Must differ from `JWT_SECRET` in prod. | **required in prod** | *(48-byte hex)* | Process throws on boot if equal to `JWT_SECRET` in prod. |
| `JWT_ACCESS_TTL` | Access-token lifetime. | optional | `15m` | Defaults to `15m`. |
| `JWT_REFRESH_TTL` | Refresh-token lifetime. | optional | `7d` | Defaults to `7d`. |
| `BCRYPT_ROUNDS` | Bcrypt cost factor. | optional | `12` | Clamped to a minimum of 12. |
| `PASSWORD_RESET_TTL` | Password-reset link lifetime. | optional | `1h` | Defaults to `1h`. |
| `AUTH_BYPASS` | Skips JWT verification. **Dev only** (also requires `NODE_ENV=development`). | optional | `true` | Server logs a warning; never set in prod. |
| `NODE_ENV` | Toggles dev/prod behavior throughout. | required | `development` / `production` | Wrong value enables/disables dev fallbacks. |
| `DATABASE_URL` | Primary Postgres connection string. | required | `postgres://…` | Server cannot start. |
| `MASTER_DATABASE_URL` | Multi-tenant master DB. Optional — single-tenant mode if unset. | optional | `postgres://…` | Multi-tenant routing disabled. |
| `SESSION_SECRET` | Express session encryption key (legacy session middleware). | required | *(random string)* | Sessions cannot be signed. |

---

## 7. Ready-to-paste `.env` snippets

### 7.1 Local standalone dev — auth bypass (fastest)

```bash
# .env.development
NODE_ENV=development
DATABASE_URL=postgres://user:pass@localhost:5432/crew_database

# Disable auth on both sides
AUTH_BYPASS=true
VITE_AUTH_BYPASS=true

VITE_CLIENT_ENCRYPTION_KEY=devkey
```

### 7.2 Local standalone dev — real login

```bash
# .env.development
NODE_ENV=development
DATABASE_URL=postgres://user:pass@localhost:5432/crew_database
SESSION_SECRET=change-me-in-prod

# Real JWTs — set both, must differ
JWT_SECRET=$(openssl rand -hex 48)
JWT_REFRESH_SECRET=$(openssl rand -hex 48)
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
BCRYPT_ROUNDS=12

# Client
VITE_AUTH_MODE=standalone
VITE_CLIENT_ENCRYPTION_KEY=sailAdmin
```

### 7.3 Parent-mode build / deploy

```bash
NODE_ENV=production
DATABASE_URL=postgres://…
MASTER_DATABASE_URL=postgres://…
SESSION_SECRET=…

# JWT_SECRET MUST equal the parent SAIL Audits app's JWT_SECRET
JWT_SECRET=<shared-with-parent>
JWT_REFRESH_SECRET=<distinct-from-JWT_SECRET>

# Client
VITE_AUTH_MODE=parent
VITE_PARENT_LOGIN_URL=https://erp.example.com/login
VITE_CLIENT_ENCRYPTION_KEY=<must-match-parent>
```

---

## 8. Sequence diagrams

### 8.1 Standalone login

```mermaid
sequenceDiagram
  participant U as User
  participant C as Crewing SPA
  participant S as Crewing API
  participant DB as Postgres

  U->>C: open /any-protected-route
  C->>C: getAuthToken() → null
  C-->>U: <Redirect to=/login?next=…>
  U->>C: submit username/crewId + password + domain
  C->>S: POST /api/v2/auth/login
  S->>DB: lookup user (username, then crew_id)
  S->>S: bcrypt.compare(password, hash)
  S->>S: signAccessToken / signRefreshToken
  S->>DB: insert refresh_tokens (sha256, parent=null)
  S->>DB: audit login success, reset lockout
  S-->>C: {accessToken, refreshToken, user, tenantId}
  C->>C: setAuthSession() (AES → sessionStorage/localStorage)
  C-->>U: navigate to ?next= or /
```

### 8.2 Authenticated request + silent refresh

```mermaid
sequenceDiagram
  participant C as Crewing SPA
  participant S as Crewing API
  participant DB as Postgres

  C->>S: GET /api/v2/whatever  (Bearer access, x-tenant-id)
  S->>S: jwt.verify(access, JWT_SECRET)
  S->>S: tenant binding (domain ↔ tuid)
  S-->>C: 200 OK
  Note over C,S: ── access expires ──
  C->>S: GET /api/v2/whatever
  S-->>C: 401 token_expired
  C->>S: POST /api/v2/auth/refresh {refreshToken}
  S->>S: jwt.verify(refresh, JWT_REFRESH_SECRET)
  S->>DB: find by sha256(token)
  alt revoked → reuse
    S->>DB: revoke ALL active tokens for user
    S-->>C: 401 invalid_refresh
    C->>C: redirectToLogin()
  else healthy → rotate
    S->>DB: revoke old (rotated) + insert new (parent_id=old)
    S-->>C: {accessToken, refreshToken}
    C->>S: retry original request
    S-->>C: 200 OK
  end
```

### 8.3 Parent-mode handoff

```mermaid
sequenceDiagram
  participant P as Parent App
  participant C as Crewing SPA
  participant S as Crewing API

  P->>C: navigate to Crewing route (sets sessionStorage.credentials)
  C->>C: getAuthToken() → parent JSON-encoded format → decrypted JWT
  C->>S: GET /api/v2/...  (Bearer)
  S->>S: jwt.verify(token, JWT_SECRET)  // shared with parent
  S-->>C: 200 OK
  Note over C,S: ── token expires or user logs out ──
  C->>C: clearAuthSession()
  C-->>P: window.location.replace(VITE_PARENT_LOGIN_URL)
```

### 8.4 Logout + back-button BFCache eviction

```mermaid
sequenceDiagram
  participant U as User
  participant C as Crewing SPA
  participant S as Crewing API

  U->>C: click Logout
  C->>S: POST /api/v2/auth/logout {refreshToken} (keepalive)
  S->>S: revoke refresh_tokens row (reason=user_logout)
  C->>C: clearAuthSession()
  C-->>U: window.location.replace('/login')
  U->>U: press Browser Back
  Note over U,C: BFCache restore (event.persisted = true)
  C->>C: pageshow listener → no token → redirectToLogin()
  C-->>U: replace('/login')  (no flash of old page)
```

---

## 9. Token & claim reference

### 9.1 Access token claims (`AccessClaims`)

| Claim | Type | Notes |
|---|---|---|
| `id` | number | `users.id` |
| `domain` | string | tenant slug |
| `userType` | string | e.g. `Office` / `Vessel` |
| `uuid` | string? | `users.uuid` |
| `username` | string? | for logging |
| `roleId` | string? | drives RBAC lookup |
| `iat`, `exp` | number | issued/expiry, `expiresIn = JWT_ACCESS_TTL` |

### 9.2 Refresh token claims (`RefreshClaims`)

| Claim | Type | Notes |
|---|---|---|
| `id` | number | `users.id` |
| `domain` | string | tenant slug |
| `jti` | string | 16-byte random hex; ties JWT to a `refresh_tokens` row |
| `iat`, `exp` | number | `expiresIn = JWT_REFRESH_TTL` |

### 9.3 `refresh_tokens` row

`{ id, user_id, token_hash (sha256), parent_id, ip_address, user_agent, expires_at, revoked_at, revoked_reason, created_at }` — the raw token is **never** stored.

### 9.4 Client storage keys

`sessionStorage`: `credentials`, `refreshCredentials`, `crewUserName`, `crewDesignation`.
`localStorage`: `userProfile`, `crewUserId`, `domain`, `tenantId`, `tenantDomain`.

---

## 10. Error codes & client behavior

| HTTP | `error` code | Origin | What the client does |
|---|---|---|---|
| 400 | `invalid_request` | Zod parse failure | Show form-level error |
| 401 | `invalid_credentials` | login: bad user / password / locked | Show "Invalid username or password" |
| 401 | `unauthorized` | missing Bearer | `redirectToLogin()` |
| 401 | `token_expired` | access JWT expired | Single-flight refresh, then retry |
| 401 | `invalid_token` | access JWT malformed/bad-signature | `redirectToLogin()` |
| 401 | `invalid_refresh` | refresh missing / expired / reuse | `redirectToLogin()` |
| 403 | `tenant_mismatch` | JWT `domain` ≠ `x-tenant-id`'s tenant | `redirectToLogin()` |
| 409 | `username_taken` / `crewid_taken` | admin user create/update | Form field error |
| 429 | `rate_limited` | login or forgot-password limiter | Toast: "Too many attempts" |
| 500 | `server_configuration_error` | `JWT_SECRET` missing in prod | Toast: "Auth not configured" |

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Sign-in succeeds but the next API call gets `401 invalid_token`. | `JWT_SECRET` differs between the issuing and verifying processes (e.g. dev restarted with a new ephemeral secret). | Set a real, persistent `JWT_SECRET` in `.env`. |
| Logged-in users see a white screen after refresh. | `VITE_CLIENT_ENCRYPTION_KEY` changed, so AES-decrypting `credentials` returns `null`. | Use a stable key per environment. |
| Production build fails with `VITE_PARENT_LOGIN_URL is not set for production build`. | Building in parent mode without the URL. | Set `VITE_PARENT_LOGIN_URL` or set `VITE_AUTH_BYPASS=true` (dev only). |
| Repeating `403 tenant_mismatch` for one user. | The JWT `domain` claim does not resolve to the same `tuid` as the request's `x-tenant-id`. | Re-login (mints a fresh `domain` claim) or fix the tenant mapping. |
| Refresh suddenly returns `401 invalid_refresh` for everyone on a device. | A reuse was detected — the entire chain was revoked (`revoked_reason = 'reuse_detected'`). | User must re-login. Investigate token leakage. |
| After logout, pressing **Back** flashes the old screen. | BFCache restored the protected page. | Already mitigated by Task #238 (no-store + render-time guard + `pageshow` listener). |
| Server boot crashes with `JWT_REFRESH_SECRET must be different from JWT_SECRET`. | Both env vars share the same value in production. | Generate two distinct secrets. |
| Dev server logs `AUTH_BYPASS=true: JWT authentication is disabled`. | `AUTH_BYPASS=true` set in environment. | Expected in dev only — never set in production. |

---

## 12. See also

- [`docs/jwt-authentication.md`](./jwt-authentication.md) — JWT primitives and key handling.
- [`docs/jwt-authentication-flow.md`](./jwt-authentication-flow.md) — Earlier flow diagrams.
- [`docs/multitenant-token-sequence-diagram.md`](./multitenant-token-sequence-diagram.md) — Multi-tenant routing and tenant binding.
- [`docs/multitenant-production-audit-report.md`](./multitenant-production-audit-report.md) — Production audit findings.
