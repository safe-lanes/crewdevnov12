# SAIL Crewing — Multi-Tenant Production Audit Report

**Date:** 16-Mar-2026  
**Scope:** Full application audit for 10-tenant production deployment  
**Architecture:** Database-per-tenant isolation via MASTER_DATABASE_URL

---

## EXECUTIVE SUMMARY

The application uses a strong isolation model (separate PostgreSQL database per tenant) with `AsyncLocalStorage`-based request scoping. The V2 backend is well-architected with consistent `getDb()` usage across all repositories and services. Several security hardening measures have been implemented (tuid validation, circuit-breaker, rate limiting, log sanitization, connection pooling).

**However, 5 critical/high issues and 8 medium issues remain before production.**

---

## 1. API & ROUTE ISOLATION

### 1.1 V2 Routes — PASS
All V2 routes (`/api/v2/*`) go through `tenantMiddleware`, which validates the `x-tenant-id` header against the master database and establishes per-request tenant DB context via `AsyncLocalStorage`. No V2 service or repository bypasses `getDb()`.

**Modules verified:** Recruitment, Crew Pool, Vessel, Rotation, Rest Hours, Admin, Masters, Ports, Drugs & Alcohol, Promotions, Appraisals.

### 1.2 V1 Legacy Routes — CRITICAL GAP
**Severity: CRITICAL**

| Route | Method | Issue |
|---|---|---|
| `/api/crew-members` | GET | Uses `storage` singleton (DATABASE_URL), bypasses tenant context |
| `/api/pay-elements` | GET/POST | Same |
| `/api/pay-elements/:id` | PUT | Same |
| `/api/contract-pay-elements` | POST | Same |
| `/api/contract-pay-elements/:id` | PUT | Same |

The `storage` singleton is initialized at startup with `DATABASE_URL` and never switches databases. In multi-tenant mode, these routes serve data from the wrong database regardless of which tenant is making the request.

**Remediation:** Task #19 (already planned) — either make V1 routes tenant-aware or block them in multi-tenant mode.

### 1.3 Exempt Routes — PASS
- `/api/v2/tenant/init` — Correctly exempt (purpose is to return tuid)
- `/api/health` — Correctly exempt (infrastructure health check)

### 1.4 production.ts — FIXED
`production.ts` now includes `tenantConnectionManager.init()`, `tenantMiddleware`, and graceful shutdown with `closeAll()`.

---

## 2. DATABASE CONNECTION ISOLATION

### 2.1 Master DB Usage — PASS
`masterDb` is used exclusively for tenant lookup (`resolveTenant`) and tuid validation (`validateTuid`). No business data queries touch the master database.

### 2.2 Per-Tenant DB Strategy — PASS
Dynamic connection string per tuid (database name = tuid). Separate `pg.Pool` per tenant. No schema switching — full database isolation.

### 2.3 Connection Pool Configuration (10 tenants) — PASS
| Setting | Value | Impact |
|---|---|---|
| Pool max per tenant | 5 (configurable via `TENANT_POOL_MAX`) | 10×5 = 50 connections |
| Master pool | 5 | +5 = 55 total |
| Global cap | 80 (configurable via `GLOBAL_MAX_CONNECTIONS`) | Headroom of 25 |
| Idle eviction | 30 minutes | Pools stay alive during business hours |
| Cache TTL | 5 minutes | ~2 master DB queries per tenant per 5 min |

### 2.4 Connection Leak Prevention — PASS
- Circuit-breaker: 3 failures → 30s cooldown per tenant
- Per-tenant pool creation lock prevents concurrent oversubscription
- Migration failure cooldown prevents thrashing
- Graceful shutdown closes all pools

### 2.5 Credential Storage — PASS
All tenant databases share the PostgreSQL user/password from `MASTER_DATABASE_URL` environment variable. No credentials stored in any database table.

---

## 3. SECURITY & TENANT BLEED

### 3.1 Cross-Tenant Query Risk — PASS (V2) / CRITICAL (V1)
V2 uses database-per-tenant isolation — queries cannot cross tenants. V1 routes bypass tenant context entirely (see 1.2).

### 3.2 Tenant Spoofing — MITIGATED
`validateTuid()` checks every `x-tenant-id` header against the master database (cached 5 min). Fabricated tuids are rejected with 403. However, there is no binding between a user's authentication and a specific tenant (see 3.3).

### 3.3 Authentication — HIGH GAP
**Severity: HIGH**

No server-side authentication exists in this codebase. No JWT, no session management, no Passport.js, no cookie-based auth. The only access control is the `x-tenant-id` header validation.

**Risk:** If a user from Tenant A discovers Tenant B's tuid, they can access Tenant B's data by simply changing the header value.

