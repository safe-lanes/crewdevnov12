# SAIL Crewing

## Overview
A comprehensive maritime operations platform designed to streamline and manage all aspects of seafarer performance, crew deployment, vessel operations, and regulatory compliance. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and optimize crew management through advanced analytics and robust data handling. Its core capabilities include detailed seafarer appraisal workflows, dynamic crew rotation and recruitment, real-time vessel management, and automated compliance checks for rest hours, training, and drug & alcohol policies. The platform provides a unified view for maritime stakeholders to make informed decisions, improve crew welfare, and ensure safe and efficient vessel operations.

## Recent Changes
- **2026-04-11**: Added JWT authentication middleware (Task #183). Backend validates JWT tokens from parent app (SAIL Audits) via `server/middleware/authMiddleware.ts`. Supports `Authorization: Bearer` header and `?sail=` query param for static files. Graceful degradation when `JWT_SECRET` not set (local dev). Cross-tenant binding check prevents token from tenant A accessing tenant B. JWT `domain` field used as fallback for tenant resolution when `x-tenant-id` header missing. Env vars: `JWT_SECRET` (backend), `VITE_PARENT_LOGIN_URL` (frontend).
- **2026-04-02**: Fixed E1 sea service rank disappearing after sign-off (Task #130). Variant position ranks like "3rd Officer_2" didn't match dropdown options after sign-off made the row editable. Fix: normalize rank via `normalizeRank()` in Select value props and save handlers. Synced/locked rows still display full variant name as text. Files: `CrewInfoForm_v2.tsx`.
- **2026-03-31**: Fixed grid filters excluding blank/empty rows from results (Task #128). Fixed Crew Pool grid column filters for DOB, Age, Vessel, dates, Reason (Task #127). Auto-save B1 on click-outside for new crew (Task #126). Fixed rank missing in header for new crew (Task #125). Fixed attachments blocked and name missing after saving new crew (Task #124). Fixed inconsistent date formats in grids (Task #123). Fixed OOW experience to only count relevant watchkeeping ranks (Task #122). Fixed E1 sea service rows staying locked after crew sign-off (Task #121). Restricted Next Availability date picker to future dates only (Task #120). Fixed Age reappearing after DOB cleared (Task #119). Fixed photo upload not saved during auto-create (Task #118). Fixed Recruitment Rank Applied filter (Task #117).
- **2026-03-09**: Added B-section item (B2-B7) and C1 approval soft-delete reconciliation to recruitment form. Fixed sort order persistence for recruitment form.
- **2026-03-05**: Added per-section access control for Promotions and Crew Pool forms. Added year-only filter mode to RH Records. Fixed violation/NC count mismatch between RH Records Overview and Vessel Detail.
- **2026-03-03**: Fixed mobile number country code binding, comprehensive form validation, duplicate entries on save, Crew ID binding, and sort order persistence in Crew Pool form.
- **2026-02-27**: Fixed RH Recording PDF export, added Code F 7-day exception, fixed Dashboard chart staleness, optimized vessel records enrichment, fixed violation/NC count discrepancies, split Code EF into E and F, renamed violation codes numeric→alphabetic, fixed RH Recording Form crew selection, sorted Rank/Name dropdown.
- **2026-02-26**: Changed 24h/7d rest calculations to work-anchored/rolling-window logic, re-derived all 8 violation codes from per-day metrics, fixed dayIndex collision bug.
- **2026-02-25**: Rebuilt S.On/Off column business logic in Rest Hours Records.
- **2026-02-24**: Added vessel-based access control for Ship users, RBAC Phase 2 enforcement across all 9 modules, RBAC Phase 1 sidebar navigation.
- **2026-02-20**: Migrated master data APIs to v2, added sign-on conflict validation, added Swagger/OpenAPI docs.
- **2026-02-18**: Dropped 27 legacy v1 tables, migrated shared hooks to v2 endpoints, major backend cleanup (~14,300 lines removed), removed all v1 module code.

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
The system employs a modern full-stack architecture. The frontend is built with **React 18**, utilizing **Vite**, **Tailwind CSS**, **shadcn/ui**, **AG Grid Enterprise**, **TanStack Query v5**, **React Hook Form**, **Zod**, and **Wouter**. The backend is implemented with **Express.js** and **TypeScript**. **PostgreSQL** serves as the primary database, managed using **Drizzle ORM**.

The backend adheres to a **Repository + Service + Controller pattern** for clear separation of concerns. V2 backend routes are organized by feature domain under `server/v2/`, while `server/routes.ts` handles shared API endpoints.

### Client Module Structure
All client modules reside under `client/src/modules/` with a flat structure:
- `admin/`: Company administration, forms, rank groups, vessel configuration.
- `crewing/`: Three-stage crew appraisal workflows.
- `crew-pool/`: Active seafarer management with UUID identifiers and soft deletes.
- `drugs-alcohol/`: Drug & alcohol test management.
- `promotions/`: Configurable promotion paths and checklists.
- `recruitment/`: Candidate application processes.
- `rest-hours/`: Work/rest hour compliance tracking.
- `rotation/`: Crew rotation planning with visual timelines.
- `vessel/`: Vessel data, Officer Matrix, Planning, Training Matrix.
- `accounts/`: User account management.

### UI/UX Decisions
- **Date Format:** DD-MMM-YYYY.
- **Design System:** Utilizes `shadcn/ui` for consistent and reusable components.
- **Standards:** Adheres to SAIL Form Standards for layout, alignment, error handling, and loading states.

### Technical Implementations
- **Module-first architecture** for clear feature separation.
- **Master Data System:** Centralized reference data management, with dedicated V2 APIs for various master tables (vessels, nationalities, ranks, etc.) at `/api/v2/masters/`.
- **Rank System:** Ranks stored in `adm_available_ranks_v2` with `name`, `label`, and `rankId`. `rankOptions` dropdowns use `label` as both key and value. `normalizeRank()` from `useRankNormalization` hook strips `_N` variant suffixes and resolves role variants to parent ranks. Compliance controller has its own `normalizeRankName()` for server-side rank matching.
- **Vessel Planning Variants:** Multiple same-rank positions on a vessel use `_N` suffixes (e.g., "3rd Officer_2"). Sea service records may store these suffixed ranks; they are normalized on display/save in crew pool forms.
- **Sea Service Sync:** E1 company sea service rows created from vessel sign-on are marked `isVesselSynced=true` (locked/read-only). After sign-off, rows become editable when the assignment has a `signOffDate`.
- **Crew Pool V2:** Full CRUD with UUID-based identifiers, soft deletes (`isDeleted`/`archivedAt`), batch save with direct API calls (no mid-save cache invalidation), auto-save B1 on click-outside.
- **Experience Calculation:** Dashboard service uses `OOW_RANKS` Set for exact-match OOW watchkeeping rank identification. Compliance controller uses keyword-based matching for broader officer classification.

### Key Files
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx` — Main crew form (~7900 lines)
- `client/src/modules/crew-pool/CrewPoolModule_v2.tsx` — Crew pool grid
- `client/src/modules/vessel/VesselModule_v2.tsx` — Vessel management
- `client/src/modules/vessel/components/OnBoardStatusEditDialog_v2.tsx` — Sign-on/off dialog
- `client/src/hooks/useRankNormalization.ts` — Rank normalization utilities
- `client/src/hooks/useCompanyRanks.ts` — Rank options for dropdowns
- `client/src/modules/crew-pool/mappers/v2ToLegacyMapper.ts` — V2↔Legacy data mapping
- `server/v2/crew-pool/services/crewMembersService.ts` — Crew CRUD + full profile
- `server/v2/crew-pool/services/dashboardService.ts` — Experience calculations
- `server/v2/vessel/services/vesselPlanningService.ts` — Sign-on/off logic
- `server/v2/vessel/controllers/complianceController.ts` — Compliance checks

### Known Issues / Technical Debt
- **OOW calculation bugs:** V1 `isOfficerRank()` in `storage.ts` uses keyword fallback matching; `crewAvailabilityService.ts` uses broken `rank.includes('OOW')` check. Correct OOW ranks: Chief Officer, 2nd/3rd Officer, 2nd/3rd/4th Engineer, Junior Officer only. Dashboard service (`dashboardService.ts:448`) has the correct implementation.
- **Visa Issuing Country:** Country not preserved through save/reload cycle — editability check uses `visa.countryId` but should use `(visa.countryId || visa.visaUuid)`, and `countryUuid` needs to be sent during save.
