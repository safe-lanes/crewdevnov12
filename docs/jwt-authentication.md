# JWT Authentication — SAIL Crewing V2

> **Implementation Status:** This document describes the **target JWT authentication design** for the Crewing V2 app. Sections clearly mark what is currently implemented vs. what is planned (Task #183: backend middleware, Task #184: frontend token handling). Where the current state differs from the target, it is noted explicitly.

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
3. Parent app encrypts the raw JWT string with **CryptoJS AES** (using the shared `VITE_CLIENT_ENCRYPTION_KEY` / `"sailAdmin"`).
4. Parent app stores the encrypted JWT in `sessionStorage` under the key `"credentials"`.
5. Parent app also sets additional plain-text values in `sessionStorage` (see Section 3).
6. User navigates to the Crewing module (loaded in an iframe or same origin).
7. **[PLANNED — Task #184]** On **every** API request, the Crewing frontend:
   - Reads `sessionStorage.getItem("credentials")` fresh (never cached).
   - Decrypts it using `CryptoJS.AES.decrypt(encrypted, secretKey)` where `secretKey = VITE_CLIENT_ENCRYPTION_KEY`.
   - Sends the raw JWT as `Authorization: Bearer <token>` header.
8. **[PLANNED — Task #183]** The Crewing backend middleware:
   - Extracts the token from the `Authorization` header.
   - Verifies the signature using `jwt.verify(token, JWT_SECRET)`.
   - Attaches the decoded payload to `req.user`.
   - Proceeds to the route handler, or returns `401` if invalid/expired.

### Why read fresh every time?

The user may re-authenticate in the parent app (e.g., session refresh, re-login in another tab). Reading from `sessionStorage` on every request ensures the Crewing app always uses the latest token without requiring a page reload.

---

## 3. SessionStorage Structure

The parent app (SAIL Audits) populates these keys in `sessionStorage` when the user logs in. This is the **current** behavior of the parent app — these values already exist in the browser when the Crewing module loads.

| Key | Format | Description | Used by Crewing? |
|-----|--------|-------------|------------------|
| `credentials` | Encrypted (CryptoJS AES) | Raw JWT token string | **Planned** — will be decrypted and sent as Bearer token |
| `crewUserName` | Plain text | Display name of the logged-in user | **Yes (current)** — used in form "Prepared By" fields |
| `crewDesignation` | Plain text | Rank/position of the user | **Yes (current)** — used in form headers |
| `crewUserId` | Plain text (stored in localStorage) | Unique user identifier | **Yes (current)** — used across all V2 modules for audit trails |
| `crewUserRole` | Plain text | User's role name | Not currently used |
| `crewUserType` | Plain text | User type classification | Not currently used |
| `crewingAccess` | Plain text (`"granted"`) | Whether user has Crewing module access | Not currently used |

### Encryption details

The `credentials` value is encrypted by the parent app using:

```
CryptoJS.AES.encrypt(rawJwtString, VITE_CLIENT_ENCRYPTION_KEY).toString()
```

Decryption in the Crewing app can use the existing `encryptionService.ts` (already implemented):

```typescript
// client/src/lib/encryptionService.ts (EXISTS)
import CryptoJS from 'crypto-js';
const secretKey = import.meta.env.VITE_CLIENT_ENCRYPTION_KEY || '';

// Decrypt the credentials
const encrypted = sessionStorage.getItem('credentials');
const decryptedBytes = CryptoJS.AES.decrypt(encrypted, secretKey);
const rawJwt = decryptedBytes.toString(CryptoJS.enc.Utf8);
```

**Important note:** The existing helper `getDecryptedSessionStorageItem('credentials')` from `encryptionService.ts` internally calls `decryptData()`, which attempts `JSON.parse()` on the result. Since the JWT is a raw string (not JSON), a dedicated auth utility should handle decryption to avoid parse errors. This will be addressed in Task #184.

---

## 4. Frontend Authentication Flow

### 4.1 Current State

The frontend currently has **no authentication check**. The app startup flow is:

1. `App.tsx` loads.
2. `useTenantInit()` hook runs — resolves domain from localStorage, calls `/api/v2/tenant/init` to get tenant ID.
3. If tenant resolution succeeds, the app renders normally.
4. If tenant resolution fails, a `TenantErrorPopup` is shown.
5. **No token check, no Bearer header, no 401 redirect.**

### 4.2 Target State (Task #184)

```
┌──────────────────┐     ┌─────────────────┐     ┌────────────────────┐
│  App.tsx loads    │────▶│ Check for token │────▶│ Token exists?      │
│                  │     │ in sessionStorage│     │                    │
└──────────────────┘     └─────────────────┘     └────────┬───────────┘
                                                          │
                                                    Yes   │   No
                                                    ┌─────┘   └──────┐
                                                    ▼                ▼
                                             ┌──────────┐    ┌──────────────┐
                                             │ Continue  │    │ Redirect to  │
                                             │ to tenant │    │ parent login │
                                             │ init flow │    │ URL          │
                                             └──────────┘    └──────────────┘
```

On startup, before `useTenantInit()` runs, the app will check for a valid token in `sessionStorage`. If no token is found, the user will be redirected to the parent app's login page:

```
VITE_PARENT_LOGIN_URL + "?redirect=" + encodeURIComponent(window.location.href)
```

### 4.3 API Request Pipeline

There are three paths through which API requests are currently made. All three will need the `Authorization` header added:

#### Path 1: Global fetch interceptor (`tenantFetch.ts`)

This intercepts **all** `fetch()` calls to `/api/*` and injects headers. This is the primary mechanism.

**Current code** (`client/src/lib/tenantFetch.ts`):
```typescript
// EXISTS — currently only injects x-tenant-id
const originalFetch = window.fetch.bind(window);

window.fetch = function (input, init = {}) {
  const tenantId = localStorage.getItem("tenantId");
  if (tenantId) {
    let url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api")) {
      const headers = new Headers(init.headers);
      headers.set("x-tenant-id", tenantId);
      init = { ...init, headers };
    }
  }
  return originalFetch(input, init);
};
```

**Planned change (Task #184):** Add `Authorization: Bearer <token>` alongside the existing `x-tenant-id` header.

#### Path 2: TanStack Query client (`queryClient.ts`)

Used by most V2 modules via `useQuery` / `useMutation`. Both `apiRequest()` and `getQueryFn()` build their own headers.

**Current code** (`client/src/lib/queryClient.ts`):
```typescript
// EXISTS — currently only sets x-tenant-id and credentials: "include"
export async function apiRequest(method, url, data?) {
  const tenantId = localStorage.getItem("tenantId");
  const headers = {};
  if (data) headers["Content-Type"] = "application/json";
  if (tenantId) headers["x-tenant-id"] = tenantId;
  // No Authorization header yet
  const res = await fetch(url, { method, headers, body: ..., credentials: "include" });
  ...
}
```

**Planned change (Task #184):** Add `Authorization: Bearer <token>` header in both `apiRequest()` and `getQueryFn()`.

**Note:** Even though `queryClient.ts` calls `fetch()` (which goes through the interceptor), it also sets headers explicitly. Both places should add the Authorization header for consistency.

#### Path 3: HTTP utility (`http.ts`)

A secondary API client used by some components. Calls `fetch()` directly, so it goes through the `tenantFetch.ts` interceptor.

**Current code** (`client/src/utils/http.ts`):
```typescript
// EXISTS — calls fetch() which is intercepted by tenantFetch.ts
export async function api(input, init?) {
  const response = await fetch(input, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  ...
}
```

**No separate changes needed in `http.ts`** — the interceptor handles it. However, if the interceptor is ever bypassed, `http.ts` should have its own header injection as a safety net.

### 4.4 Files that make API requests

| Layer | File | Mechanism | Status |
|-------|------|-----------|--------|
| Global interceptor | `client/src/lib/tenantFetch.ts` | Patches `window.fetch` | Exists — needs auth header |
| Query client | `client/src/lib/queryClient.ts` | `apiRequest()`, `getQueryFn()` | Exists — needs auth header |
| HTTP utility | `client/src/utils/http.ts` | `api()`, `get()`, `post()`, `patch()`, `del()` | Exists — covered by interceptor |
| Module APIs | `client/src/modules/*/api/*.ts` | Use `apiRequest` or `http` utilities | No changes needed |
| Hooks | `client/src/hooks/useExternal*.tsx` | Use `useQuery` with `queryClient` | No changes needed |
| Tenant init | `client/src/hooks/useTenantInit.ts` | Direct `fetch()` to `/api/v2/tenant/init` | Exempt — no auth needed |

---

## 5. Backend Middleware Chain

### Current State

Requests currently pass through middleware in this order (from `server/index.ts`):

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
  │ 4. Tenant Middleware       │  Validates x-tenant-id header       [EXISTS]
  │    tenantMiddleware.ts     │  Sets req.tenantId
  │                            │  Switches DB context via runInTenantContext()
  │                            │
  │    Exempt:                 │  /api/v2/tenant/init, /api/health,
  │                            │  all non-/api/v2/ routes (legacy)
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 5. Route Handlers          │  V2 routes, legacy routes, health check
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 6. Error Handler           │  Catches all errors, returns JSON
  └────────────────────────────┘
```

**No authentication middleware exists today.** All V2 routes are accessible to anyone who provides a valid `x-tenant-id` header.

### Target State (Task #183)

A new auth middleware will be inserted **after** tenant middleware:

```
  ...
  ┌────────────────────────────┐
  │ 4. Tenant Middleware       │  [EXISTS]
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 5. Auth Middleware         │  [PLANNED — Task #183]
  │    authMiddleware.ts       │  Extracts Bearer token from Authorization header
  │                            │  Verifies JWT with jwt.verify(token, JWT_SECRET)
  │                            │  Attaches decoded payload to req.user
  │                            │  Returns 401 if missing/invalid/expired
  │                            │
  │    Exempt:                 │  /api/v2/tenant/init, /api/health,
  │                            │  all non-/api/v2/ routes (legacy)
  └────────────┬───────────────┘
               │
               ▼
  ┌────────────────────────────┐
  │ 6. Route Handlers          │
  └────────────────────────────┘
```

### Auth middleware placement rationale

1. Tenant context is established first (DB connection switched).
2. Then the user's identity is verified via JWT.
3. If JWT is invalid, the request is rejected with `401` before reaching any route handler.

### Planned auth middleware pseudocode

```typescript
// server/middleware/authMiddleware.ts [PLANNED — Task #183]
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const EXEMPT_PATHS = ['/api/v2/tenant/init', '/api/health'];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some(p => path === p)) return true;
  if (!path.startsWith('/api/v2/')) return true;
  return false;
}

export function authMiddleware(req, res, next) {
  // Skip if JWT_SECRET not configured (local dev / single-tenant)
  if (!JWT_SECRET) return next();

  // Skip exempt routes
  if (isExempt(req.path)) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

---

## 6. Request Pipeline

### Target request lifecycle (end to end)

> This represents the **target state** after Task #183 and Task #184 are complete.

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
│  4. authMiddleware  → extracts Bearer token, verifies JWT,           │
│                       sets req.user = { userId, role, domain, ... }  │
│  5. Route handler   → processes request using req.tenantId +        │
│                       req.user context                               │
│                           │                                          │
│                           ▼                                          │
│  Response: 200 OK  { data: [...] }                                  │
│       or:  401     { error: "Invalid or expired token" }            │
│       or:  400     { error: "Missing x-tenant-id header" }          │
│       or:  403     { error: "invalid_tenant" }                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Current request lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (current)                           │
│                                                                      │
│  Component calls:  apiRequest("GET", "/api/v2/crew-pool/profiles")  │
│                           │                                          │
│                           ▼                                          │
│  queryClient.ts:  builds headers { x-tenant-id }                    │
│                           │                                          │
│                           ▼                                          │
│  tenantFetch.ts:  intercepts fetch(), adds x-tenant-id              │
│                   (NO Authorization header)                          │
│                           │                                          │
└───────────────────────────┼──────────────────────────────────────────┘
                            │ HTTP Request
                            │ Headers:
                            │   x-tenant-id: <tuid>
                            │   Content-Type: application/json
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         BACKEND (current)                            │
│                                                                      │
│  1. Rate limiter    → pass                                           │
│  2. Logger          → logs request                                   │
│  3. tenantMiddleware→ validates x-tenant-id, sets req.tenantId      │
│  4. (NO auth check)                                                  │
│  5. Route handler   → processes request using req.tenantId only     │
│                           │                                          │
│                           ▼                                          │
│  Response: 200 OK  { data: [...] }                                  │
│       or:  400     { error: "Missing x-tenant-id header" }          │
│       or:  403     { error: "invalid_tenant" }                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Error Handling & 401 Redirect

### Backend responses (target state)

| Status | Condition | Response Body | Status |
|--------|-----------|---------------|--------|
| `401` | No `Authorization` header | `{ error: "Missing authorization token" }` | **Planned** |
| `401` | Invalid/expired JWT | `{ error: "Invalid or expired token" }` | **Planned** |
| `400` | No `x-tenant-id` header | `{ error: "Missing x-tenant-id header" }` | **Exists** |
| `403` | Invalid tenant ID | `{ error: "invalid_tenant" }` | **Exists** |
| `403` | Inactive tenant | `{ error: "tenant_inactive" }` | **Exists** |

### Frontend 401 handling

**Current state:** `queryClient.ts` has an `on401` parameter in `getQueryFn`:
- `"throw"` (default): throws an error, which triggers component error states.
- `"returnNull"`: returns `null` silently (used for optional data checks).
- No redirect logic exists. `http.ts` throws an `ApiError` with `status: 401` but no special handling.

**Planned (Task #184):** When any API request returns `401`, the frontend will perform a global redirect to the parent app's login page:

```
On 401 response:
  1. Clear any stale auth state
  2. Build redirect URL:
     parentLoginUrl + "?redirect=" + encodeURIComponent(window.location.href)
  3. window.location.assign(redirectUrl)
```

**Default parent login URL:** `https://dev.sl-sail.com/login` (configured via `VITE_PARENT_LOGIN_URL`)

The global interceptor (`tenantFetch.ts`) is the ideal place to add the 401 redirect, since it catches all responses from all API paths.

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

**Rule:** All routes starting with `/api/v2/` will require both tenant ID and JWT, **except** `/api/v2/tenant/init` which is explicitly exempted. All legacy routes (not starting with `/api/v2/`) are exempted from both checks.

The exemption logic mirrors what already exists in `tenantMiddleware.ts`:

```typescript
// server/middleware/tenantMiddleware.ts (EXISTS)
const EXEMPT_PATHS = ["/api/v2/tenant/init", "/api/health"];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p)) return true;
  if (!path.startsWith("/api/v2/")) return true;  // legacy routes exempt
  return false;
}
```

### V2 routes that will require authentication

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

All environment variables are defined in `.env.dev` (copied as `.env` on production servers).

### Currently defined in `.env.dev`

```bash
# Database Configuration
DATABASE_URL="postgres://postgres:sailadmin@localhost:5432/crew_management_new"
MASTER_DATABASE_URL="postgres://postgres:sailadmin@localhost:5432/sails_master_crewing"

# Server Configuration
NODE_ENV="production"
PORT="4000"

# Session Configuration
SESSION_SECRET="your-super-secret-session-key-here"

# Frontend Configuration (used during build)
VITE_API_BASE_URL="https://dev.sl-sail.com/b/api/v1"
VITE_CLIENT_ENCRYPTION_KEY="sailAdmin"
```

### To be added for JWT authentication

```bash
# ===============================================
# JWT Authentication (PLANNED — Task #183/#184)
# ===============================================
# Shared secret for JWT token verification (must match parent SAIL Audits app)
JWT_SECRET="your-jwt-signing-secret"

# Parent app login URL for 401 redirect (PLANNED — Task #184)
VITE_PARENT_LOGIN_URL="https://dev.sl-sail.com/login"
```

### Variable reference

#### Backend variables (`process.env.*`)

| Variable | Required | Status | Description |
|----------|----------|--------|-------------|
| `JWT_SECRET` | Yes (production) | **Planned** | Shared secret for JWT verification. Must match the parent app. |
| `DATABASE_URL` | Yes | Exists | Primary database connection |
| `MASTER_DATABASE_URL` | Yes (multi-tenant) | Exists | Master database for tenant resolution |
| `SESSION_SECRET` | Yes | Exists | Express session secret (legacy) |
| `NODE_ENV` | Yes | Exists | Environment mode |
| `PORT` | Yes | Exists | Server port |

#### Frontend variables (`import.meta.env.*`)

| Variable | Required | Status | Description |
|----------|----------|--------|-------------|
| `VITE_PARENT_LOGIN_URL` | Yes (production) | **Planned** | Parent app login URL for 401 redirect |
| `VITE_CLIENT_ENCRYPTION_KEY` | Yes | **Exists** | AES key for decrypting `credentials` from sessionStorage. Must match the parent app. |
| `VITE_API_BASE_URL` | Yes | Exists | Parent app API base URL |

---

## 10. Local Development

### Current behavior (single-tenant mode, no JWT)

When developing locally on Replit or without the parent app:

- **`MASTER_DATABASE_URL` is not set** → app runs in single-tenant mode, tenant middleware calls `next()` immediately.
- **No auth middleware exists** → all routes are accessible without authentication.
- The app works without any token. All routes are accessible.

### Target behavior (after Task #183)

- **`JWT_SECRET` is not set** → auth middleware will skip verification (`next()`) — same as current behavior.
- **`JWT_SECRET` is set** → auth middleware verifies the token on every V2 request.

This is by design: local development should not require running the full SAIL Audits parent app.

### Testing JWT locally

If you want to test JWT locally after Task #183 is implemented:

1. Set `JWT_SECRET` to match the parent app's secret.
2. Manually create a token for testing:

```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'test-user', role: 'admin', domain: 'rsms' },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);
console.log(token);
```

3. Set the token in the browser's `sessionStorage`:

```javascript
// In browser console (no encryption for local testing)
sessionStorage.setItem('credentials', '<paste-token-here>');
```

Or with encryption (to match production behavior):

```javascript
const CryptoJS = window.CryptoJS; // If available
const encrypted = CryptoJS.AES.encrypt('<jwt-token>', 'sailAdmin').toString();
sessionStorage.setItem('credentials', encrypted);
```

### Testing 401 behavior

1. Start the app with `JWT_SECRET` set.
2. Make an API call without a token → should get `401`.
3. Make an API call with an expired token → should get `401`.
4. Make an API call with a valid token → should get `200`.

---

## 11. Security Considerations

### Token storage

- The JWT is stored in `sessionStorage` (not `localStorage`), so it is scoped to the browser tab and cleared when the tab is closed.
- The token is encrypted with AES before storage, adding a layer of obfuscation (though `sessionStorage` is already inaccessible to other origins).

### Current security gap

> **Important:** Until Task #183 and Task #184 are implemented, V2 API routes have no user identity verification. Any client with a valid `x-tenant-id` can access all endpoints. Tenant isolation (data separation) is enforced, but user authentication is not.

### Shared secret management

- The `JWT_SECRET` must be kept confidential and rotated periodically.
- Both the parent app and the Crewing app must be updated simultaneously when the secret changes.
- In production, use a strong, randomly generated secret (minimum 256 bits / 32 characters).

### Token expiration

- Token expiry is set by the parent app when signing the JWT (typically 8-24 hours).
- The Crewing backend will rely on `jwt.verify()` to reject expired tokens automatically.
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

### What the JWT payload should contain

The parent app should include at minimum:

```json
{
  "userId": "user-uuid",
  "role": "admin",
  "domain": "rsms",
  "iat": 1712800000,
  "exp": 1712828800
}
```

The `domain` field can be used as a fallback for tenant resolution if the `x-tenant-id` header is missing.
