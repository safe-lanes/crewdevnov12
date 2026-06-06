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
- `admin/`, `crewing/`, `crew-pool/`, `drugs-alcohol/`, `promotions/`, `recruitment/`, `rest-hours/`, `rotation/`, `vessel/`, `accounts/`

## Folder Structure
```
.
├── client/                 # React + Vite frontend
│   └── src/
│       ├── App.tsx, main.tsx
│       ├── components/      # Shared UI (incl. shadcn/ui)
│       ├── config/         # Frontend config
│       ├── contexts/       # React contexts (e.g. PermissionsContext)
│       ├── hooks/          # Reusable hooks (incl. v2/ data hooks)
│       ├── lib/            # queryClient, tenantFetch, authToken, utilities
│       ├── modules/        # Feature modules (admin, crewing, crew-pool,
│       │                   #   drugs-alcohol, promotions, recruitment,
│       │                   #   rest-hours, rotation, vessel, accounts)
│       ├── micro-frontend/ # Micro-frontend integration
│       ├── pages/          # Top-level routed pages
│       ├── stores/         # Zustand stores
│       ├── styles/         # Global styles
│       ├── types/          # Shared frontend types
│       └── utils/          # Frontend helpers
├── server/                 # Express + TypeScript backend
│   ├── index.ts            # App entry
│   ├── db.ts               # DB bootstrap
│   ├── routes.ts, routes/  # Shared / legacy routes
│   ├── middleware/         # tenant + auth middleware
│   ├── migrations/         # SQL migrations (auto-run per tenant)
│   ├── swagger-docs/       # API docs
│   ├── utils/              # Backend helpers
│   └── v2/                 # V2 domain modules (admin, appraisals, crew-pool,
│                           #   drugs-alcohol, masters, ports, promotions,
│                           #   recruitment, reports, rest-hours, rotation,
│                           #   training-needs, training-retention, vessel)
│                           #   + db.ts (getDb tenant accessor)
├── shared/                 # Code shared between client and server
│   ├── schema.ts           # Core Drizzle schema
│   └── v2/<domain>/schema.ts  # Per-domain Drizzle schemas
├── docs/                   # Architecture, API, auth, migration docs
├── migrations/             # Root migration assets
├── scripts/                # Maintenance / setup scripts
├── tests/                  # Test suites (Playwright / Vitest)
├── deploy/                 # Deployment assets
├── backups/                # Database backups
└── drizzle.config.ts, vite.config.ts, tailwind.config.ts, tsconfig.json, package.json
```

## Database Conventions
Apply these to **every new table**:
- **UUID column on every table**: every table has a `serial("id")` primary key AND a business `*_uuid` text column declared `.notNull().unique()` (e.g. `rh_vessel_uuid`, `rh_crew_record_uuid`). The uuid is the stable, externally-referenced identifier.
- **UUID as the foreign-key column**: relationships reference the `*_uuid` text column (e.g. `crew_uuid`, `vessel_uuid`), NOT the serial `id`. All joins are done on uuid columns.
- **Audit columns on every table**: reuse the shared `auditColumns` spread (see `shared/v2/rest-hours/schema.ts`): `sort_order`, `created_at` (defaultNow), `updated_at` (defaultNow), `created_by_uuid`, `updated_by_uuid`, `is_deleted` (default false, for soft deletes), `is_sync` (default false).
- For each model also write the `createInsertSchema` (drizzle-zod) with `.omit` for auto-generated/audit fields, the insert type (`z.infer`), and the select type (`$inferSelect`).

## Standard Development Rules
- **Every new API must follow multi-tenancy**: all new endpoints route through `tenantMiddleware` + `authMiddleware`, resolve the tenant from the `x-tenant-id` header (JWT domain fallback), and access the database via `getDb()` from `server/v2/db.ts` (tenant context from AsyncLocalStorage) — never a hardcoded or global connection. Frontend calls must use `tenantFetch.ts` (or the shared query client), which auto-injects the `x-tenant-id` and `Authorization: Bearer` headers; do not use raw `fetch` for tenant-scoped APIs.
- Follow the **Repository + Service + Controller** pattern; keep routes thin and validate request bodies with Zod before passing to the service/storage layer.
- Never edit `package.json` directly; use the package manager for dependencies.
- Do not modify the Vite setup (`vite.config.ts`, `server/vite.ts`) or `drizzle.config.ts` unless absolutely necessary.
- Secrets / environment variables are managed through the platform — never hardcode them.
- Restart the "Start application" workflow after backend changes (the backend has no hot-reload).
- Add stable, descriptive `data-testid` attributes to interactive and data-bearing UI elements.

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
- `docs/ARCHITECTURE.md` — System architecture overview
- `docs/DATABASE_SCHEMA.md` — Database schema reference
- `docs/API_DOCUMENTATION.md` — API reference
- `docs/multitenant-token-sequence-diagram.md` — Full multi-tenant flow diagrams (init, API requests, new module guide)
- `docs/jwt-authentication-flow.md` — JWT auth flowcharts and middleware chain
- `docs/MIGRATION-GUIDE.md` — Migration guidelines
- `docs/DEVELOPER-ONBOARDING.md` — Developer onboarding guide
