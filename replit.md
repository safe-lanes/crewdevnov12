# SAIL Crewing

## Overview
A comprehensive maritime operations platform designed to streamline and manage all aspects of seafarer performance, crew deployment, vessel operations, and regulatory compliance. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and optimize crew management through advanced analytics and robust data handling. Its core capabilities include detailed seafarer appraisal workflows, dynamic crew rotation and recruitment, real-time vessel management, and automated compliance checks for rest hours, training, and drug & alcohol policies. The platform provides a unified view for maritime stakeholders to make informed decisions, improve crew welfare, and ensure safe and efficient vessel operations.

## Recent Changes
- **2026-02-26**: Changed "Hours of Rest/Work in any 24 Hr Period" calculation for Violation Types 1 and 5 from rolling-window to work-anchored logic: `rest = 24 − maxWork`, `work = maxWork` where maxWork is found across all valid 24h windows ending at-or-after the first work slot on the current day. Both Violation 1 (rest < 10h) and Violation 5 (work > 14h) are now derived from this per-day metric. Both Rest and Work modes use the same anchored window for consistency. Red highlighting on hover shows the correct 24h window. Files: `timelineCalculations.ts` (`calculateRestIn24HWorkAnchored`), `RHRecordingForm.tsx`.
- **2026-02-26**: Re-derived Violation 3 from the same work-anchored 24h window as Violation 1. Code 3 is now stripped from the old per-slot pipeline and re-checked against the worst-case window used by Violation 1. This ensures `[3]` only appears alongside `[1]` (never alone), and both violations reference the same 24h window. Detection logic unchanged: longest rest period ≥6h AND top-two sum ≥10h. Files: `RHRecordingForm.tsx`.
- **2026-02-26**: Completed systematic re-derivation of all 8 violation codes from per-day metrics. All violations are now computed in the per-day loop from work-anchored windows (codes 1,3,4,5,7) and rolling period metrics (codes 2,6,8), replacing the old per-slot pipeline output. The old pipeline (`detectTimelineViolations`, `groupViolationsByDay`) is still called but its output is unused — retained for potential future cleanup. `calculateMaxWorkInAny72HourPeriod()` added for OPA Violation 8. `checkCode4ViolationWithRange()` used for Violation 4. Files: `timelineCalculations.ts`, `RHRecordingForm.tsx`.
- **2026-02-26**: Changed "Hours of Rest in any 7 Day period" to use rolling 168-hour sliding window — scans all 336-slot windows ending on each day's slots and takes the minimum rest found. This correctly handles cross-midnight work patterns (analogous to the 24-hour period calculation). Work in 7 days = 168 − rest7day. Added `calculateMinRestInAny7DayPeriod()` in `timelineCalculations.ts`. Removed `calculateTimelineRollingMetrics` import. Files: `timelineCalculations.ts`, `RHRecordingForm.tsx`.
- **2026-02-25**: Rebuilt S.On/Off column business logic in Rest Hours > Record > Table. (1) Crew visibility: replaced `isCurrent=true` filter with date-range overlap query against all `crewAssignments` — crew now appear in months where their assignment overlaps (signOnDate ≤ lastDayOfMonth AND signOffDate ≥ firstDayOfMonth or null). (2) `signOnOffInfo` now shows "S.On: DD-Mon-YYYY" if joined that month, "S.Off: DD-Mon-YYYY" if left that month, both if same month, or empty if full-month crew. (3) Rest-hour violation and recording-percentage calculations now clipped to the crew member's applicable date range within the month (from sign-on day to sign-off day). Updated: `crewRecordsService.ts`, `dailyRecordsService.ts`, `violationHelpers.ts`, `RHCrewRecordsTable.tsx`.
- **2026-02-24**: Vessel-based access control for Ship users. Added `userType` extraction from encrypted ERP user profile (encryptionService.ts). Exposed `userType` via PermissionsContext. In VesselModule_v2: Ship users (`userType === "Ship"`) auto-select their assigned vessel from `myVessels`, skip the Vessel Database grid, and land directly on the vessel detail view (Crew List). Vessel name shown as static text (no dropdown), Back button hidden. Shows "no vessel assigned" message if `myVessels` is empty or vessel not found. Office users see unchanged behavior. Graceful degradation: shows all vessels when no ERP profile (dev mode).
- **2026-02-24**: RBAC Phase 2 — Enforced canCreate/canEdit/canDelete permissions across all 9 modules. Gated CRUD buttons in: Vessel (Vessel Database edit, Officer Matrix edit), Recruitment (create/edit/delete per sub-page), Crew Pool (edit crew, create crew), Appraisals (edit/delete via AG Grid context), D&A (create/edit per sub-tab: Annual, Periodic, Monthly, Post Incident, Others, Summary), Rest Hours (Rest Hours Plan CRUD), Promotions (edit via AG Grid action column), Admin (Rank Admin edit/delete, Company Ranks edit, Admin Training Matrix edit/delete, Masters edit/create, Forms create), Rotation (Plan create/edit/delete). Pattern: `permissions.length === 0 || canXxx("MenuName")` for graceful degradation. Added `warnUnknownMenu()` helper in PermissionsContext to log warnings when permission checks reference unknown menu names. All menu names verified against `adm_menumaster_ac.name` values in migration 0096.
- **2026-02-23**: Implemented role-based access control (RBAC) for sidebar navigation. All 8 module sidebars (Admin, Recruitment, Rotation, D&A, Rest Hours, Vessel, Crew Pool, Appraisals) and HeaderComponent mobile nav filter items based on user permissions from PermissionsContext. Uses canView() with page-to-menu name mapping. Multi-stage profile extraction handles truncated encrypted JSON from parent ERP: full decrypt → partial string regex → raw decrypt fallback. Backend API at `/api/v2/admin/access-control/my-permissions` supports both roleId and roleName params. Graceful degradation: shows all items when no ERP profile/permissions (dev mode).
- **2026-02-20**: Migrated legacy master data APIs to v2. Created dataMasterController.ts with complete v2 master CRUD and external sync logic under /api/v2/masters/data and /api/v2/masters/external. Updated all frontend consumers.
- **2026-02-20**: Added sign-on conflict validation for crew deployment. Backend endpoint: GET /api/v2/vessel/planning/check-sign-on-conflict/:crewUuid.
- **2026-02-20**: Added comprehensive Swagger/OpenAPI documentation at `/api/docs` covering all ~373 endpoints across 11 v2 modules and legacy routes.
- **2026-02-18**: Dropped 27 legacy v1 database tables via migration 0094. Added `npm run db:backup` script for full database backups before destructive operations. Removed Drizzle schema definitions for dropped tables from shared/schema.ts. Tables retained (still used by runtime): company_ranks, forms, id_counters, revisions, users, vessel_planning, vessels.
- **2026-02-18**: Migrated shared hooks from legacy /api/ routes to /api/v2/admin/ endpoints. Hooks migrated: useRankNormalization, useCompanyRanks, useRankOrdering, useTrainingMaster, TrainingCourseSelectionDialog, formCommands. Removed 32 dead legacy route handlers from routes.ts (forms, available-ranks, company-ranks, training-master, company-training-groups, company-trainings, company-training-requirements). Remaining legacy routes: crew-members, masters, master-data, pay-elements, contract-pay-elements, external sync.
- **2026-02-18**: Backend cleanup — removed ~190 dead /api/ route handlers from routes.ts (10,265→2,431 lines), cleaned storage.ts (8,325→5,301 lines) and database.ts (5,391→1,950 lines). Removed dead server modules (oilMajorRulesParser.ts, complianceEngine.ts). Total backend reduction: ~14,300 lines removed.
- **2026-02-18**: Major codebase cleanup — removed all v1 module code, version toggle infrastructure, and debug artifacts. Consolidated all modules into a single clean codebase (formerly v2). Removed ~75 debug PNGs, ~35 obsolete markdown docs, ~20 test scripts, backup files, and old config files from root. Promoted v2 code to module root across all 9 client modules (Admin, Crewing/Appraisals, Drugs & Alcohol, Vessel, Rotation, Crew Pool, Rest Hours, Promotions, Recruitment). Consolidated recruitment-v2/ directory into recruitment/. Removed all VersionToggle components and useVersion hooks.

