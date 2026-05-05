# SAIL Crewing

## Overview
A comprehensive maritime crew management platform (CrewingV2) with multi-tenant PostgreSQL architecture. Manages seafarer performance, crew deployment, vessel operations, and regulatory compliance. No standalone login — authenticates via parent app (SAIL Audits) using AES-encrypted JWT in sessionStorage.

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
- JWT from parent app (SAIL Audits), stored AES-encrypted in sessionStorage under `credentials`
- `authToken.ts`: decrypts token, handles logout/redirect to `VITE_PARENT_LOGIN_URL`
- Dev bypass: `AUTH_BYPASS=true` (backend), `VITE_AUTH_BYPASS=true` (frontend)
- 401 responses trigger storage clear + redirect to parent login

### Client Modules
All under `client/src/modules/`:
- `admin/`, `crewing/`, `crew-pool/`, `drugs-alcohol/`, `promotions/`, `recruitment/`, `rest-hours/`, `rotation/`, `vessel/`, `accounts/`, `training-retention/`

### Training Needs Aggregator (Training & Ret. > Training)
- Backend: `server/v2/training-needs/` (single repository.ts + routes.ts) — mounted at `/api/v2/training-needs`
- Schema: `shared/v2/training-needs/schema.ts` — `training_needs_other_v2` table for free-form entries
- Aggregator GET `/` joins 4 sources: `screening_b7_training_items` (Recruitment), `appr_training_followups_v2` (Appraisal), `promo_training_needs_v2` (Promotion), `training_needs_other_v2` (Others)
- Sourced rows: limited PATCH (status/targetDate/comments only) — Recruitment lacks status column, Promotion lacks comments column (silently dropped)
- Others rows: full CRUD via `/others` endpoints

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