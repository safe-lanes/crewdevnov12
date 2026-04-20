# CLAUDE.md — New Module Development Guide (v2)

> **For AI Agents & Developers**: Follow this file **exactly** when building any new module.
> Every rule below prevents a real, production-witnessed failure.

---

## Project Technologies

This project is a **multi-tenant SaaS** application built to support 50+ clients. The architecture follows **Clean Architecture**, **Domain-Driven Design (DDD)**, **12-Factor App**, **OWASP Top 10**, and **AWS Well-Architected Framework** principles.

The core technology stack powering the platform consists of:
- **Frontend**: Built with **React.js** to deliver a robust, responsive, and component-driven user interface.
- **Backend**: Powered by **Node.js**, providing a highly scalable and efficient asynchronous API ecosystem.
- **Database**: **PostgreSQL** serves as the primary relational data store, ensuring transactional integrity and secure multi-tenant isolation.
- **Caching**: **Redis** is utilized for high-performance data caching to optimize response times and reduce database load.

---

## 🗄️ DATABASE ARCHITECTURE (Read This Before Any DB Work)

### How Multi-Tenancy Works in This Project

The system uses a **database-per-tenant** architecture. Every tenant has their **own isolated PostgreSQL database**. Tenant resolution happens via:
1. The `x-tenant-id` header sent by the frontend.
2. The `domain` claim inside the JWT (fallback).
3. `tenantConnectionManager` resolves the `tuid` → creates a dedicated connection pool → all queries run against that tenant's DB.

```
┌─────────────────── Master DB ────────────────────┐
│  sails_master_<module>                           │
│  tables: tenants (tuid, domain, db_url, ...)    │
└────────────────────┬─────────────────────────────┘
                     │ resolves tenant
        ┌────────────┼──────────────┐
        ▼            ▼              ▼
  Tenant A DB   Tenant B DB   Tenant C DB
  (PostgreSQL)  (PostgreSQL)  (PostgreSQL)
```

### DB-0: Connect to PostgreSQL for Consistent Storage

> [!IMPORTANT]
> Every new module **MUST** persist data in PostgreSQL. In-memory storage, file-based storage, or any transient state is strictly forbidden for production data.

**Rules for DB Connection:**
| # | Rule |
|---|---|
| 1 | Always use `getDb()` from `server/v2/db.ts` inside repositories — this returns the correct tenant-scoped Drizzle instance |
| 2 | Never import `pool` or `db` directly from `server/db.ts` — doing so bypasses tenant isolation |
| 3 | Every table MUST be defined in `shared/v2/<module>/schema.ts` using Drizzle ORM |
| 4 | Every table MUST have a migration file under `migrations/NNNN_*.sql` |
| 5 | Use `drizzle-zod` (`createInsertSchema`) to auto-generate Zod schemas from table definitions |
| 6 | Never use raw SQL strings in repositories — always use Drizzle's typed query builders |

```typescript
// ✅ CORRECT — in any repository file:
import { getDb } from "../../db";    // tenant-aware Drizzle instance

export const myRepository = {
  async getAll() {
    const db = getDb();              // ← resolves correct tenant DB automatically
    return db.select().from(myTable);
  },
};

// ❌ WRONG — never do this:
import { db } from "../../../server/db";  // bypasses tenant context
import { pool } from "../../../server/db"; // bypasses tenant context
```

---

### DB-REPLIT: Replit Always Runs in Single-Tenant Mode

> [!CAUTION]
> **Replit is ALWAYS single-tenant.** Do NOT attempt to write multi-tenant logic for the Replit development environment. It connects to one fixed PostgreSQL database.

When running on **Replit**:
- The app connects to a single PostgreSQL database via the `DATABASE_URL` environment variable.
- There is **no `x-tenant-id` resolution** — the environment acts as if there is only one tenant.
- The `tenantMiddleware` resolves to the single configured database connection.
- `AUTH_BYPASS=true` is typically set to skip JWT verification in dev/Replit.

**Environment variables on Replit:**
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname   # Single tenant DB
AUTH_BYPASS=true                                            # Skip JWT in dev
NODE_ENV=development
```

> ✅ This means: build and test your module against the single Replit DB, then deploy to production where multi-tenant resolution kicks in automatically.

---

### DB-MASTER: Master Database — `sails_master_<module>`

Every module group has a **dedicated master database** that stores tenant metadata:

```
Database name pattern: sails_master_<module>
Example:
  - sails_master_crewing   ← master DB for the crewing module family
  - sails_master_audits    ← master DB for the audits module family