## User Preferences
### Code Style
- Functional components with hooks
- TypeScript strict mode
- async/await over promise chains
- Consistent error handling
- PascalCase for components, camelCase for functions

### Communication Style
- Concise and professional
- Focus on technical accuracy
- Document architectural decisions

### Database Migration Requirements
- Always update migrations when adding new features
- Sequential numbering: `NNNN_descriptive_name.sql`
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent migrations
- Separate backfill migrations for data consolidation

## System Architecture
The system is built on a modern full-stack architecture using **React 18** (Vite, Tailwind CSS, shadcn/ui, AG Grid Enterprise, TanStack Query v5, React Hook Form, Zod, Wouter) for the frontend and **Express.js** with **TypeScript** for the backend. **PostgreSQL** serves as the primary database, managed with **Drizzle ORM**.

The backend follows a **Repository + Service + Controller pattern** for separation of concerns and maintainability. V2 backend routes are organized under `server/v2/` by feature domain. The original `server/routes.ts` still contains shared API endpoints (e.g., `/api/crew-members`, `/api/masters`) used across the system.

### Client Module Structure
All client modules live under `client/src/modules/` with a flat structure (no v1/v2 subdirectories):
- `admin/` — Company admin, forms, rank groups, vessel configuration
- `crewing/` — Crew appraisals (3-stage workflow)
- `crew-pool/` — Active seafarer management with UUID identifiers and soft deletes
- `drugs-alcohol/` — Drug & alcohol test management
- `promotions/` — Configurable promotion paths and checklists
- `recruitment/` — Candidate application processes
- `rest-hours/` — Work/rest hour compliance tracking
- `rotation/` — Crew rotation planning with visual timelines
- `vessel/` — Vessel data, Officer Matrix, Planning, Training Matrix
- `accounts/` — User account management

