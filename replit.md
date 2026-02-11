# Seafarer Performance Management System

## Overview
A comprehensive maritime operations platform for managing seafarer performance, crew deployment, vessel operations, and regulatory compliance. Built with React, Express, TypeScript, PostgreSQL, and Drizzle ORM.

## Recent Changes
- Memory reset on February 11, 2026
- Admin Module V2 migration completed (February 11, 2026):
  - Created 5 V2 tables: adm_forms_v2, adm_form_versions_v2, adm_rank_groups_v2, adm_available_ranks_v2, adm_promotion_hierarchies_v2
  - Backend: Repository + Service + Controller pattern in server/v2/admin/
  - Frontend: V2 API client (adminApiV2.ts), React Query hooks (useAdminV2.ts), AdminModule_v2.tsx
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