```

**The `tenants` table** in the master DB is the source of truth for all tenant resolution:

```sql
-- sails_master_<module>.tenants
CREATE TABLE IF NOT EXISTS tenants (
  id          SERIAL PRIMARY KEY,
  tuid        TEXT NOT NULL UNIQUE,          -- Tenant Unique ID (used as DB identifier)
  domain      TEXT NOT NULL UNIQUE,          -- e.g. "company.sailaudits.com"
  db_url      TEXT NOT NULL,                 -- Full PostgreSQL connection string for tenant DB
  company_name TEXT,
  is_active   BOOLEAN DEFAULT true,
  is_deleted  BOOLEAN DEFAULT false,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_tuid   ON tenants(tuid);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
```

**Rules for the Master DB:**
| # | Rule |
|---|---|
| 1 | The master DB is **read-only** from the perspective of new modules — never write to it from a feature module |
| 2 | Only `tenantConnectionManager.ts` interacts with the master DB — never import it in your module code |
| 3 | To add a new tenant, directly insert a row into `sails_master_<module>.tenants` via migration or admin tooling |
| 4 | The `tuid` (Tenant Unique ID) is the key that maps to the tenant's database — store it, don't derive it |
| 5 | The `domain` column must exactly match the `domain` claim in the JWT — whitespace matters (use `.trim()`) |
| 6 | Never hardcode a `tuid` or `domain` value in application code — always read from the DB or JWT |

---

### DB-MIGRATION: Migration Logic (Same as Crewing)

> [!IMPORTANT]
> Migrations are applied **automatically on startup** via `server/migrationRunner.ts`. You NEVER run migrations manually with `psql`. Just create the `.sql` file and restart the app.

#### How It Works — Step by Step

```
npm run dev
    │
    ├── 1. migrationRunner.ts starts
    │
    ├── 2. Creates schema_migrations table if not exists
    │       CREATE TABLE IF NOT EXISTS schema_migrations (
    │         id SERIAL PRIMARY KEY,
    │         filename VARCHAR(255) UNIQUE NOT NULL,
    │         applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    │       );
    │
    ├── 3. Reads all *.sql files from migrations/ folder (sorted alphabetically)
    │
    ├── 4. For each .sql file:
    │       - Already in schema_migrations? → SKIP ✅
    │       - Not applied yet? → Execute in a transaction → record in schema_migrations
    │
    ├── 5. Error codes 42P07, 42710, 42P16, 42723 (already exists) → tolerated, not fatal
    │
    ├── 6. Any other SQL error → ROLLBACK → server REFUSES to start
    │
    └── 7. Logs Migration Summary: Applied / Skipped / Total
```

#### Startup Mode Detection

The runner auto-detects which mode it is in:

```typescript
// server/migrationRunner.ts — actual logic:
if (!process.env.DATABASE_URL) {
  if (process.env.MASTER_DATABASE_URL) {
    // Multi-tenant production: migrations run per-tenant on first connection
    console.log("⏭️  Skipping startup migrations — runs per tenant on first connection");
  } else {
    // No DB at all (standalone dev)
    console.log("⏭️  Skipping migrations: no database configured");
  }
  return;
}
// Single-tenant (Replit / dev): run all migrations against DATABASE_URL
```

| Mode | `DATABASE_URL` | `MASTER_DATABASE_URL` | Behavior |
|---|---|---|---|
| **Replit / single-tenant dev** | ✅ Set | ❌ Not set | Runs all migrations against `DATABASE_URL` on startup |
| **Multi-tenant production** | ❌ Not set | ✅ Set | Skips startup; migrations run per-tenant via `runMigrationsForTenant()` on first connection |
| **No DB (offline dev)** | ❌ Not set | ❌ Not set | Skips everything silently |

#### Per-Tenant Migration (Production)

In multi-tenant mode, when a new tenant DB is first connected, `tenantConnectionManager` calls:

```typescript
// Called automatically by tenantConnectionManager when a new tenant pool is created
await runMigrationsForTenant(connectionString, tuid);
// → Runs all pending migrations against that specific tenant's DB
// → Uses schema_migrations table inside tenant's own DB to track state
```

#### How to Add a New Migration

**Step 1:** Create the file with the next sequential number:

```
migrations/
├── 0112_users_add_crewid.sql       ← last existing
└── 0113_add_my_new_table.sql       ← YOUR NEW FILE ← next number
```

**File naming rules:**
- Format: `NNNN_short_description.sql` (4-digit zero-padded number)
- Use `snake_case` for the description
- Be specific: `add_is_deleted_to_crew_pool` not just `update_crew_pool`
- One purpose per file — never combine unrelated changes

**Step 2:** Write idempotent SQL using `IF NOT EXISTS`:

```sql
-- migrations/0113_add_my_new_table.sql
-- Purpose: Create my_entities_v2 table for <module>
-- Rollback: DROP TABLE IF EXISTS my_entities_v2;

CREATE TABLE IF NOT EXISTS my_entities_v2 (
  id          SERIAL PRIMARY KEY,
  uuid        TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,

  -- Business columns
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,

  -- Audit columns (MANDATORY on every table)
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  created_by_uuid  TEXT,
  updated_by_uuid  TEXT,
  is_deleted       BOOLEAN DEFAULT false,
  is_sync          BOOLEAN DEFAULT false
);

-- Mandatory indexes
CREATE INDEX IF NOT EXISTS idx_my_entities_v2_uuid       ON my_entities_v2(uuid);
CREATE INDEX IF NOT EXISTS idx_my_entities_v2_is_deleted ON my_entities_v2(is_deleted);
CREATE INDEX IF NOT EXISTS idx_my_entities_v2_sort_order ON my_entities_v2(sort_order);
```

**Step 3:** Restart the app — migration applies automatically:

```bash
npm run dev
# Output:
# 🔧 [main] Applying migration: 0113_add_my_new_table.sql
# ✅ [main] Applied: 0113_add_my_new_table.sql
# 📊 Migration Summary:
#    ✅ Applied: 1
#    ⏭️  Skipped: 112
#    📁 Total: 113
```

#### Migration Rules — MUST Follow

| # | Rule |
|---|---|
| 1 | **Never modify an applied migration** — it's already recorded in `schema_migrations`. Create a new file instead |
| 2 | **Never delete migration files** — keep them for version history and new tenant provisioning |
| 3 | **Never run migrations manually** with `psql` — the tracker won't know, causing `schema_migrations` desync |
| 4 | **Always use `IF NOT EXISTS`** for `CREATE TABLE`, `CREATE INDEX` to make migrations safe to re-run |
| 5 | **Always include a rollback comment** at the top of the file for emergencies |
| 6 | **One migration per logical change** — don't bundle unrelated table changes |
| 7 | **Only `.sql` files** in `migrations/` are picked up — no `.ts`, no subdirectories |
| 8 | If a migration fails, **look at the error log** — the server will refuse to start until it's fixed |

#### Verifying Migration Status

```sql
-- Check which migrations have been applied:
SELECT filename, applied_at
FROM schema_migrations
ORDER BY applied_at DESC;

-- Mark a manually-run migration as applied (emergency only):
INSERT INTO schema_migrations (filename) VALUES ('0113_add_my_new_table.sql');
```

---

## 🔒 SECURITY LAYER (Required for All Modules)

### SEC-1: Role-Based Access Control (RBAC)

Every endpoint MUST declare the minimum `userType` required. Do NOT rely only on authentication.

```typescript
// shared/v2/auth/permissions.ts
export const UserType = {
  ADMIN:   "admin",
  MANAGER: "manager",
  USER:    "user",
  VIEWER:  "viewer",
} as const;

export type UserType = typeof UserType[keyof typeof UserType];

// Permission hierarchy: admin > manager > user > viewer
export const ROLE_HIERARCHY: Record<UserType, number> = {
  admin:   4,
  manager: 3,
  user:    2,
  viewer:  1,
};

export function hasPermission(userType: UserType, required: UserType): boolean {
  return ROLE_HIERARCHY[userType] >= ROLE_HIERARCHY[required];
}
```

```typescript
// server/v2/middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";
import { hasPermission, UserType } from "@shared/v2/auth/permissions";

export function requireRole(minRole: UserType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userType = req.user?.userType as UserType;
    if (!userType || !hasPermission(userType, minRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
```

```typescript
// In routes.ts — apply per route:
router.post("/entities", requireRole("manager"), myEntityController.create);
router.delete("/entities/:uuid", requireRole("admin"), myEntityController.delete);
router.get("/entities", requireRole("viewer"), myEntityController.getAll);
```

**RBAC Rules:**
- Every route in `routes.ts` MUST have an explicit `requireRole()` middleware
- GET endpoints minimum: `viewer`. POST/PATCH minimum: `user`. DELETE minimum: `admin`
- NEVER check roles inside controllers or services — that is the middleware's job
- `requireRole` runs AFTER `authMiddleware` (user is always set when it runs)

---

### SEC-2: Global Rate Limiting

Install `express-rate-limit` and apply at multiple levels:

```typescript
// server/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../utils/redis";

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => `${req.tenantId}:${req.ip}`,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  message: { error: "Too many requests, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `auth:${req.body?.domain}:${req.ip}`,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  message: { error: "Too many login attempts. Please try again in 1 minute." },
});

export const heavyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `heavy:${req.tenantId}:${req.user?.id}`,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  message: { error: "Rate limit exceeded for bulk operations." },
});
```

```typescript
// server/index.ts
app.use("/api/v2/", globalRateLimiter);
app.use("/api/v2/auth/login", authRateLimiter);
app.use("/api/v2/auth/refresh", authRateLimiter);
```

---

### SEC-3: Input Sanitization

```typescript
// server/v2/utils/sanitize.ts
import DOMPurify from "isomorphic-dompurify";

export function sanitizeString(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] }).trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === "string" ? sanitizeString(value) : value,
    ])
  ) as T;
}
```

Apply in every service before DB write:

```typescript
// In service layer:
const sanitized = sanitizeObject(createDto);
const result = await this.repository.create(sanitized);
```

---

## 🔑 AUTHENTICATION & TOKEN MANAGEMENT (Required for All Modules)

> [!IMPORTANT]
> Every new module MUST support **individual user login** (not just parent-app JWT) and **token verification on every request**. This section defines the standard for how authentication should work across the entire system.

### Auth-1: Support Individual Login

Future modules MUST support standalone user authentication — users log in with their own credentials, independent of the parent SAIL Audits app.

**Login credentials format:**

```typescript
// Login request body — always these 3 fields:
{
  "username": "string",   // crew ID, employee number, or username
  "password": "string",   // plain text (hashed on server via bcrypt)
  "domain": "string"      // tenant domain (e.g., "company.sail.com")
}
```

**Rules:**
| # | Rule |
|---|---|
| 1 | Login endpoint MUST be `POST /api/v2/auth/login` |
| 2 | Login endpoint MUST be auth-exempt (add to `exemptPaths.ts`) |
| 3 | Passwords MUST be hashed with `bcrypt` (min 10 salt rounds) — never store plain text |
| 4 | The `domain` field is used to resolve the correct tenant database before authenticating |
| 5 | Login MUST return both `accessToken` (short-lived) and `refreshToken` (long-lived) |
| 6 | Failed login attempts MUST be rate-limited (max 5 per minute per username+domain) |
| 7 | After 10 consecutive failures, the account MUST be temporarily locked (15 min) |
| 8 | Login response MUST NOT include the password hash or any sensitive server data |

---

### Auth-2: Token Generation Standard

**Access Token (short-lived):**

```typescript
// Generated on login — expires quickly
const accessToken = jwt.sign(
  {
    id: user.id,               // Internal user ID
    uuid: user.uuid,           // Public user UUID
    username: user.username,   // Username / crew ID
    domain: user.domain,       // Tenant domain
    userType: user.userType,   // "admin" | "user" | "crew" | "viewer"
  },
  process.env.JWT_SECRET,
  { expiresIn: "15m" }        // 15 minutes — NEVER longer than 1 hour
);
```

**Refresh Token (long-lived):**

```typescript
// Generated alongside access token — used to get new access tokens
const refreshToken = jwt.sign(
  {
    id: user.id,
    uuid: user.uuid,
    domain: user.domain,
    type: "refresh",           // Distinguishes from access token
  },
  process.env.JWT_REFRESH_SECRET,  // DIFFERENT secret from access token
  { expiresIn: "7d" }             // 7 days
);
```

**Rules:**
| # | Rule |
|---|---|
| 1 | Access token expiry: **15 minutes** (configurable via env var, max 1 hour) |
| 2 | Refresh token expiry: **7 days** (configurable via env var, max 30 days) |
| 3 | Use **two different secrets**: `JWT_SECRET` for access, `JWT_REFRESH_SECRET` for refresh |
| 4 | Refresh tokens MUST be stored in the database (for revocation on logout) |
| 5 | Access tokens are stateless — NOT stored in the database |
| 6 | Token payload MUST include: `id`, `uuid`, `username`, `domain`, `userType` |
| 7 | NEVER put sensitive data in the token payload (no passwords, no email, no PII) |
| 8 | Both tokens MUST be returned in the login response body — NOT in cookies |

---

### Auth-3: Token Verification on EVERY Request

**Server-side verification flow:**

```
Every /api/v2/* request (except exempt paths):
│
├── 1. tenantMiddleware: reads x-tenant-id header → resolves tenant DB
│
├── 2. authMiddleware: extracts token → verifies → sets req.user
│     │
│     ├── Token present? → jwt.verify(token, JWT_SECRET)
│     │   ├── Valid? → req.user = decoded payload → next()
│     │   ├── Expired? → 401 { error: "token_expired" }
│     │   └── Invalid? → 401 { error: "invalid_token" }
│     │
│     └── Token missing? → 401 { error: "unauthorized" }
│
└── 3. Route handler: processes authenticated request with req.user
```

**Rules:**
| # | Rule |
|---|---|
| 1 | The `authMiddleware` runs on ALL `/api/v2/*` routes automatically — you NEVER add manual auth checks in controllers |
| 2 | Every controller method can access `req.user` — it's always populated by middleware |
| 3 | If a route needs to be public, add it to `server/middleware/exemptPaths.ts` — never bypass auth inline |
| 4 | The middleware verifies BOTH the JWT signature AND expiry — you never do `jwt.verify()` manually |
| 5 | Token domain MUST match the tenant ID — prevents cross-tenant access |
| 6 | On 401 response, the client (`tenantFetch.ts`) automatically attempts refresh or redirects to login |
| 7 | File download endpoints accept token via `?sail=<token>` query param (browser can't set headers on `<a href>`) |

---

### Auth-4: Passing Token With Every API Request

**Client-side (automatic — via `tenantFetch.ts`):**

```typescript
// tenantFetch.ts patches window.fetch() globally:
// Every fetch to /api/* automatically gets:
headers.set("Authorization", `Bearer ${accessToken}`);
headers.set("x-tenant-id", tenantId);

// YOU NEVER DO THIS MANUALLY. It's automatic.
```

**Rules:**
| # | Rule |
|---|---|
| 1 | **NEVER** manually add `Authorization` or `x-tenant-id` headers in API client code |
| 2 | Always use `apiRequest()` from `@/lib/queryClient` — it uses the patched `fetch()` |
| 3 | Store access token in `sessionStorage` (encrypted via AES) — never `localStorage` |
| 4 | Store refresh token in `sessionStorage` (encrypted) — cleared on tab close |
| 5 | On 401 response → attempt silent refresh → if refresh fails → redirect to login page |
| 6 | On 403 response → show "Access Denied" — do NOT redirect to login (user is authenticated but unauthorized) |
| 7 | For file downloads, append token as query param: `/api/v2/.../download?sail=${token}` |

---

### Auth-5: Token Refresh Flow

```
Client detects 401 (token expired):
│
├── 1. Call POST /api/v2/auth/refresh with { refreshToken }
│
├── 2. Server verifies refresh token:
│     ├── Valid + not revoked? → return new accessToken + refreshToken
│     └── Invalid/expired/revoked? → 401 → client redirects to login
│
├── 3. Client stores new tokens in sessionStorage
│
└── 4. Client retries the original failed request with new token
```

**Rules:**
| # | Rule |
|---|---|
| 1 | Refresh endpoint MUST be auth-exempt (user's access token is already expired) |
| 2 | Refresh MUST issue BOTH new access token AND new refresh token (rotation) |
| 3 | Old refresh token MUST be invalidated after use (prevents token reuse) |
| 4 | If refresh token is expired/invalid, clear all stored tokens and redirect to login |
| 5 | Only ONE refresh request at a time — queue concurrent requests waiting for refresh |

---

### Auth-6: Auth-Related Endpoints Standard

Every application MUST have these standard auth endpoints:

```
POST   /api/v2/auth/login              ← Login (exempt from auth)
POST   /api/v2/auth/refresh            ← Refresh token (exempt from auth)
GET    /api/v2/auth/profile            ← Get current user profile (auth required)
POST   /api/v2/auth/change-password    ← Change password (auth required)
POST   /api/v2/auth/logout             ← Invalidate refresh token (auth required)
```

---

## 🚨 ERROR HANDLING (Required for All Modules)

### Typed Error Classes

Never throw raw `Error` or return generic 500s. Use a typed error hierarchy so every thrown error maps to a deterministic HTTP response.

```typescript
// server/v2/utils/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,           // machine-readable, e.g. "INVOICE_NOT_FOUND"
    public readonly details?: unknown       // optional field-level detail
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

// Pre-built subclasses for common cases
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404, `${resource.toUpperCase()}_NOT_FOUND`);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super("Validation failed", 400, "VALIDATION_ERROR", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}
```

### Global Error Handler (Express)

Register this as the **last** middleware in `server/index.ts`. It catches every thrown error and formats a consistent response.

```typescript
// server/v2/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Zod validation errors → 400 with field details
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  }

  // Known AppError → use its statusCode
  if (err instanceof AppError) {
    req.log?.warn({ code: err.code, statusCode: err.statusCode }, err.message);
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Unknown errors → always 500, never leak internals
  req.log?.error({ err }, "Unhandled error");
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
  });
}
```

```typescript
// server/index.ts — register LAST
app.use(globalErrorHandler);
```

### Usage in Services

```typescript
// ✅ CORRECT — throw typed errors, never return null on not-found
async getByUuid(tenantId: string, uuid: string) {
  const record = await this.repository.findByUuid(tenantId, uuid);
  if (!record) throw new NotFoundError("Invoice", uuid);
  return record;
}

// ✅ CORRECT — let Zod throws propagate; they're caught by globalErrorHandler
async create(tenantId: string, dto: unknown) {
  const validated = createInvoiceSchema.parse(dto);   // throws ZodError on failure
  return this.repository.create(tenantId, validated);
}
```

**Rules:**
- NEVER return `null` from a service when a record is expected — throw `NotFoundError`
- NEVER catch errors in controllers just to re-throw — let `globalErrorHandler` handle them
- NEVER expose stack traces, DB errors, or internal messages to API responses
- Services throw `AppError` subclasses; controllers do NOT catch individual errors

---

## 📐 API RESPONSE ENVELOPE (Standard for All Endpoints)

Every endpoint MUST return a consistent shape. Inconsistent responses break frontend type safety and client SDK generation.

```typescript
// server/v2/utils/response.ts
export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    success: true,
    data,
    meta: { total, page, limit, hasMore: page * limit < total },
  };
}
```

```typescript
// ✅ CORRECT — all controllers use these helpers
return res.status(200).json(successResponse(invoice));
return res.status(201).json(successResponse(created));
return res.status(200).json(paginatedResponse(rows, total, page, limit));
```

**Standard HTTP Status Codes:**

| Scenario | Status |
|---|---|
| Successful GET / PATCH | 200 |
| Resource created | 201 |
| Async job accepted | 202 |
| Validation error | 400 |
| Not authenticated | 401 |
| Insufficient permission | 403 |
| Resource not found | 404 |
| Duplicate / conflict | 409 |
| Server error | 500 |

---

## 🔁 TRANSACTION MANAGEMENT

Any operation that writes to **more than one table** MUST be wrapped in a database transaction. Partial writes are silent data corruption.

```typescript
// server/v2/utils/transaction.ts
import { getDb } from "../db";

export async function withTransaction<T>(
  fn: (tx: ReturnType<typeof getDb>) => Promise<T>
): Promise<T> {
  const db = getDb();
  return db.transaction(fn);
}
```

```typescript
// ✅ CORRECT — multi-table write inside transaction
async createInvoiceWithItems(tenantId: string, dto: CreateInvoiceDto) {
  return withTransaction(async (tx) => {
    const invoice = await invoiceRepository.create(tx, tenantId, dto);
    await invoiceItemRepository.bulkCreate(tx, invoice.uuid, dto.items);
    await inventoryRepository.decrementStock(tx, tenantId, dto.items);
    return invoice;
  });
}
```

**Rules:**
- Any service method touching 2+ tables MUST use `withTransaction()`
- Pass the `tx` object into repositories — never call `getDb()` inside a transaction callback
- Transactions auto-rollback on any thrown error — do not manually catch inside `withTransaction`

---

## 🌍 ENVIRONMENT & CONFIG VALIDATION

The app MUST validate all required environment variables at startup. A missing variable should crash immediately with a clear message — not at runtime when a user hits an endpoint.

```typescript
// server/v2/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV:         z.enum(["development", "test", "production"]),
  DATABASE_URL:     z.string().url(),
  REDIS_URL:        z.string().url(),
  JWT_SECRET:       z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT:             z.coerce.number().default(3000),
  LOG_LEVEL:        z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
```

```typescript
// server/index.ts — import env FIRST before anything else
import "./v2/config/env";   // crashes here if env is invalid
```

---

## 🛑 GRACEFUL SHUTDOWN

During deploys, the process receives SIGTERM. Without a handler, in-flight DB queries and BullMQ jobs are killed mid-execution, causing data corruption.

```typescript
// server/v2/shutdown.ts
import { db } from "./db";
import { redisClient } from "./utils/redis";
import { emailWorker } from "./queues/emailQueue";

export function registerGracefulShutdown(server: import("http").Server) {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      try {
        // Wait for active BullMQ workers to finish current jobs
        await emailWorker.close();

        // Close DB and Redis connections
        await redisClient.quit();
        console.log("Graceful shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
      }
    });

    // Force kill if shutdown takes too long
    setTimeout(() => {
      console.error("Shutdown timeout — forcing exit.");
      process.exit(1);
    }, 15_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}
```

```typescript
// server/index.ts
const server = app.listen(env.PORT, () => console.log(`Running on port ${env.PORT}`));
registerGracefulShutdown(server);
```

---

## 🔁 BACKGROUND JOB RETRY & DEAD LETTER QUEUE

BullMQ jobs MUST define retry behavior and a failure handler. Silent job failures are invisible data loss.

```typescript
// server/v2/queues/emailQueue.ts
import { Queue, Worker, QueueEvents } from "bullmq";
import { redisClient } from "../utils/redis";
import { logger } from "../utils/logger";

export const emailQueue = new Queue("emails", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,                          // retry up to 3 times
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },     // keep last 100 completed
    removeOnFail:     { count: 500 },     // keep last 500 failed for inspection
  },
});

export const emailWorker = new Worker("emails", async (job) => {
  const { to, template, data } = job.data;
  await emailService.send(to, template, data);
}, { connection: redisClient, concurrency: 5 });

// Log failures — alert on repeated failures in production
emailWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, queue: "emails", err }, "Job failed");
});

emailWorker.on("error", (err) => {
  logger.error({ queue: "emails", err }, "Worker error");
});
```

---

## 🏥 HEALTH CHECK IMPLEMENTATION

`/api/health` MUST actively probe dependencies and return `503` when degraded — not just `200 OK` always.

```typescript
// server/v2/health/health.controller.ts
import { Request, Response } from "express";
import { getDb } from "../db";
import { redisClient } from "../utils/redis";

export async function healthCheck(req: Request, res: Response) {
  const checks: Record<string, "ok" | "fail"> = {};

  // Check DB
  try {
    await getDb().execute("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  // Check Redis
  try {
    await redisClient.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "fail";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");
  return res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
}
```

```typescript
// server/routes.ts — exempt from auth and rate limiting
app.get("/api/health", healthCheck);
```

---

## 📊 OBSERVABILITY

### Structured Logging (Pino)

```typescript
// server/v2/middleware/requestLogger.ts
import pino from "pino";
import { v4 as uuidv4 } from "uuid";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export function requestLogger(req, res, next) {
  const correlationId = req.headers["x-correlation-id"] as string || uuidv4();
  req.log = logger.child({
    correlationId,
    tenantId: req.tenantId,
    userId: req.user?.id,
    method: req.method,
    path: req.path,
  });
  res.setHeader("x-correlation-id", correlationId);
  next();
}
```

**Rule:** Always use `req.log.info/error()` — NEVER `console.log/error`.

### Audit Service

```typescript
// server/v2/shared/auditService.ts
export interface AuditEvent {
  tenantId: string;
  userId: string;
  action: string;         // "entity.created", "entity.deleted"
  resourceType: string;   // "invoice", "contact"
  resourceId: string;     // UUID of affected record
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

class AuditService {
  async log(event: AuditEvent): Promise<void> {
    await db.insert(auditLogsTable).values({
      ...event,
      timestamp: new Date(),
    });
  }
}
export const auditService = new AuditService();
```

Call from the **service layer** on every write operation:

```typescript
await auditService.log({
  tenantId, userId, action: "invoice.created",
  resourceType: "invoice", resourceId: created.uuid,
  after: created,
});
```

---

## ⚡ CACHING

### Redis Cache Helpers

```typescript
// server/v2/utils/cache.ts
import { redisClient } from "./redis";

export function tenantCacheKey(tenantId: string, ...parts: string[]): string {
  return `t:${tenantId}:${parts.join(":")}`;
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached) as T;
  const fresh = await fetcher();
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
}

export async function invalidateTenantCache(tenantId: string, pattern: string) {
  const keys = await redisClient.keys(tenantCacheKey(tenantId, pattern, "*"));
  if (keys.length > 0) await redisClient.del(keys);
}
```

**Cache TTL Guidelines:**

| Data Type | TTL |
|---|---|
| User session data | 15 minutes |
| Master/lookup lists | 1 hour |
| Configuration data | 24 hours |
| Computed analytics | 5 minutes |
| Frequently mutated entities | Do NOT cache |

**Rules:**
- Always use `tenantCacheKey()` — never raw keys
- Invalidate cache in every mutation service
- NEVER cache with raw tenant IDs — always scope via `tenantCacheKey()`

---

## 🗄️ DATABASE RULES

### Standard Audit Columns (Required on ALL Tables)

Every table MUST spread `...auditColumns`. This is the **single source of truth** for audit columns — never redefine these individually per table.

```typescript
// shared/v2/schema/audit.ts
import { boolean, integer, text, timestamp } from "drizzle-orm/pg-core";

export const auditColumns = {
  sort_order:       integer("sort_order").default(0),
  created_at:       timestamp("created_at").defaultNow(),
  updated_at:       timestamp("updated_at").defaultNow(),
  created_by_uuid:  text("created_by_uuid"),
  updated_by_uuid:  text("updated_by_uuid"),
  is_deleted:       boolean("is_deleted").default(false),
  is_sync:          boolean("is_sync").default(false),
};
```

| Column | Type | Purpose |
|---|---|---|
| `sort_order` | `integer` (default `0`) | Client-side ordering / drag-and-drop positioning |
| `created_at` | `timestamp` (default `now()`) | Record creation time — never updated after insert |
| `updated_at` | `timestamp` (default `now()`) | Last modification time — updated on every PATCH/PUT |
| `created_by_uuid` | `text` | UUID of the user who created the record |
| `updated_by_uuid` | `text` | UUID of the user who last modified the record |
| `is_deleted` | `boolean` (default `false`) | Soft delete flag — never hard DELETE in production |
| `is_sync` | `boolean` (default `false`) | Sync status flag for offline/external system sync |

**Audit Column Rules:**
- `created_at` and `created_by_uuid` are set ONCE at insert and NEVER updated
- `updated_at` and `updated_by_uuid` are updated on EVERY mutation
- Repository layer is responsible for setting these — never trust client input
- `is_deleted` is used for soft delete — queries MUST filter `WHERE is_deleted = false`

---

### Table Schema Standard

```typescript
// shared/v2/schema/<module>.ts
import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { auditColumns } from "./audit";

export const myEntitiesV2 = pgTable("my_entities_v2", {
  id:           serial("id").primaryKey(),
  uuid:         text("uuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  name:         text("name").notNull(),
  ...auditColumns,   // ← spreads all 7 audit columns automatically
});
```

**Mandatory indexes:**

```sql
CREATE INDEX idx_my_entities_v2_uuid       ON my_entities_v2(uuid);
CREATE INDEX idx_my_entities_v2_created_at ON my_entities_v2(created_at);
CREATE INDEX idx_my_entities_v2_active     ON my_entities_v2(is_deleted) WHERE is_deleted = false;
```

### DB-1: No JSON / JSONB Columns

**NEVER** use `json` or `jsonb` columns in PostgreSQL tables. JSON columns bypass schema validation, break type safety, make queries slow (no indexes on nested keys), and are impossible to enforce foreign keys on.

```typescript
// ❌ WRONG — storing structured data as JSON
export const ordersV2 = pgTable("orders_v2", {
  id:       serial("id").primaryKey(),
  uuid:     text("uuid").notNull().unique(),
  items:    jsonb("items"),          // ← NEVER DO THIS
  metadata: jsonb("metadata"),       // ← NEVER DO THIS
  ...auditColumns,
});

// ✅ CORRECT — normalize into separate tables with proper columns
export const ordersV2 = pgTable("orders_v2", {
  id:       serial("id").primaryKey(),
  uuid:     text("uuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  status:   text("status").notNull(),
  ...auditColumns,
});

export const orderItemsV2 = pgTable("order_items_v2", {
  id:            serial("id").primaryKey(),
  uuid:          text("uuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  order_uuid:    text("order_uuid").notNull().references(() => ordersV2.uuid),
  product_name:  text("product_name").notNull(),
  quantity:      integer("quantity").notNull(),
  unit_price:    integer("unit_price").notNull(),
  ...auditColumns,
});
```

**Why it matters:**
- JSON columns cannot have foreign keys → orphaned/invalid data
- JSON columns cannot be indexed efficiently → full table scans at scale
- JSON columns have no schema enforcement → garbage data silently accepted
- JSON columns break Drizzle ORM type inference → `any` types leak in

**Only exception:** Free-form user preferences or unstructured external API payloads where the schema is truly unknown. Even then, validate with Zod before storing.

---

### DB-2: Foreign Keys with UUID References

Every relationship between tables MUST use a proper foreign key constraint referencing the `uuid` column of the parent table. Never store references as plain text without a constraint — orphaned records are silent data corruption.

```typescript
// ✅ CORRECT — FK constraint on uuid column
export const invoiceItemsV2 = pgTable("invoice_items_v2", {
  id:            serial("id").primaryKey(),
  uuid:          text("uuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  invoice_uuid:  text("invoice_uuid").notNull().references(() => invoicesV2.uuid),
  product_uuid:  text("product_uuid").notNull().references(() => productsV2.uuid),
  quantity:      integer("quantity").notNull(),
  ...auditColumns,
});

// ❌ WRONG — plain text column with no FK constraint
export const invoiceItemsV2 = pgTable("invoice_items_v2", {
  id:            serial("id").primaryKey(),
  invoice_uuid:  text("invoice_uuid").notNull(),   // ← NO FK = orphaned rows
  product_uuid:  text("product_uuid").notNull(),   // ← NO FK = invalid references
  ...auditColumns,
});
```

**FK Naming Convention:**
- Column name: `<parent_entity>_uuid` (e.g., `vessel_uuid`, `crew_uuid`)
- Always reference the `uuid` column of the parent, not the `id`
- Use `onDelete` behavior explicitly when needed:

```typescript
// Cascade delete child rows when parent is deleted
text("order_uuid").notNull().references(() => ordersV2.uuid, { onDelete: "cascade" }),

// Prevent deleting parent if children exist
text("department_uuid").notNull().references(() => departmentsV2.uuid, { onDelete: "restrict" }),

// Set to null when parent is deleted (for optional relationships)
text("manager_uuid").references(() => usersV2.uuid, { onDelete: "set null" }),
```

---

### DB-3: Indexing Strategy

Every table MUST have indexes on columns used in `WHERE`, `JOIN`, `ORDER BY`, and foreign key columns. Missing indexes cause full table scans that degrade exponentially with data growth.

**Mandatory indexes for every table:**

```sql
-- 1. UUID lookup (already unique, but ensure index exists)
CREATE INDEX idx_<table>_uuid ON <table>(uuid);

-- 2. Soft-delete filter (partial index for active rows)
CREATE INDEX idx_<table>_active ON <table>(is_deleted) WHERE is_deleted = false;

-- 3. Audit timestamp (sorting and date-range queries)
CREATE INDEX idx_<table>_created_at ON <table>(created_at);
```

**Mandatory indexes for FK columns:**

```sql
-- Every FK column MUST be indexed for JOIN performance
CREATE INDEX idx_order_items_v2_order_uuid   ON order_items_v2(order_uuid);
CREATE INDEX idx_order_items_v2_product_uuid ON order_items_v2(product_uuid);
```

**Composite indexes for common query patterns:**

```sql
-- If you frequently query: WHERE is_deleted = false AND status = 'active' ORDER BY created_at
CREATE INDEX idx_orders_v2_status_date ON orders_v2(status, created_at) WHERE is_deleted = false;

-- If you frequently filter by tenant + status
CREATE INDEX idx_invoices_v2_status ON invoices_v2(status, created_at DESC);
```

**Indexing Rules:**
- Every foreign key column (`*_uuid`) MUST have an index
- Every column used in `WHERE` clauses MUST be evaluated for indexing
- Use **partial indexes** (`WHERE is_deleted = false`) for tables with soft delete
- Use **composite indexes** for queries that filter on multiple columns together
- Order columns in composite indexes: equality filters first, then range/sort columns
- NEVER create indexes you don't query — unused indexes slow down writes
- Run `EXPLAIN ANALYZE` on slow queries to verify index usage

---

### DB-4: File Storage as Base64 in Database

This project stores files (images, PDFs, documents) as **base64-encoded text** directly in PostgreSQL. Every file storage table MUST include proper metadata columns alongside the base64 data.

```typescript
// ✅ CORRECT — store base64 with full metadata
export const documentsV2 = pgTable("documents_v2", {
  id:           serial("id").primaryKey(),
  uuid:         text("uuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  file_name:    text("file_name").notNull(),          // original filename: "report.pdf"
  file_data:    text("file_data").notNull(),           // base64-encoded file content
  file_size:    integer("file_size").notNull(),        // size in bytes (before encoding)
  mime_type:    text("mime_type").notNull(),            // "application/pdf", "image/png"
  ...auditColumns,
});

// ❌ WRONG — storing base64 without metadata
export const documentsV2 = pgTable("documents_v2", {
  id:           serial("id").primaryKey(),
  uuid:         text("uuid").notNull().unique(),
  file_data:    text("file_data"),           // ← NO file_name, file_size, mime_type
  ...auditColumns,
});
```

**File Storage Rules:**
- Always store `file_name`, `file_data` (base64), `file_size`, and `mime_type` together
- Validate `mime_type` against an allow-list before saving (prevent uploading executables)
- Set a **max upload size** (e.g., 10MB) validated on both client and server
- Use `text` column type for `file_data` — NOT `bytea`
- When returning lists of records with files, **exclude `file_data`** from list queries to avoid pulling large blobs:

```typescript
// ✅ CORRECT — exclude file_data from list queries
async getAll(tenantId: string, pagination: PaginationParams) {
  return db.select({
    id: documentsV2.id,
    uuid: documentsV2.uuid,
    file_name: documentsV2.file_name,
    file_size: documentsV2.file_size,
    mime_type: documentsV2.mime_type,
    created_at: documentsV2.created_at,
    // DO NOT include file_data here — fetch only on single-record GET
  }).from(documentsV2)
    .where(eq(documentsV2.is_deleted, false))
    .limit(pagination.limit)
    .offset(pagination.offset);
}

// ✅ CORRECT — include file_data only on single-record fetch
async getByUuid(tenantId: string, uuid: string) {
  return db.select().from(documentsV2)
    .where(and(eq(documentsV2.uuid, uuid), eq(documentsV2.is_deleted, false)));
}
```

---

### DB-5: Avoid N+1 Queries

**NEVER** execute a query inside a loop. The N+1 problem is the #1 cause of API slowness at scale — fetching a list of 100 records triggers 101 queries instead of 2.

```typescript
// ❌ WRONG — N+1: 1 query for orders + N queries for items
async getOrdersWithItems(tenantId: string) {
  const orders = await db.select().from(ordersV2).where(eq(ordersV2.is_deleted, false));

  // This fires a separate query for EACH order — N+1!
  for (const order of orders) {
    order.items = await db.select().from(orderItemsV2)
      .where(eq(orderItemsV2.order_uuid, order.uuid));
  }
  return orders;
}

// ✅ CORRECT — 2 queries total using batch loading
async getOrdersWithItems(tenantId: string) {
  const orders = await db.select().from(ordersV2)
    .where(eq(ordersV2.is_deleted, false));

  if (orders.length === 0) return [];

  // Single batch query for ALL items
  const orderUuids = orders.map(o => o.uuid);
  const allItems = await db.select().from(orderItemsV2)
    .where(inArray(orderItemsV2.order_uuid, orderUuids));

  // Group items by order in memory
  const itemsByOrder = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const group = itemsByOrder.get(item.order_uuid) ?? [];
    group.push(item);
    itemsByOrder.set(item.order_uuid, group);
  }

  return orders.map(order => ({
    ...order,
    items: itemsByOrder.get(order.uuid) ?? [],
  }));
}

// ✅ ALSO CORRECT — use JOIN for single-query fetch
async getOrdersWithItems(tenantId: string) {
  const rows = await db.select()
    .from(ordersV2)
    .leftJoin(orderItemsV2, eq(ordersV2.uuid, orderItemsV2.order_uuid))
    .where(eq(ordersV2.is_deleted, false));

  // Reduce joined rows into nested structure
  return reduceJoinedRows(rows);
}
```

**N+1 Prevention Rules:**
- **NEVER** call `db.select()` or `db.query()` inside a `for` / `forEach` / `map` loop
- Use `inArray()` for batch loading related records in a second query
- Use `LEFT JOIN` when you need parent + children in a single query
- For deeply nested relations (3+ levels), use multiple batch queries — not nested loops
- Log and monitor query count per request in development to catch N+1 patterns early

---

**Database Rules:**
- Every table has `id` (serial PK) + `uuid` (text unique)
- Every table spreads `...auditColumns` (all 7 standard columns)
- `created_by_uuid` and `updated_by_uuid` populated in repository
- `updated_at` updated on every mutation; `created_at` never changes after insert
- Soft delete via `is_deleted` — NOT hard DELETE in production
- Table name ends with `_v2` suffix
- All column names use `snake_case`
- Set `max: 5` per tenant pool — use PgBouncer for 50+ clients
- **NEVER use `json` / `jsonb` columns** — normalize into proper tables
- **Files stored as base64 in DB** with `file_name`, `file_data`, `file_size`, `mime_type` columns
- **NEVER query inside loops** — use `inArray()` batch loading or JOINs
- **Every FK column uses `.references()`** with explicit `onDelete` behavior
- **Every FK column and filter column has an index**

---

## 📄 PAGINATION (Required on All List Endpoints)

```typescript
// server/v2/utils/pagination.ts
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function normalizePagination(query: {
  page?: string;
  limit?: string;
}): PaginationParams {
  const page  = Math.max(1, parseInt(query.page  || "1",  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
  return { page, limit, offset: (page - 1) * limit };
}
```

Apply to every list endpoint:

```typescript
// In controller:
const { page, limit, offset } = normalizePagination(req.query);
const { data, total } = await myService.getAll(tenantId, { limit, offset });
return res.json({ data, total, page, limit, hasMore: offset + data.length < total });
```

**Rule:** NEVER return unbounded lists from `getAll()` — always enforce `normalizePagination()`.

---

## ⚙️ TYPESCRIPT STRICT MODE

All TypeScript code MUST compile under strict mode. Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Rules:**
- `strict: true` enables `strictNullChecks`, `strictFunctionTypes`, `noImplicitAny` — all required
- `noUncheckedIndexedAccess` prevents `array[0]` returning `T` when it could be `undefined`
- NEVER use `// @ts-ignore` — fix the type properly
- NEVER use `as any` — use `unknown` + type guard or proper generics

---

## 🏗️ MODULE STRUCTURE

### File Layout

```
server/v2/<module>/
  ├── <module>.controller.ts     # HTTP only — zero business logic
  ├── <module>.service.ts        # Business logic — zero req/res
  ├── <module>.repository.ts     # DB queries — zero business rules
  ├── <module>.routes.ts         # Route declarations + middleware
  └── <module>.test.ts           # Integration tests

shared/v2/<module>/
  ├── types.ts                   # Shared TypeScript types
  └── validators.ts              # Zod schemas

client/src/modules/<module>/
  ├── index.tsx                  # Lazy-loaded entry
  ├── components/
  └── hooks/
```

### Controller Rules

```typescript
// ✅ CORRECT — controllers are thin HTTP adapters
export class MyEntityController {
  async create(req: Request, res: Response) {
    try {
      const validated = createMyEntitySchema.parse(req.body);
      const result = await myEntityService.create(req.tenantId, req.user!.uuid, validated);
      return res.status(201).json(result);
    } catch (error) {
      req.log.error({ error }, "Failed to create entity");
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
```

- Controllers: HTTP only — zero business logic
- Services: Business logic — zero req/res references
- Repositories: DB queries — zero business rules
- No file exceeds **3000 lines**
- No `any` types

---

## 🔄 BACKGROUND JOBS (BullMQ)

```typescript
// server/v2/queues/emailQueue.ts
import { Queue, Worker } from "bullmq";
import { redisClient } from "../utils/redis";

export const emailQueue = new Queue("emails", { connection: redisClient });

export const emailWorker = new Worker("emails", async (job) => {
  const { to, template, data } = job.data;
  await emailService.send(to, template, data);
}, { connection: redisClient, concurrency: 5 });
```

**Rule:** NEVER call slow APIs or send emails inline in requests. Queue via BullMQ and return `202 Accepted`.

---

## 🖥️ FRONTEND RULES

- Module lives in `client/src/modules/<module>/`
- API client uses `apiRequest()` from `@/lib/queryClient`
- No manual header injection
- Data fetching uses TanStack Query (`useQuery`/`useMutation`)
- Forms use React Hook Form + Zod
- UI uses `shadcn/ui` components only
- Route registered in `App.tsx` with `<ProtectedRoute>`
- Every lazy-loaded route wrapped in `<ModuleErrorBoundary>`
- No component file exceeds **3000 lines**
- Types imported from `@shared/v2/<module>/types`

### Frontend Error Handling Standard

```typescript
// ✅ CORRECT — useMutation with onError handler
const createInvoice = useMutation({
  mutationFn: (data: CreateInvoiceDto) => apiRequest("POST", "/api/v2/invoices", data),
  onSuccess: () => {
    toast({ title: "Invoice created", variant: "default" });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  },
  onError: (error: ApiError) => {
    // Show field-level errors if available (from Zod 400)
    if (error.code === "VALIDATION_ERROR" && error.details) {
      Object.entries(error.details).forEach(([field, messages]) => {
        form.setError(field as keyof CreateInvoiceDto, { message: messages[0] });
      });
    } else {
      toast({ title: error.message ?? "Something went wrong", variant: "destructive" });
    }
  },
});
```

```typescript
// client/src/modules/<module>/components/ModuleErrorBoundary.tsx
import { Component, ReactNode } from "react";

export class ModuleErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Module render error:", error);
    // Send to error tracking (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-red-500">
          Something went wrong loading this section.{" "}
          <button onClick={() => this.setState({ hasError: false })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Frontend Error Rules:**
- Every `useMutation` MUST have an `onError` handler with a toast notification
- Every `useQuery` MUST handle the `error` state — never leave it unrendered
- NEVER silently swallow errors (`catch (e) {}` with no action)
- Form submissions MUST show field-level errors from 400 responses

---

## 🧪 TESTING STANDARD

```typescript
// server/v2/<module>/<module>.test.ts
describe("MyModule", () => {
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    tenantId = await createTestTenant();
    token = generateTestToken({ tenantId, userType: "manager" });
  });

  afterAll(async () => {
    await cleanupTestTenant(tenantId);
  });

  describe("GET /api/v2/my-module/entities", () => {
    it("returns paginated list", async () => {
      const res = await request(app)
        .get("/api/v2/my-module/entities")
        .set("Authorization", `Bearer ${token}`)
        .set("x-tenant-id", tenantId);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("hasMore");
    });

    it("returns 401 without token", async () => {
      const res = await request(app).get("/api/v2/my-module/entities");
      expect(res.status).toBe(401);
    });

    it("returns 403 for viewer on protected route", async () => {
      const viewerToken = generateTestToken({ tenantId, userType: "viewer" });
      const res = await request(app)
        .post("/api/v2/my-module/entities")
        .set("Authorization", `Bearer ${viewerToken}`)
        .set("x-tenant-id", tenantId)
        .send({ name: "test" });
      expect(res.status).toBe(403);
    });
  });
});
```

**Testing Rules:**
- Controller integration tests must cover: 200, 400, 401, 403, 404
- Service unit tests must cover: happy path + all error branches
- Each test suite uses isolated test tenant via `createTestTenant()`
- NEVER test against a shared tenant

---

## ✅ MODULE CHECKLIST

Before submitting any new module, verify every item:

### Error Handling
- [ ] `AppError` / `NotFoundError` / `ValidationError` used — no raw `Error` throws
- [ ] `globalErrorHandler` registered as last middleware in `server/index.ts`
- [ ] No stack traces or DB errors exposed in API responses
- [ ] Services throw typed errors; controllers do NOT catch and re-throw
- [ ] Zod errors caught by `globalErrorHandler` → 400 with field details

### API Response Shape
- [ ] All success responses use `successResponse()` or `paginatedResponse()` helpers
- [ ] HTTP status codes match the standard table (201 for create, 202 for async, etc.)

### Transactions
- [ ] Any service writing to 2+ tables uses `withTransaction()`
- [ ] Repository methods accept an optional `tx` parameter

### Environment
- [ ] All required env vars declared in `env.ts` Zod schema
- [ ] `env.ts` imported first in `server/index.ts`

### Shutdown & Jobs
- [ ] `registerGracefulShutdown()` called in `server/index.ts`
- [ ] BullMQ queues define `attempts`, `backoff`, and `removeOnFail`
- [ ] Worker `failed` and `error` events are logged

### TypeScript
- [ ] `strict: true` in `tsconfig.json`
- [ ] No `any` types, no `@ts-ignore`
- [ ] `noImplicitReturns: true` — all code paths return a value

### Security
- [ ] Every route has explicit `requireRole()` middleware
- [ ] Global rate limiter applied via `globalRateLimiter` middleware
- [ ] Auth endpoints use `authRateLimiter`
- [ ] Input sanitized via `sanitizeObject()` in service layer
- [ ] Helmet security headers applied at app level
- [ ] All list endpoints use `normalizePagination()` — no unbounded queries

### Observability
- [ ] All controller errors use `req.log` (not `console.error`)
- [ ] All write operations emit `auditService.log()`
- [ ] Correlation ID passed through request lifecycle
- [ ] Health check endpoint updated for new service dependencies

### Caching
- [ ] Master/lookup data cached with `withCache()` + `tenantCacheKey()`
- [ ] Cache invalidated in mutation services (`invalidateTenantCache`)
- [ ] TTL appropriate for data type

### Database
- [ ] Every table has `id` (serial PK) + `uuid` (text unique)
- [ ] Every table spreads `...auditColumns` (all 7 standard columns from `audit.ts`)
- [ ] `created_by_uuid` / `updated_by_uuid` set in repository — never from client input
- [ ] `updated_at` updated on every PATCH/PUT; `created_at` never modified after insert
- [ ] Soft delete via `is_deleted` (not hard DELETE) in production
- [ ] Table name ends with `_v2` suffix
- [ ] All column names use `snake_case`
- [ ] Mandatory indexes created (`uuid`, `is_deleted`, `created_at`)
- [ ] Partial index on `is_deleted = false` for active-row queries
- [ ] **No `json` / `jsonb` columns** — data normalized into proper tables
- [ ] **Files stored as base64** with `file_name`, `file_data`, `file_size`, `mime_type` columns
- [ ] **List queries exclude `file_data`** — fetch base64 only on single-record GET
- [ ] **Every FK column uses `.references()`** with explicit `onDelete` behavior
- [ ] **Every FK column has a dedicated index** for JOIN performance
- [ ] Composite indexes created for frequent multi-column query patterns
- [ ] **No N+1 queries** — uses `inArray()` batch loading or JOINs, never queries in loops

### Backend
- [ ] All new code is under `server/v2/<module>/`
- [ ] Nothing added to `storage.ts`, `database.ts`, or `shared/schema.ts`
- [ ] Every repository uses `getDb()` from `server/v2/db.ts`
- [ ] Controllers have ZERO business logic
- [ ] Services have ZERO `req`/`res` references
- [ ] Repositories have ZERO business rules
- [ ] All request bodies validated with Zod
- [ ] No file exceeds 3000 lines
- [ ] No `any` types used
- [ ] Migration file created (not modified existing)
- [ ] Routes mounted in `server/routes.ts` via `app.use()`

### Tests
- [ ] Controller integration tests cover: 200, 400, 401, 403, 404
- [ ] Service unit tests cover: happy path + all error branches
- [ ] Test uses isolated test tenant (not shared tenant)
- [ ] Test token generated with `generateTestToken()` utility

### Frontend
- [ ] Module lives in `client/src/modules/<module>/`
- [ ] API client uses `apiRequest()` from `@/lib/queryClient`
- [ ] No manual header injection
- [ ] Data fetching uses TanStack Query (`useQuery`/`useMutation`)
- [ ] Forms use React Hook Form + Zod
- [ ] UI uses `shadcn/ui` components only
- [ ] Route registered in `App.tsx` with `<ProtectedRoute>`
- [ ] Module entry is lazy-loaded AND wrapped in `<ModuleErrorBoundary>`
- [ ] No component file exceeds 3000 lines
- [ ] Types imported from `@shared/v2/<module>/types`

### Multi-Tenancy
- [ ] Repository uses `getDb()` — not direct pool/db import
- [ ] No manual `x-tenant-id` reading — middleware handles it
- [ ] No `tenant_id` column in tables (isolation is at DB level)
- [ ] Tested with at least 2 different tenant IDs
- [ ] Cache keys scoped via `tenantCacheKey()`
- [ ] Audit logs contain `tenantId` context

---

## ❌ DON'Ts

| # | ❌ DON'T | Why | ✅ DO Instead |
|---|---|---|---|
| 1 | Add routes without `requireRole()` | Any logged-in user can call admin endpoints | Every route explicitly declares minimum required role |
| 2 | Return unbounded lists from `getAll()` | OOM at scale, DB timeout | Always use `normalizePagination()` with enforced max |
| 3 | Use `console.log/error` in controllers | No tenant/correlation context | Use `req.log.info/error()` from `pino` |
| 4 | Write audit logic in controllers | Duplicated, inconsistent | Call `auditService.log()` from the service layer |
| 5 | Create cache keys without tenant scope | Tenant A sees Tenant B's data | Always prefix with `tenantCacheKey(tenantId, ...)` |
| 6 | Open direct DB pool per tenant without limits | 50 tenants × 20 connections = DB crash | Set `max: 5` per tenant pool, use PgBouncer |
| 7 | Call slow APIs / send emails inline in requests | P99 response time explodes | Queue via BullMQ, return `202 Accepted` |
| 8 | Skip error boundaries on module routes | One bad module crashes entire app | Every lazy-loaded route wrapped in `<ModuleErrorBoundary>` |
| 9 | Write tests against shared tenant | Tests interfere, flaky | Each test suite creates isolated tenant via `createTestTenant()` |
| 10 | Deploy without health check | Load balancer routes to dead instances | `/api/health` checks DB + Redis + returns 503 when degraded |
| 11 | Add business logic to controllers | Violates separation of concerns | Move to service layer |
| 12 | Add req/res references to services | Breaks testability | Services are pure — no HTTP context |
| 13 | Use `any` types | Defeats TypeScript safety | Use proper types or generics |
| 14 | Modify existing migration files | Breaks deployed environments | Always create new migration files |
| 15 | Hard DELETE records in production | Unrecoverable data loss | Use `is_deleted = true` soft delete |
| 16 | Throw raw `new Error("...")` in services | No HTTP mapping, no machine-readable code | Throw `NotFoundError`, `ValidationError`, or `AppError` |
| 17 | Catch errors in controllers to manually respond | Bypasses `globalErrorHandler`, inconsistent shape | Let errors propagate — `globalErrorHandler` formats everything |
| 18 | Expose DB error messages or stack traces in responses | Leaks schema/internals to clients | `globalErrorHandler` returns only `code` + `message` |
| 19 | Write to multiple tables without a transaction | Partial write = silent data corruption | Wrap in `withTransaction()` |
| 20 | Boot the app without validating env vars | Runtime crash deep inside a user request | Validate all env vars in `env.ts` at startup with Zod |
| 21 | Use `// @ts-ignore` or `as any` | Defeats TypeScript safety, hides real bugs | Fix the type properly or use `unknown` + type guard |
| 22 | Define BullMQ jobs without retry config | One transient error permanently loses the job | Set `attempts`, `backoff`, and `removeOnFail` on every queue |
| 23 | Leave `useMutation` without an `onError` handler | User sees no feedback on failure | Every mutation has `onError` with a toast notification |
| 24 | Return `null` from a service when a record is expected | Caller can't distinguish 404 from error | Throw `NotFoundError` — never return null for expected records |
| 25 | Use `json` / `jsonb` columns for structured data | No FK enforcement, no indexing, no schema validation | Normalize into proper relational tables with typed columns |
| 26 | Store FK references as plain text without `.references()` | Orphaned rows, no referential integrity | Every FK column uses `.references(() => parent.uuid)` with `onDelete` |
| 27 | Create tables without indexes on FK / filter columns | Full table scans at scale, queries degrade exponentially | Index every FK column, every `WHERE` column, use composite indexes |
| 28 | Store base64 files without metadata columns | No way to filter by type, unknown file sizes | Always include `file_name`, `file_data`, `file_size`, `mime_type` |
| 28b | Include `file_data` in list/getAll queries | Pulls MB of base64 per row, OOM risk at scale | Exclude `file_data` from list queries — fetch only on single-record GET |
| 29 | Execute DB queries inside loops (N+1) | 100 records = 101 queries, API latency explodes | Use `inArray()` batch loading or JOINs — never query in a loop |
| 30 | Redefine audit columns per table manually | Inconsistent columns, missing fields | Always spread `...auditColumns` from `shared/v2/schema/audit.ts` |

---

## 🏗️ Infrastructure (50+ Clients)

### Deployment Architecture

```
                      ┌─────────────────────┐
                      │   Load Balancer      │
                      │   (nginx / ALB)      │
                      └──────────┬──────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
       ┌────────▼──────┐ ┌───────▼──────┐ ┌──────▼────────┐
       │  App Server 1  │ │ App Server 2  │ │ App Server N  │
       │  (Node.js)    │ │  (Node.js)   │ │  (Node.js)   │
       └────────┬──────┘ └───────┬──────┘ └──────┬────────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                ┌────────────────┼─────────────────┐
                │                │                  │
       ┌────────▼──────┐ ┌───────▼──────┐ ┌────────▼──────┐
       │   PgBouncer    │ │    Redis      │ │  BullMQ       │
       │ (conn pooler)  │ │ (cache/queue) │ │  Workers      │
       └────────┬──────┘ └──────────────┘ └───────────────┘
                │
      ┌─────────┼────────────────────────┐
      │         │                        │
┌─────▼─────┐ ┌─▼────────┐        ┌─────▼───────┐
│ Master DB  │ │Tenant A  │  ...   │ Tenant N DB  │
│ (tenants)  │ │  DB      │        │             │
└───────────┘ └──────────┘        └─────────────┘
```

### Scaling Thresholds

| Component | < 10 Clients | 10–50 Clients | 50+ Clients |
|---|---|---|---|
| DB Connections | Direct pool per tenant | PgBouncer required | PgBouncer + read replicas |
| Caching | Optional | Redis required | Redis Cluster |
| Background Jobs | Inline | BullMQ + 1 worker | BullMQ + dedicated worker fleet |
| App Servers | 1 instance | 2 instances (HA) | Auto-scaling group |
| Monitoring | Logs only | Logs + metrics | Full APM (Datadog/Grafana) |

---

*Document Version: 2.0 — Strengthened for 50+ Client Scale*
*Next Review: Before onboarding client #25*
