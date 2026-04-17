# SAIL Crewing

## Overview
A comprehensive maritime crew management platform (CrewingV2) with multi-tenant PostgreSQL architecture. Manages seafarer performance, crew deployment, vessel operations, and regulatory compliance. Supports both standalone login (`/login`) and parent-app (SAIL Audits) JWT coexistence; switch via `VITE_AUTH_MODE` (`standalone` | `parent`).

## System Architecture
Frontend: **React 18**, **Vite**, **Tailwind CSS**, **shadcn/ui**, **AG Grid Enterprise**, **TanStack Query v5**, **React Hook Form**, **Zod**, **Wouter**.
Backend: **Express.js**, **TypeScript**, **PostgreSQL**, **Drizzle ORM**.
Pattern: **Repository + Service + Controller**. V2 routes under `server/v2/`, shared endpoints in `server/routes.ts`.

### Multi-Tenant Architecture
- Separate PostgreSQL database per tenant
- `MASTER_DATABASE_URL` enables multi-tenant mode (master `tenants` table)
- `TenantConnectionManager` manages dynamic DB pools + AsyncLocalStorage context
- `tenantMiddleware` resolves tenant from `x-tenant-id` header or JWT domain fallback
- `authMiddleware` verifies JWT and cross-checks domain vs tenantId
- New modules use `getDb()` from `server/v2/db.ts` (reads from AsyncLocalStorage)
- Frontend: `tenantFetch.ts` auto-injects `x-tenant-id` + `Authorization: Bearer` headers
- Tenant data encrypted in localStorage via `tenantStorage.ts`

### Authentication
- Two modes via `VITE_AUTH_MODE`: `standalone` (default) shows `/login`; `parent` redirects to `VITE_PARENT_LOGIN_URL`
- Standalone module: `server/v2/auth/` — bcrypt (12 rounds), JWT access (15m) + rotated refresh (7d, sha256-hashed in `refresh_tokens`), per-IP/user rate limiting, soft account lockout (`AUTH_MAX_FAILED`/`AUTH_LOCKOUT_MIN`), forgot/reset flow with single-use hashed tokens, server-side `login_audit_log`
- Endpoints (under `/api/v2/auth/`): `login`, `refresh`, `logout`, `profile`, `change-password`, `forgot-password`, `reset-password`. Login/refresh/forgot/reset are exempt from tenant middleware and resolve domain → tenant from request body
- Client: `authToken.ts` (`setAuthSession`/`clearAuthSession`/`refreshAccessToken`/`logout`) + `tenantFetch.ts` (single-flight silent refresh on 401)
- JWT payload preserved (`id`/`domain`/`userType`) plus optional `uuid`/`username`/`roleId` for backwards compatibility
- Storage keys preserved: `credentials` (sessionStorage AES — raw access token), `refreshCredentials`, `domain`/`crewUserId` (localStorage AES JSON), `userProfile`
- Dev bypass: `AUTH_BYPASS=true` (backend skips parent middleware; standalone routes still enforce JWT via per-route verifier), `VITE_AUTH_BYPASS=true` (frontend)
- Seed first admin: `USERNAME=admin PASSWORD=… DOMAIN=… EMAIL=… npx tsx scripts/seed-auth-admin.ts`
- Required env: `JWT_SECRET` (production); optional `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `BCRYPT_ROUNDS`
- 401 responses trigger silent refresh, then redirect to `/login` (standalone) or `VITE_PARENT_LOGIN_URL` (parent)

### Client Modules
All under `client/src/modules/`:
- `admin/`, `crewing/`, `crew-pool/`, `drugs-alcohol/`, `promotions/`, `recruitment/`, `rest-hours/`, `rotation/`, `vessel/`, `accounts/`

## User Preferences
- Functional components with hooks, TypeScript strict mode
- async/await, consistent error handling
- PascalCase for components, camelCase for functions
- Date format: DD-MMM-YYYY
- Concise and professional communication

## Database Migrations
- Sequential numbering: `NNNN_descriptive_name.sql`
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent migrations
- Migrations auto-run per tenant on first connection

## Key Documentation
- `docs/multitenant-token-sequence-diagram.md` — Full multi-tenant flow diagrams (init, API requests, new module guide)
- `docs/jwt-authentication-flow.md` — JWT auth flowcharts and middleware chain
