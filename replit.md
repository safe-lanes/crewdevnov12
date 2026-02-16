# Seafarer Performance Management System

## Overview
A comprehensive maritime operations platform for managing seafarer performance, crew deployment, vessel operations, and regulatory compliance. Built with React, Express, TypeScript, PostgreSQL, and Drizzle ORM.

## Recent Changes
- Appraisals V2 Phase 3 Frontend completed (February 16, 2026): Created V2 frontend infrastructure: useAppraisalsVersion.ts hook (localStorage 'appraisals_module_version', custom event sync), AppraisalsVersionToggle.tsx component, appraisalsApiV2.ts client. Copied AppraisalForm_v2.tsx with endpoint swaps (/api/appraisals→/api/v2/appraisals, /api/available-ranks→/api/v2/admin/available-ranks, /api/forms→/api/v2/admin/forms, useMasterDataEntries→useAppraisalTypesV2). Copied ElementCrewAppraisals_v2.tsx with V2 hooks (useVesselsV2, useVesselTypesV2, useCompanyRanksV2). AppraisalsRouter.tsx for conditional V1/V2 rendering. App.tsx updated to use AppraisalsRouter. Version toggle added to both V1 and V2 UI headers. Appraisal module V2 migration complete (Phases 1-3).
- Appraisals V2 Phase 2 Backend completed (February 16, 2026): Created 11 V2 tables (migration 0093: appraisal_results_v2 + 10 child tables for trainings, targets, competence/behavioural assessments, training needs, recommendations, appraiser/seafarer comments, office reviews, training followups). Backend: 11 repositories (parent + 10 child with batch findByAppraisalUuids), responseAssembler for V1-compatible JSON reconstruction, appraisalResultsService with batch query optimization (11 queries via Promise.all), sequential stage enforcement (stage1→preliminary, stage2→submitted, stage3→reviewed), promotion recommendations count. Routes at /api/v2/appraisals/. All endpoints tested: create, get by id/crew, stage submissions, promotion recommendations, delete.
- V2 Promotions enriched crew display (February 14, 2026): Added `GET /api/v2/crew-pool/crew/enriched` endpoint with LEFT JOINs to `master_nationalities` (resolves nationality UUID → name) and `vessel_planning_v2`/`master_vessels` (resolves current vessel assignment → vessel name/UUID). Frontend PromotionsTable_v2 now shows nationality names (UAE, ALBANIA, etc.) instead of UUIDs, and vessel names (Vessel 1, Vessel 7) or "On Leave" instead of "-". De-duplicates crew by empNo when multiple vessel assignments exist.
- Promotions V2 crew pool API integration (February 14, 2026): Swapped all `/api/crew-members` references in V2 Promotions frontend to V2 crew pool endpoints. Added `GET /api/v2/crew-pool/crew/by-emp-no/:empNo` and `/by-emp-no/:empNo/dashboard` backend routes for empNo-based lookups (promotions stores V1-style empNo IDs). Updated field mappings: `crew.id`→`crew.empNo`, `middleInitial`→`middleName`, `dateOfBirth`→`dob`, `nationality`→`nationalityUuid`. V2 Promotions now fully isolated from V1 crew-members endpoint.
- Promotions V2 module migration (February 14, 2026): Created 9 normalized V2 tables (promo_criteria_master_v2, promotion_reviews_v2, promo_criteria_status_v2, promo_ces_tests_v2, promo_criteria_comments_v2, promo_training_comments_v2, promo_training_needs_v2, promo_approvals_v2, promo_checklist_progress_v2) via migration 0091. Backend: Repository + Service + Controller in server/v2/promotions/ with batch query optimization (8 queries total via findByReviewUuids + groupBy). V1-compatible API responses via assembleV1Response. Frontend: PromotionsModule_v2 with version toggle, AG Grid table, filters. Routes at /api/v2/promotions/. Auto-sync creates reviews for eligible crew based on promotion hierarchies.
- Completed full V2 endpoint migration for all V2 modules (February 14, 2026): Rest Hours V2 swapped /api/available-ranks, /api/vessel-revisions/ranks, /api/company-ranks to V2 admin endpoints. Vessel V2 swapped /api/available-ranks, /api/rank-groups/check-assignment to V2 admin endpoints; /api/external/ports to /api/v2/masters/ports with portUuid→puid mapping; created new /api/v2/vessel/oil-major-rules endpoint (oilMajorRulesController.ts) with exact V1 response shape. Drugs & Alcohol V2 updated cache invalidation to V2 queryKey. Only intentionally shared V1 endpoints remain: /api/crew-members (used by V1 modules only), /api/appraisals (shared data sources across V1/V2).
- Created dedicated V2 master tables for 4 highlighted masters (February 14, 2026): Migration 0090 creates `master_licenses_dce` (016), `master_manning_agents` (021), `master_crew_pools` (022), `master_appraisal_types` (023) — each with UUID PK, sort_order, timestamps, and master-specific fields. Data seeded from `master_data_entries`. Backend: Repository + Service + Controller at `/api/v2/masters/{licenses-dce, manning-agents, crew-pools, appraisal-types}`. Frontend: React Query hooks in `useMasterDataV2.ts`. V2 AdminModule masterData memo overrides for these 4 masters to read from new tables instead of shared `master_data_entries`.
- Migrated all V2 modules to local masters (February 13, 2026): All 6 V2 modules (Crew Pool, Recruitment, Drugs & Alcohol, Rest Hours, Vessel, Admin) now read master data from local `/api/v2/masters/` endpoints instead of external SAIL ERP API. Backend responses include alias fields (uuid, name, userName) matching external API shape for zero frontend field changes. Rotation V2 masters 021/022 (Manning Agents/Crew Pools) not part of V2 masters module, left using V1 pattern. V1 modules completely untouched.
- Created V2 Masters API module (February 13, 2026): Common REST endpoints at `/api/v2/masters/` for all 9 master tables (vessels, vessel-types, nationalities, countries, ports, languages, users, fleet-groups, additional-groups). Backend: Repository + Service + Controller in `server/v2/masters/`. Frontend: Shared React Query hooks in `client/src/hooks/v2/useMasterDataV2.ts`. All V2 modules can now use these instead of V1 `/api/masters/:id/data` pattern.
- Fixed V2 audit user tracking gaps and sortOrder auto-increment (February 12, 2026): Fixed companyTrainingGroupsService.updateByCode() to preserve auditUserUuid instead of discarding it. Fixed createFromMaster() to accept and pass auditUserUuid for created_by_uuid/updated_by_uuid columns. Added sortOrder auto-increment to trainingMasterService.create() (0 for first, max+1 for subsequent). Fixed training matrix submit/draft inline mutations in AdminModule.tsx to include auditUserUuid from localStorage. Fixed trainingMatrixVesselRevisionsService.submit() to pass auditUserUuid through to applyAuditUser.
- Fully migrated V2 Vessel Training Matrix data sources to V2 (February 12, 2026): Switched VesselModule_v2.tsx company trainings, company training groups, and company training requirements hooks from V1 endpoints to V2 (`/api/v2/admin/company-trainings`, `/api/v2/admin/company-training-groups`, `/api/v2/admin/company-training-requirements`). Training matrix revisions/drafts already used V2 endpoints. This ensures trainings created in V2 Admin (e.g., "Test security" SA011) are visible in V2 Vessel Training Matrix.
- Migrated V2 Vessel Training Matrix & Officer Matrix to V2 endpoints (February 12, 2026): Updated VesselModule_v2.tsx Training Matrix hooks to call `/api/v2/admin/training-matrix-vessel-revisions/by-vessel` and `/api/v2/admin/training-matrix-vessel-drafts/by-vessel` (reading from `adm_training_matrix_vessel_revisions_v2` and `adm_training_matrix_vessel_drafts_v2`). Officer Matrix confirmed already fully V2 via `/api/v2/vessel/officer-matrix`. No V1 files modified.
- Added V2 vessel revision ranks endpoint (February 12, 2026): Created `GET /api/v2/admin/vessel-revisions/ranks/:vesselId` that reads from `adm_vessel_revisions_v2` instead of V1 `vessel_revisions` table. Updated V2 VesselModule to call V2 endpoint, fully isolating V2 from V1 vessel revision data.
- Fixed V2 Training Matrix vessel_id UUID issue (February 12, 2026): V2 vesselOptions builder now uses `vesselUuid` from external vessel master data API instead of V1-style `VSL-XXX` format. Vessel group IDs are mapped from numeric to UUID via idToUuidMap. Non-UUID vessel IDs are filtered from group selections. Existing bad data (VSL-001, VSL-013) corrected to proper UUIDs in V2 tables.
- Fixed V2 rank group sync (February 11, 2026): Added syncFormRankGroup to V2 rankGroupsService so form's rank_group display field updates after create/update/archive/unarchive/delete of rank groups. Mirrors V1 behavior in database.ts.
- Memory reset on February 11, 2026
- Admin Module V2 full migration completed (February 11, 2026):
  - Phase 1: Created 5 V2 tables: adm_forms_v2, adm_form_versions_v2, adm_rank_groups_v2, adm_available_ranks_v2, adm_promotion_hierarchies_v2
  - Phase 2: Created 10 additional V2 tables (migration 0088): adm_training_master_v2, adm_company_training_groups_v2, adm_company_trainings_v2, adm_company_training_requirements_v2, adm_company_ranks_v2, adm_vessel_groups_v2, adm_vessel_drafts_v2, adm_vessel_revisions_v2, adm_training_matrix_vessel_drafts_v2, adm_training_matrix_vessel_revisions_v2
  - Backend: Repository + Service + Controller pattern in server/v2/admin/ for all 15 entities
  - Frontend: V2 API client (adminApiV2.ts) with 60+ methods, React Query hooks (useAdminV2.ts) with 40+ hooks
  - AdminModule.tsx fully migrated from V1 hooks to V2 hooks (all useExternal* → useMasterDataV2, all V1 mutation/query hooks → V2 equivalents)
  - Masters sub-module reads from existing master_* tables via /api/master-data/external/:type
  - V1/V2 toggle: AdminVersionToggle component, useAdminVersion hook, admin/index.tsx router
  - Routes registered at /api/v2/admin/
  - Tables created via direct SQL (not drizzle-kit push) due to schema conflicts

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

