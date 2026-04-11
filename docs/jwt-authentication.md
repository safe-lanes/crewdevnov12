# JWT Authentication — SAIL Crewing V2

> **Implementation Status:** JWT authentication is **fully implemented**. Task #183 (backend middleware) and Task #184 (frontend token handling) are both merged and active.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Token Lifecycle](#2-token-lifecycle)
3. [SessionStorage Structure](#3-sessionstorage-structure)
4. [Frontend Authentication Flow](#4-frontend-authentication-flow)
5. [Backend Middleware Chain](#5-backend-middleware-chain)
6. [Request Pipeline](#6-request-pipeline)
7. [Error Handling & 401 Redirect](#7-error-handling--401-redirect)
8. [Exempt Routes](#8-exempt-routes)
9. [Environment Variables](#9-environment-variables)
10. [Local Development](#10-local-development)
11. [Security Considerations](#11-security-considerations)

---

## 1. Architecture Overview

The Crewing app does **not** have its own login system. Authentication is delegated entirely to the parent application (SAIL Audits). The parent app signs a JWT token with a shared secret, and the Crewing app verifies that same token.

```
┌──────────────────────┐         ┌──────────────────────┐
│    SAIL Audits       │         │   SAIL Crewing V2    │
│   (Parent App)       │         │   (This App)         │
│                      │         │                      │
│  1. User logs in     │         │  4. Read encrypted   │
│  2. Signs JWT with   │────────▶│     credentials from │
│     JWT_SECRET       │ iframe  │     sessionStorage    │
│  3. Stores encrypted │  embed  │  5. Decrypt → raw JWT│
│     JWT in           │         │  6. Send as Bearer   │
│     sessionStorage   │         │     header on every  │
│     under key        │         │     API request      │
│     "credentials"    │         │  7. Backend verifies  │
│                      │         │     with JWT_SECRET   │
└──────────────────────┘         └──────────────────────┘
```

**Key principle:** Both apps share the same `JWT_SECRET`. The parent signs tokens; the Crewing app only verifies them.

---

## 2. Token Lifecycle

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│  User logs  │    │ Parent app   │    │ Parent app   │    │ Crewing app │
│  into SAIL  │───▶│ authenticates│───▶│ encrypts JWT │───▶│ reads from  │
│  Audits     │    │ & signs JWT  │    │ with AES &   │    │ session-    │
│             │    │ using        │    │ stores in    │    │ Storage on  │
│             │    │ JWT_SECRET   │    │ sessionStorage│    │ every req   │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
                                                                 │
                                                                 ▼
                                                          ┌─────────────┐
                                                          │ Decrypt     │
                                                          │ AES → raw   │
                                                          │ JWT string  │
                                                          │             │
                                                          │ Send as:    │
                                                          │ Authorization│
                                                          │ : Bearer    │
                                                          │ <token>     │
                                                          └──────┬──────┘
                                                                 │
                                                                 ▼
                                                          ┌─────────────┐
                                                          │ Backend     │
                                                          │ verifies    │
                                                          │ JWT with    │
                                                          │ JWT_SECRET  │
                                                          │             │
                                                          │ Attaches    │
                                                          │ decoded     │
                                                          │ payload to  │
                                                          │ req.user    │
                                                          └─────────────┘
```

### Token flow step-by-step

1. User logs into the **SAIL Audits** parent app.
2. Parent app authenticates the user and signs a JWT using the shared `JWT_SECRET`.
3. Parent app encrypts the raw JWT string with **CryptoJS AES** (using the shared `VITE_CLIENT_ENCRYPTION_KEY` / `"Your-encryption-key"`).
4. Parent app stores the encrypted JWT in `sessionStorage` under the key `"credentials"`.
5. Parent app also sets additional plain-text values in `sessionStorage` (see Section 3).
6. User navigates to the Crewing module (loaded in an iframe or same origin).
7. On **every** API request, the Crewing frontend:
   - Reads `sessionStorage.getItem("credentials")` fresh (never cached).
   - Decrypts it using `getDecryptedSessionStorageItem("credentials", true)` from `encryptionService.ts`.
   - Sends the raw JWT as `Authorization: Bearer <token>` header.
8. The Crewing backend middleware:
   - Extracts the token from the `Authorization` header (or `?sail=` query param for file downloads).
   - Verifies the signature using `jwt.verify(token, JWT_SECRET)`.
   - Attaches the decoded payload to `req.user` and `req.tokenData`.
   - Proceeds to the route handler, or returns `401` if missing/invalid/expired.
   - Performs cross-tenant binding check (JWT `domain` vs `req.tenantId`).

### Why read fresh every time?

The user may re-authenticate in the parent app (e.g., session refresh, re-login in another tab). Reading from `sessionStorage` on every request ensures the Crewing app always uses the latest token without requiring a page reload.

---

## 3. SessionStorage Structure

The parent app (SAIL Audits) populates these keys in `sessionStorage` when the user logs in.

| Key | Format | Description | Used by Crewing? |
|-----|--------|-------------|------------------|
| `credentials` | Encrypted (CryptoJS AES) | Raw JWT token string | **Yes** — decrypted and sent as Bearer token |
| `crewUserName` | Plain text | Display name of the logged-in user | **Yes** — used in form "Prepared By" fields |
| `crewDesignation` | Plain text | Rank/position of the user | **Yes** — used in form headers |
| `crewUserRole` | Plain text | User's role name | Not currently used |
| `crewUserType` | Plain text | User type classification | Not currently used |
| `crewingAccess` | Plain text (`"granted"`) | Whether user has Crewing module access | Not currently used |

**Note on `crewUserId`:** This value is set by the parent app in **`localStorage`** (not `sessionStorage`), and is read by the Crewing app from `localStorage.getItem("crewUserId")` across all V2 modules for audit trails and API calls.

### Encryption details

The `credentials` value is encrypted by the parent app using:

```
CryptoJS.AES.encrypt(JSON.stringify(rawJwtString), VITE_CLIENT_ENCRYPTION_KEY).toString()
```

**The parent app `JSON.stringify`s the JWT before encrypting it.** This means the decrypted value is a JSON-encoded string — the raw JWT wrapped in escaped double quotes:

```
"\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywiZG9tYWluIjoic2xkZW1vIi...uitQ\""
```

After decryption, `JSON.parse()` must be called to unwrap the quotes and get the clean JWT string.

The Crewing app handles this via `getDecryptedSessionStorageItem("credentials", true)` with `isParse = true`, which performs both AES decryption and JSON parsing automatically:

```typescript
// client/src/lib/authToken.ts
import { getDecryptedSessionStorageItem } from "./encryptionService";

export function getAuthToken(): string | null {
  const decrypted = getDecryptedSessionStorageItem("credentials", true);
  if (typeof decrypted === "string" && decrypted.length > 0) {
    return decrypted;
  }
  return null;
}
```

---

## 4. Frontend Authentication Flow

### 4.1 Startup Auth Check

On app load, `App.tsx` checks whether authentication is required and whether valid credentials exist:

```
┌──────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  App.tsx loads    │────▶│ isAuthRequired()?    │────▶│ VITE_AUTH_BYPASS    │
│                  │     │ (checks if           │     │ === "true"?         │
│                  │     │ VITE_AUTH_BYPASS is   │     │                     │
│                  │     │ set)                  │     │                     │
└──────────────────┘     └─────────────────────┘     └────────┬────────────┘
                                                               │
                                                         Yes   │   No
                                                         ┌─────┘   └──────┐
                                                         ▼                ▼
                                                  ┌──────────┐    ┌─────────────┐
                                                  │ Skip auth│    │ getAuthToken│
                                                  │ → render │    │ returns     │
                                                  │ app      │    │ valid JWT?  │
                                                  └──────────┘    └──────┬──────┘
                                                                         │
                                                                   Yes   │   No
                                                                   ┌─────┘   └──────┐
                                                                   ▼                ▼
                                                            ┌──────────┐    ┌──────────────┐
                                                            │ Continue  │    │ Redirect to  │
                                                            │ to tenant │    │ parent login │
                                                            │ init flow │    │ URL with     │
                                                            └──────────┘    │ ?redirect=   │
                                                                            └──────────────┘
```

**Key decision:** `isAuthRequired()` returns `false` only when `VITE_AUTH_BYPASS=true` is set. Otherwise, auth is always required — if no token exists, the app redirects to the parent login URL.

`App.tsx` delegates to `AuthenticatedApp` (which contains hooks like `useTenantInit()`) to avoid conditional hook calls.

### 4.2 API Request Pipeline

Authorization headers are injected at three layers for complete coverage:

#### Layer 1: Global fetch interceptor (`tenantFetch.ts`)

Intercepts **all** `fetch()` calls to `/api/*` and injects both `x-tenant-id` and `Authorization: Bearer` headers:

```typescript
// client/src/lib/tenantFetch.ts
window.fetch = function (input, init = {}) {
  if (url.startsWith("/api")) {
    const headers = new Headers(init.headers);
    const tenantId = localStorage.getItem("tenantId");
    if (tenantId) headers.set("x-tenant-id", tenantId);
    const token = getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    init = { ...init, headers };
  }
  return originalFetch(input, init).then((response) => {
    if (response.status === 401 && url.startsWith("/api")) {
      handleUnauthorized(); // Redirects to parent login
    }
    return response;
  });
};
```

#### Layer 2: TanStack Query client (`queryClient.ts`)

Both `apiRequest()` and `getQueryFn()` explicitly add the Authorization header:

```typescript
// client/src/lib/queryClient.ts
const token = getAuthToken();
if (token) headers["Authorization"] = `Bearer ${token}`;
```

The query client does **not** handle 401 redirects — that responsibility is centralized in the fetch interceptor (Layer 1). The query client only throws on non-OK responses.

#### Layer 3: HTTP utility (`http.ts`)

Calls `fetch()` directly, so it's covered by the `tenantFetch.ts` interceptor. No separate changes needed.

### 4.3 Files that make API requests

| Layer | File | Mechanism | Auth Header |
|-------|------|-----------|-------------|
| Global interceptor | `client/src/lib/tenantFetch.ts` | Patches `window.fetch` | Injected for all `/api/*` |
| Query client | `client/src/lib/queryClient.ts` | `apiRequest()`, `getQueryFn()` | Explicit header |
| HTTP utility | `client/src/utils/http.ts` | `api()`, `get()`, `post()`, etc. | Covered by interceptor |
| Auth utility | `client/src/lib/authToken.ts` | `getAuthToken()`, `redirectToLogin()` | Token source |
| Module APIs | `client/src/modules/*/api/*.ts` | Use `apiRequest` or `http` utilities | Inherited |
| Hooks | `client/src/hooks/useExternal*.tsx` | Use `useQuery` with `queryClient` | Inherited |
| Tenant init | `client/src/hooks/useTenantInit.ts` | Direct `fetch()` to `/api/v2/tenant/init` | Exempt route |

---

## 5. Backend Middleware Chain

Requests pass through middleware in this order (from `server/index.ts`):

```
Incoming request
       │
       ▼
  ┌────────────────────────────┐
  │ 1. Body Parsing            │  express.json(), express.urlencoded()
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 2. Rate Limiting           │  apiLimiter (200/min for /api/*)
  │                            │  tenantInitLimiter (15/min for /api/v2/tenant/init)
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 3. Logging                 │  Logs method, path, status, duration
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 4. Tenant Middleware       │  Validates x-tenant-id header
  │    tenantMiddleware.ts     │  Sets req.tenantId
  │                            │  Switches DB context via runInTenantContext()
  │                            │  JWT domain fallback if x-tenant-id missing
  │                            │
  │    Exempt:                 │  Shared isExempt() from exemptPaths.ts
  │                            │  /api/v2/tenant/init, /api/health,
  │                            │  all non-/api/v2/ routes
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 5. Auth Middleware         │  Reuses req.tokenData if already verified by
  │    authMiddleware.ts       │  tenant middleware (JWT domain fallback path)
  │                            │  Otherwise: extracts Bearer token (or ?sail=)
  │                            │  and verifies with jwt.verify(token, JWT_SECRET)
  │                            │  Attaches decoded payload to req.user & req.tokenData
  │                            │  Cross-tenant binding check (JWT domain vs tenantId)
  │                            │  Skips binding if req.jwtDomain already matches
  │                            │  Returns 401 if missing/invalid/expired
  │                            │  Returns 403 if tenant mismatch
  │                            │  Returns 500 if tenantId missing in production
  │                            │
  │    Exempt:                 │  Shared isExempt() from exemptPaths.ts
  │                            │
  │    Dev mode:               │  If JWT_SECRET not set + AUTH_BYPASS=true,
  │                            │  auth is bypassed (next())
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 6. Route Handlers          │  V2 routes, legacy routes, health check
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 7. Error Handler           │  Catches all errors, returns JSON
  └────────────────────────────┘
```

### Auth middleware placement rationale

1. Tenant context is established first (DB connection switched).
2. Then the user's identity is verified via JWT.
3. After JWT verification, a cross-tenant binding check confirms the JWT `domain` matches the resolved tenant — prevents token from tenant A accessing tenant B's data.
4. If JWT is invalid, the request is rejected with `401` before reaching any route handler.

### Shared exempt paths

Both middleware use a single shared `isExempt()` function from `server/middleware/exemptPaths.ts`. This ensures route exemptions are always in sync — adding a new exempt route only requires updating one file.

### Single JWT verification per request

When the JWT domain fallback path is used (no `x-tenant-id` header), the tenant middleware verifies the JWT to extract the domain and attaches the decoded payload to `req.tokenData`. The auth middleware detects this and reuses the existing payload instead of calling `jwt.verify()` a second time. This ensures exactly one JWT verification per request regardless of the code path.

### Tenant middleware JWT domain fallback

When `x-tenant-id` header is missing, the tenant middleware attempts to extract the `domain` field from the JWT and resolve the tenant from it. This enables scenarios like file downloads where headers can't easily be set. On the fallback path, the middleware also sets `req.jwtDomain` to record which domain was used for tenant resolution. The fallback distinguishes between:
- Missing token → `400 Missing x-tenant-id header`
- Expired token → `401 token_expired`
- Invalid token → `401 invalid_token`
- Valid token with domain → resolves tenant from domain, sets `req.jwtDomain`

### Cross-tenant binding check

After JWT verification, `authMiddleware` performs a tenant binding check:
- If `req.jwtDomain` is set and matches the JWT `domain`, the binding is already proven by tenant middleware — no additional lookup needed.
- Otherwise, resolves the JWT `domain` to a tenant ID via the master database and compares against `req.tenantId`.
- Rejects with `403 tenant_mismatch` if they don't match.
- In production, if `req.tenantId` is missing when multi-tenant is enabled, rejects with `500 server_configuration_error` (indicates a middleware ordering bug) rather than silently skipping the check.

### `?sail=` query parameter for file downloads

Any `/api/v2/` route whose path contains a file-serving segment (`/download`, `/attachment`, `/attachments`, `/document`, `/documents`, `/file`, `/files`) accepts the JWT as a `?sail=<token>` query parameter. This supports scenarios like PDF downloads or document previews where setting an Authorization header isn't possible (e.g., `<a href>` links, `<img src>` tags). Detection is dynamic — no module-specific prefix list is needed.

### JWT payload type

```typescript
// server/middleware/authMiddleware.ts
export interface JwtPayload {
  id: number;
  domain: string;
  userType: string;
  iat?: number;
  exp?: number;
}

// Available on req.user and req.tokenData after auth middleware
```

---

## 6. Request Pipeline

### Request lifecycle (end to end)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                     │
│                                                                      │
│  Component calls:  apiRequest("GET", "/api/v2/crew-pool/profiles")  │
│                           │                                          │
│                           ▼                                          │
│  queryClient.ts:  builds headers { x-tenant-id, Authorization }     │
│                           │                                          │
│                           ▼                                          │
│  tenantFetch.ts:  intercepts fetch(), ensures x-tenant-id +         │
│                   Authorization headers are set                      │
│                           │                                          │
└───────────────────────────┼──────────────────────────────────────────┘
                            │ HTTP Request
                            │ Headers:
                            │   x-tenant-id: <tuid>
                            │   Authorization: Bearer <jwt>
                            │   Content-Type: application/json
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         BACKEND                                      │
│                                                                      │
│  1. Rate limiter    → pass                                           │
│  2. Logger          → logs request                                   │
│  3. tenantMiddleware→ validates x-tenant-id, sets req.tenantId,     │
│                       switches to tenant DB context                  │
│                       (or resolves tenant from JWT domain fallback)  │
│  4. authMiddleware  → extracts Bearer token, verifies JWT,           │
│                       sets req.user = { id, domain, userType, ... } │
│                       cross-tenant binding check                     │
│  5. Route handler   → processes request using req.tenantId +        │
│                       req.user context                               │
│                           │                                          │
│                           ▼                                          │
│  Response: 200 OK  { data: [...] }                                  │
│       or:  401     { error: "unauthorized" }                         │
│       or:  401     { error: "token_expired" }                        │
│       or:  401     { error: "invalid_token" }                        │
│       or:  403     { error: "tenant_mismatch" }                      │
│       or:  400     { error: "Missing x-tenant-id header" }          │
│       or:  403     { error: "invalid_tenant" }                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Error Handling & 401 Redirect

### Backend error responses

| Status | Error Code | Condition | Middleware |
|--------|-----------|-----------|------------|
| `401` | `unauthorized` | No `Authorization` header (or no `JWT_SECRET` in production) | authMiddleware |
| `401` | `token_expired` | JWT has expired | authMiddleware / tenantMiddleware (fallback) |
| `401` | `invalid_token` | JWT signature or format is invalid | authMiddleware / tenantMiddleware (fallback) |
| `403` | `tenant_mismatch` | JWT domain doesn't match resolved tenant | authMiddleware |
| `400` | `Missing x-tenant-id` | No tenant ID header and no JWT domain fallback available | tenantMiddleware |
| `403` | `invalid_tenant` | Tenant ID not found in master database | tenantMiddleware |
| `403` | `tenant_inactive` | Tenant account is inactive or deleted | tenantMiddleware |
| `500` | `server_configuration_error` | `JWT_SECRET` not set in production (non-dev), or tenant context missing in production multi-tenant | authMiddleware |

### Frontend 401 handling

401 redirect handling is centralized in a single layer:

1. **Global fetch interceptor** (`tenantFetch.ts`): Catches 401 on all `/api` responses and calls `handleUnauthorized()`.
2. **Auth utility** (`authToken.ts`): `handleUnauthorized()` calls `redirectToLogin()`, which redirects to:

```
VITE_PARENT_LOGIN_URL + "?redirect=" + encodeURIComponent(window.location.href)
```

A `redirecting` flag prevents redirect storms when multiple concurrent API calls all return 401.

The query client (`queryClient.ts`) does **not** handle 401 redirects — it only builds headers and throws on non-OK responses. This single-pass design ensures the redirect fires exactly once per 401, regardless of how many API layers process the response.

### No standalone login page

The Crewing app does **not** have its own login page. Users always authenticate through the parent app (SAIL Audits). If a token is missing or expired, the user is redirected back to the parent login.

---

## 8. Exempt Routes

These routes do **not** require a JWT token or tenant ID:

| Route | Purpose | Exempt from Tenant? | Exempt from Auth? |
|-------|---------|--------------------|--------------------|
| `GET /api/health` | Health check endpoint | Yes | Yes |
| `POST /api/v2/tenant/init` | Resolves domain → tenant ID | Yes | Yes |
| `GET /api/crew-members` | Legacy crew list | Yes (non-v2) | Yes (non-v2) |
| `* /api/pay-elements` | Legacy pay elements | Yes (non-v2) | Yes (non-v2) |
| `* /api/contract-pay-elements` | Legacy contract elements | Yes (non-v2) | Yes (non-v2) |

**Rule:** All routes starting with `/api/v2/` require both tenant ID and JWT, **except** `/api/v2/tenant/init` which is explicitly exempted. All legacy routes (not starting with `/api/v2/`) are exempted from both checks.

### V2 routes that require authentication

| Route prefix | Module |
|-------------|--------|
| `/api/v2/recruitment` | Recruitment (candidates, screening) |
| `/api/v2/crew-pool` | Crew profiles, documents, assignments |
| `/api/v2/vessel` | Vessel planning and revisions |
| `/api/v2/rotation` | Rotation drafts and proposals |
| `/api/v2/ports` | Port search and details |
| `/api/v2/rest-hours` | Daily rest hour records |
| `/api/v2/drugs-alcohol` | Drug & alcohol test records |
| `/api/v2/admin` | Access control, company ranks |
| `/api/v2/masters` | Master data management |
| `/api/v2/promotions` | Promotion reviews and criteria |
| `/api/v2/appraisals` | Appraisal results and assessments |

---

## 9. Environment Variables

### Auth-related environment variables

```bash
# Backend: Shared secret for JWT token verification (must match parent SAIL Audits app)
JWT_SECRET="your-jwt-signing-secret"

# Backend: Explicit auth bypass for development (ignored in production)
AUTH_BYPASS="true"

# Frontend: Parent app login URL for 401 redirect
VITE_PARENT_LOGIN_URL="https://dev.sl-sail.com/login"

# Frontend: Explicit auth bypass for development (skips login redirect and token checks)
VITE_AUTH_BYPASS="true"

# Frontend: AES key for decrypting credentials from sessionStorage (must match parent app)
VITE_CLIENT_ENCRYPTION_KEY="Your-encryption-key"
```

### Variable reference

#### Backend variables (`process.env.*`)

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes (production) | Shared secret for JWT verification. Must match the parent app. If not set, the server refuses to start unless `AUTH_BYPASS=true` in development. |
| `AUTH_BYPASS` | No | Set to `"true"` to skip JWT verification in development. **Ignored in production** (`NODE_ENV !== "development"`). If `JWT_SECRET` is not set and `AUTH_BYPASS` is not `"true"`, the server throws a startup error. |
| `DATABASE_URL` | Yes | Primary database connection |
| `MASTER_DATABASE_URL` | Yes (multi-tenant) | Master database for tenant resolution |
| `NODE_ENV` | Yes | Environment mode (`development` or `production`) |

#### Frontend variables (`import.meta.env.*`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PARENT_LOGIN_URL` | Yes (production) | Parent app login URL for 401 redirect. Required for production builds unless `VITE_AUTH_BYPASS=true`. |
| `VITE_AUTH_BYPASS` | No | Set to `"true"` to skip frontend auth gating (no login redirect, no token checks). Production Vite builds fail if neither `VITE_PARENT_LOGIN_URL` nor `VITE_AUTH_BYPASS=true` is set. |
| `VITE_CLIENT_ENCRYPTION_KEY` | Yes | AES key for decrypting `credentials` from sessionStorage. Must match the parent app. |
| `VITE_API_BASE_URL` | Yes | Parent app API base URL |

---

## 10. Local Development

### How local dev works without JWT

Authentication bypass is **explicit** — you must opt in by setting environment variables. The system never silently disables auth based on the absence of configuration.

#### Backend: `AUTH_BYPASS=true`

When `JWT_SECRET` is not set, the server requires an explicit bypass flag:
- If `AUTH_BYPASS=true` and `NODE_ENV=development`: auth middleware calls `next()` — requests pass through without token validation. A warning is logged: `"⚠️ AUTH_BYPASS=true: JWT authentication is disabled. Do NOT use in production."`
- If `AUTH_BYPASS` is not `"true"` and `JWT_SECRET` is not set: the server **throws a startup error** and refuses to start, with a message explaining the options.
- `AUTH_BYPASS` is **ignored in production** (`NODE_ENV !== "development"`) — production always requires `JWT_SECRET`.

#### Frontend: `VITE_AUTH_BYPASS=true`

When `VITE_AUTH_BYPASS=true`:
- `isAuthRequired()` returns `false` — no startup auth check, no login redirect.
- `getAuthToken()` returns `null` — no Authorization header is attached to requests.
- The app loads and works normally without credentials in sessionStorage.

When `VITE_AUTH_BYPASS` is not `"true"`, auth is required regardless of whether `VITE_PARENT_LOGIN_URL` is set. If auth is required but no token exists, the app attempts to redirect to the parent login URL.

#### Vite build-time validation

Production Vite builds (`npm run build`) fail if `VITE_PARENT_LOGIN_URL` is not set and `VITE_AUTH_BYPASS` is not `"true"`. This prevents accidentally deploying a build that cannot redirect users to login.

#### Summary of local dev behavior

| `JWT_SECRET` set? | `AUTH_BYPASS` | `VITE_AUTH_BYPASS` | Behavior |
|-------------------|--------------|---------------------|----------|
| No | `true` | `true` | **Full bypass** — no auth on frontend or backend |
| No | `true` | Not set | Backend bypasses auth, frontend requires auth (redirect) |
| No | Not set | N/A | **Server refuses to start** — startup error |
| Yes | N/A | `true` | Backend validates tokens, frontend skips auth gating |
| Yes | N/A | Not set | **Full auth** — same as production |
| No (prod) | N/A | N/A | **Server refuses to start** — `JWT_SECRET` required |
| Yes (prod) | N/A | Not set | **Production mode** — full authentication enforced |

### Testing JWT locally

If you want to test JWT locally:

1. Set `JWT_SECRET` in your environment to match the parent app's secret.
2. Set `VITE_PARENT_LOGIN_URL` to a valid URL (or any placeholder to enable auth checks).
3. Manually create a token for testing:

```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: 3, domain: 'sldemo', userType: 'Admin' },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);
console.log(token);
```

4. Set the encrypted token in the browser's `sessionStorage`:

```javascript
// In browser console — with encryption (matches production behavior)
const CryptoJS = (await import('crypto-js')).default;
const encrypted = CryptoJS.AES.encrypt(JSON.stringify('<paste-jwt-here>'), 'Your-encryption-key').toString();
sessionStorage.setItem('credentials', encrypted);
```

Or for quick testing without encryption (won't work with `getAuthToken()` but useful for direct API calls):

```bash
# curl with Bearer token directly
curl -H "Authorization: Bearer <jwt-token>" -H "x-tenant-id: <tuid>" http://localhost:5000/api/v2/crew-pool/crew
```

### Testing 401 behavior

1. Start the app with `JWT_SECRET` set and `VITE_PARENT_LOGIN_URL` set.
2. Don't set `credentials` in sessionStorage → app should redirect to login URL.
3. Make an API call without a token → should get `401`.
4. Make an API call with an expired token → should get `401` with `token_expired`.
5. Make an API call with a valid token → should get `200`.

---

## 11. Security Considerations

### Token storage

- The JWT is stored in `sessionStorage` (not `localStorage`), so it is scoped to the browser tab and cleared when the tab is closed.
- The token is encrypted with AES before storage, adding a layer of obfuscation (though `sessionStorage` is already inaccessible to other origins).

### Cross-tenant protection

The auth middleware performs a **tenant binding check** after JWT verification:
- If the tenant was resolved via JWT domain fallback (`req.jwtDomain` set), the binding is already proven — no additional DB lookup needed.
- Otherwise, resolves the JWT `domain` field to a tenant ID via the master database and compares against `req.tenantId`.
- Rejects with `403 tenant_mismatch` if they don't match.
- In production with multi-tenant enabled, if `req.tenantId` is missing at the auth stage, rejects with `500` (safety net for middleware ordering bugs).
- This prevents a valid token for company A from accessing company B's data.

### `?sail=` query parameter security

- The `?sail=<token>` query parameter is only accepted on **file-serving routes** — any `/api/v2/` path containing `/download`, `/attachment`, `/attachments`, `/document`, `/documents`, `/file`, or `/files`.
- This scoping prevents token leakage via URL logging, browser history, or referrer headers on regular API calls.
- Detection is dynamic based on path segments — no hardcoded module prefix list is needed. New modules with file endpoints are automatically supported.

### Fail-closed design

- **Production:** If `JWT_SECRET` is not set, the server refuses to start. The system never silently allows unauthenticated access in production.
- **Development:** Auth bypass requires explicit `AUTH_BYPASS=true` env var. Without it, missing `JWT_SECRET` causes a startup error. This is logged as a warning when active.
- **Frontend:** Auth is required by default. Only `VITE_AUTH_BYPASS=true` disables the auth gate. Production builds fail if `VITE_PARENT_LOGIN_URL` is missing (unless `VITE_AUTH_BYPASS=true`).

### Shared secret management

- The `JWT_SECRET` must be kept confidential and rotated periodically.
- Both the parent app and the Crewing app must be updated simultaneously when the secret changes.
- In production, use a strong, randomly generated secret (minimum 256 bits / 32 characters).

### Token expiration

- Token expiry is set by the parent app when signing the JWT (typically 8-24 hours).
- The Crewing backend relies on `jwt.verify()` to reject expired tokens automatically.
- The Crewing app does **not** refresh tokens — when a token expires, the user is redirected to the parent login page to re-authenticate.

### No token refresh mechanism

There is no refresh token flow. The design assumes:
- Users work within a single session (8-hour shift typical for maritime crew management).
- If the token expires mid-session, re-login via the parent app is acceptable.
- The parent app may update the token in `sessionStorage` transparently if it has its own refresh logic.

### CORS and same-origin

- The Crewing app is served from the same domain as the parent app (or as an iframe within it).
- `sessionStorage` is shared when the origin matches, allowing the parent's token to be read by the Crewing app.
- `credentials: "include"` is set on fetch requests to forward cookies if needed.

### JWT payload structure

The parent app includes these fields in the JWT:

```json
{
  "id": 3,
  "domain": "sldemo",
  "userType": "Admin",
  "iat": 1712800000,
  "exp": 1712828800
}
```

The `domain` field is used for cross-tenant binding verification and as a fallback for tenant resolution when `x-tenant-id` header is missing.

### Implementation files

| File | Purpose |
|------|---------|
| `server/middleware/exemptPaths.ts` | Shared exempt path definitions used by both middleware |
| `server/middleware/authMiddleware.ts` | Backend JWT verification, tenant binding, `?sail=` support |
| `server/middleware/tenantMiddleware.ts` | Tenant resolution with JWT domain fallback |
| `client/src/lib/authToken.ts` | Token decryption, auth state, redirect logic |
| `client/src/lib/tenantFetch.ts` | Global fetch interceptor (headers + 401 redirect) |
| `client/src/lib/queryClient.ts` | Query client auth header injection |
| `client/src/lib/encryptionService.ts` | AES decryption utility |
| `client/src/App.tsx` | Startup auth gate |