**Remediation:** Authentication must be implemented or confirmed to exist in an external gateway/reverse proxy.

### 3.4 Tenant Init Endpoint — MEDIUM GAP
**Severity: MEDIUM**

`POST /api/v2/tenant/init` is unauthenticated and returns the tuid for any valid domain. An attacker who guesses or knows a company domain can enumerate tenant identifiers.

**Mitigated by:** Rate limiting (15 req/min per IP).  
**Remediation:** Consider requiring a verification token or implementing domain whitelisting.

### 3.5 TUID Storage on Frontend — MEDIUM GAP
**Severity: MEDIUM**

The `tenantId` is stored in `localStorage` as **plain text**. While the domain is encrypted, the tuid (which is the actual access key) is not.

**Remediation:** Encrypt the tuid in localStorage using the existing `encryptionService`.

### 3.6 File Storage — PASS
Attachments stored as base64 in per-tenant database columns. No shared file system or cloud storage paths. Isolation is inherent from the database-per-tenant model.

### 3.7 Background Jobs — PASS
No cron jobs, queues, or scheduled tasks exist. External API sync is on-demand and runs within tenant context.

### 3.8 Log Sanitization — PASS (FIXED)
Tenant IDs are masked in all log output (`maskTuid()` shows first 8 chars + `***`). Domain values removed from external API sync logs.

### 3.9 Rate Limiting — PASS (FIXED)
| Endpoint | Limit |
|---|---|
| All `/api/` routes | 200 req/min per IP |
| `/api/v2/tenant/init` | 15 req/min per IP |
| `/api/health` | Exempt |

---

## 4. FRONTEND TENANT HANDLING

### 4.1 Global Fetch Interceptor — PASS
`tenantFetch.ts` monkey-patches `window.fetch` to inject `x-tenant-id` on all `/api` requests. Loaded at application entry point (`main.tsx`).

### 4.2 Double Header Injection — LOW
Both `tenantFetch.ts` (global interceptor) and `queryClient.ts` (React Query helpers) inject the `x-tenant-id` header independently. This is redundant but not harmful — the second header set overwrites the first.

### 4.3 External API Calls — PASS
Calls to external APIs (non-`/api` paths) correctly bypass tenant header injection. External master data hooks pass `domain` as a query parameter instead.

### 4.4 Domain Fallback — MEDIUM GAP
**Severity: MEDIUM**

Several hooks (`useExternalVessels.tsx`, `useLocalMasterApi.tsx`) use `localStorage.getItem('domain') || 'rsms'` as a fallback domain. If localStorage is cleared or corrupted, requests will use `'rsms'` as the domain, potentially loading the wrong tenant's master data from external APIs.

**Remediation:** Remove hardcoded `'rsms'` fallback; fail explicitly if domain is missing.

---

## 5. ERROR HANDLING & INFORMATION LEAKAGE

### 5.1 Stack Traces — PASS
Global error handler suppresses stack traces in API responses. Full traces logged server-side only.

### 5.2 Error Message Leakage — MEDIUM
**Severity: MEDIUM**

Two controllers leak raw `error.message` in 500 responses:
- `server/v2/appraisals/controllers/appraisalResultsController.ts` (stage submission errors)
- `server/v2/crew-pool/controllers/crewDocumentsController.ts` (document creation errors)

Database constraint names, table names, or driver messages could be exposed to the client.

**Remediation:** Replace `error.message` with generic messages in 500 responses.

### 5.3 Health Check Info Disclosure — LOW
`/api/health` exposes RDS endpoint and database name when `NODE_ENV=development`. Safe if production always uses `NODE_ENV=production`.

### 5.4 Tenant Init Response — LOW
`/api/v2/tenant/init` returns `dbName` (which equals `tuid`). This confirms the internal naming convention but the tuid is already returned as `tenantId`.

**Remediation:** Consider removing `dbName` from the response if the frontend doesn't need it.

---

## 6. SCALE & LOAD READINESS (10 Tenants)

### 6.1 Master DB Load — PASS
Validation cache TTL of 5 minutes means ~2 queries/tenant/5min = ~24 queries/hour total for 10 tenants. Negligible load.

### 6.2 Connection Pool Math — PASS
55 total connections (10×5 + 5 master) against a default PG `max_connections` of 100. Comfortable headroom.

### 6.3 Lazy Migration — PASS (FIXED)
Migrations run on first tenant login per server restart. No startup delay. Migration failures have 30s cooldown.

### 6.4 Multi-Tenant Migration Runner — PASS (FIXED)
`runMigrationsForTenant()` applies pending migrations to each tenant DB on first connection. Tracked in a `Set<string>` per server session.