## Project Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, AG Grid Enterprise, TanStack Query v5, React Hook Form, Zod, Wouter
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL, Drizzle ORM
- **External**: SAIL ERP API, SAIL Audits API

### Directory Structure
- `client/src/` — Frontend source
  - `modules/` — Feature modules (accounts, admin, crewing, crew-pool, drugs-alcohol, promotions, recruitment, recruitment-v2, rest-hours, rotation, vessel)
  - `pages/` — Route pages (DashboardPage, ReportsComingSoon)
  - `components/` — Shared UI components (shadcn-based)
  - `hooks/`, `stores/`, `utils/`, `contexts/`, `types/` — Supporting code
- `server/` — Backend source
  - `routes.ts` — API route definitions
  - `routes/` — Route handler modules
  - `v2/` — V2 API implementations (Repository + Service + Controller pattern)
  - `storage.ts`, `storage-mem.ts` — Storage interfaces
  - `database.ts`, `db.ts` — Database configuration
  - `migrations/` — SQL migration files
- `shared/` — Shared types and schemas
  - `schema.ts` — Drizzle schema definitions
  - `v2/` — V2 shared schemas

### Key Modules
- **Crew Pool (V1 & V2)**: Active crew database with UUID identifiers and soft deletes
- **Vessel Management (V1 & V2)**: Vessel data, Officer Matrix, Planning, Training Matrix
- **Recruitment (V1 & V2)**: Candidate application management
- **Rotation (V1 & V2)**: Crew rotation planning with visual timelines
- **Rest Hours (V1 & V2)**: Work/rest hours compliance
- **Crew Appraisals**: 3-stage appraisal workflow
- **Training Matrix**: Certifications and requirements tracking
- **Drugs & Alcohol Testing**: Six test types with filtering
- **Oil Major Compliance**: Crew experience validation
- **Promotions**: Configurable promotion paths
- **Admin / Forms Configuration (V1 & V2)**: Company-specific form management with versioning, rank groups, available ranks, promotion hierarchies
- **Masters (V2)**: Common REST API at `/api/v2/masters/` for 13 master tables: 9 original (vessels, vessel-types, nationalities, countries, ports, languages, users, fleet-groups, additional-groups) + 4 highlighted (licenses-dce/016, manning-agents/021, crew-pools/022, appraisal-types/023). The 4 highlighted masters have dedicated normalized tables (`master_licenses_dce`, `master_manning_agents`, `master_crew_pools`, `master_appraisal_types`). Shared hooks in `client/src/hooks/v2/useMasterDataV2.ts`

### Architecture Patterns
- V2 modules use Repository + Service + Controller pattern
- V1/V2 toggle switches with localStorage persistence
- Module-first architecture with clear separation of concerns
- Master Data System for centralized reference data
- Vessel Revision System for rank assignments (draft/submission workflows)
- Crew Deployment: Two-stage workflow (Deploy from Rotation → Sign On)

### Running the Project
- Workflow "Start application" runs `npm run dev` (Express backend + Vite frontend on same port)
- Do not modify `server/vite.ts`, `vite.config.ts`, `package.json`, or `drizzle.config.ts`

### UI/UX Standards
- Date format: DD-MMM-YYYY
- Consistent layout, alignment, error handling, loading states
- SAIL Form Standards compliance