### UI/UX Decisions
- **Date Format:** DD-MMM-YYYY
- **Design System:** Utilizes shadcn/ui for consistent components.
- **Standards:** Adheres to SAIL Form Standards for layout, alignment, error handling, and loading states, ensuring a uniform user experience.

### Technical Implementations
- **Module-first architecture** for clear feature separation.
- **Master Data System:** Centralized reference data management, with dedicated V2 APIs for various master tables (vessels, nationalities, ranks, etc.) at `/api/v2/masters/`.
- **Vessel Revision System:** Supports draft and submission workflows for managing vessel-specific configurations and rank assignments.
- **Crew Deployment:** Implements a two-stage workflow (Deploy from Rotation → Sign On).

### Feature Specifications
- **Crew Pool:** Manages active seafarer data, supporting UUID identifiers and soft deletes.
- **Vessel Management:** Oversees vessel data, including Officer Matrix, Planning, and Training Matrix.
- **Recruitment:** Handles candidate application processes.
- **Rotation:** Facilitates crew rotation planning with visual timelines.
- **Rest Hours:** Ensures compliance with work and rest hour regulations.
- **Crew Appraisals:** Features a 3-stage appraisal workflow for performance evaluation.
- **Training Matrix:** Tracks certifications and training requirements for seafarers.
- **Drugs & Alcohol Testing:** Manages various test types and filtering.
- **Oil Major Compliance:** Validates crew experience against compliance standards.
- **Promotions:** Configurable promotion paths for career progression.
- **Admin / Forms Configuration:** Manages company-specific forms, including versioning, rank groups, available ranks, and promotion hierarchies.
- **V2 Masters Module:** Provides common REST endpoints at `/api/v2/masters/` for 13 master tables, including dedicated normalized tables for licenses, manning agents, crew pools, and appraisal types.

## Deployment Architecture

### Development (Replit)
- `npm run dev` — runs Express + Vite dev server on port 5000
- Frontend and backend served from same process with HMR
- Entry: `server/index.ts` → Vite middleware for frontend, Express for API
- Router base: `/` (no prefix)

### Production (PM2 + nginx)
- **Frontend**: `npm run build:frontend` → static files in `dist/public/` (base path `/crewing/`)
- **Backend**: `npm run build:backend` → API server bundled to `dist/server/index.js`
- **Combined**: `npm run build:prod` → builds both
- **PM2**: `pm2 start ecosystem.config.cjs` → runs API on port 4000
- **nginx**: serves `dist/public/` for `/crewing/`, proxies `/api/` to PM2 backend
- Entry: `server/production.ts` → Express API only (no Vite, no static files)
- Router base: `/crewing`
- Config: `deploy/nginx.conf.example`, `ecosystem.config.cjs`

### Build Scripts
| Script | Purpose |
|---|---|
| `npm run dev` | Replit dev (port 5000, Vite HMR) |
| `npm run build` | Replit production build (combined) |
| `npm run build:frontend` | Production frontend only (dist/public/) |
| `npm run build:backend` | Production backend only (dist/server/) |
| `npm run build:prod` | Production frontend + backend |
| `npm start` | Run Replit production build |
| `npm run start:prod` | Run separated production backend |

## External Dependencies
- **SAIL ERP API:** For enterprise resource planning data integration.
- **SAIL Audits API:** For auditing and compliance tracking.