### 6.5 No N+1 Patterns — PASS
Single query per cache miss for tenant resolution. Pool and validation caches prevent repeated lookups.

---

## 7. GLOBAL STATE & DATA LEAK RISK

### 7.1 V2 Services/Repositories — PASS
All V2 services are stateless singletons. They retrieve the tenant DB via `getCurrentTenantDb()` (from AsyncLocalStorage) at the start of every method. No tenant data cached on service objects.

### 7.2 MemStorage — CRITICAL (if misused)
**Severity: CRITICAL (conditional)**

`server/storage-mem.ts` uses in-memory Maps with no tenant isolation. If `MemStorage` is ever activated in multi-tenant production, all tenant data would be shared/mixed.

**Current state:** Only used when `DATABASE_URL` is not set (dev mode). Safe as long as production always has `DATABASE_URL`.

**Remediation:** Add a guard that throws an error if `MemStorage` is instantiated when `MASTER_DATABASE_URL` is set.

### 7.3 vesselMasterSafety Cache — LOW
`masterTypeCache` in `server/vesselMasterSafety.ts` caches static master type flags globally. Safe because master type IDs are the same across all tenants. Would need refactoring if master IDs become tenant-specific.

---

## 8. ENVIRONMENT CONFIGURATION

### 8.1 Required Production Environment Variables

| Variable | Required | Current Status |
|---|---|---|
| `MASTER_DATABASE_URL` | Yes | Must point to master DB with `tenants` table |
| `DATABASE_URL` | Yes | Needed for V1 legacy routes and initial migration |
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | Yes | Default 4000 in production.ts |
| `TENANT_POOL_MAX` | Optional | Default 5 (good for 10 tenants) |
| `GLOBAL_MAX_CONNECTIONS` | Optional | Default 80 |
| `VITE_CLIENT_ENCRYPTION_KEY` | Yes | Must be a strong secret, not default |
| `VITE_AG_GRID_LICENSE_KEY` | Yes | Enterprise license required |
| `VITE_API_BASE_URL` | Check | Defaults to `https://dev.sl-sail.com/b/api/v1` — must be overridden for production |

### 8.2 Hardcoded Values — MEDIUM
**Severity: MEDIUM**

- `VITE_API_BASE_URL` defaults to `https://dev.sl-sail.com/b/api/v1` — a dev URL
- `VITE_CLIENT_ENCRYPTION_KEY` defaults to empty or `sailAdmin` — weak
- Domain fallback `'rsms'` in several frontend hooks

---

## FINDINGS SUMMARY (Ranked by Severity)

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **CRITICAL** | V1 legacy routes bypass tenant isolation entirely | Task #19 planned |
| 2 | **HIGH** | No server-side authentication — tenant access relies on header only | Needs auth layer |
| 3 | **CRITICAL** | MemStorage has no multi-tenant guard — would mix all data if activated | Needs guard |
| 4 | **MEDIUM** | Tenant init endpoint returns tuid without authentication | Rate-limited |
| 5 | **MEDIUM** | TUID stored in localStorage as plain text (not encrypted) | Needs encryption |
| 6 | **MEDIUM** | Hardcoded domain fallback 'rsms' in frontend hooks | Needs removal |
| 7 | **MEDIUM** | Two controllers leak error.message in 500 responses | Needs fix |
| 8 | **MEDIUM** | VITE_API_BASE_URL defaults to dev URL | Config fix |
| 9 | **MEDIUM** | VITE_CLIENT_ENCRYPTION_KEY defaults to weak value | Config fix |
| 10 | **LOW** | Double header injection (redundant but harmless) | Optional cleanup |
| 11 | **LOW** | Health check exposes RDS endpoint in dev mode | Safe if NODE_ENV correct |
| 12 | **LOW** | dbName in tenant init response (redundant with tenantId) | Optional removal |
| 13 | **LOW** | vesselMasterSafety global cache (static data, safe for now) | Monitor |

### Already Fixed in This Audit Cycle
- Server-side tuid validation on every request (Task #18)
- production.ts tenant middleware + graceful shutdown
- Lazy per-tenant migration runner
- Circuit-breaker for unreachable tenant DBs
- Configurable connection pools with global cap
- Rate limiting (200/min global, 15/min tenant init)
- Log sanitization (masked tuids)
- trust proxy configuration

---

## RECOMMENDED TASK PRIORITY

1. **P0 (Before Production):** Fix V1 route isolation (#19), add MemStorage guard
2. **P1 (Before Production):** Fix error message leakage, remove 'rsms' fallback, encrypt tuid in localStorage
3. **P2 (Soon After):** Confirm authentication layer (external or implement), secure tenant init endpoint
4. **P3 (Maintenance):** Remove dbName from init response, clean up double header injection
