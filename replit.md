# Seafarer Performance Management System

## Overview
The Seafarer Performance Management System is a comprehensive platform designed to optimize maritime operations by streamlining seafarer and vessel management. Its primary purpose is to enhance operational efficiency through optimized crew deployment, robust compliance mechanisms, and an intuitive user experience. Key capabilities include integrated crew and appraisal functionalities, a sophisticated vessel revision system for rank assignments, advanced form configurations, and a module-first scalable architecture. The system aims to provide a centralized solution for managing all aspects of seafarer performance and vessel-related data, supporting efficient decision-making and regulatory adherence in the maritime industry.

## User Preferences
### Code Style
- Use functional components with hooks
- Prefer TypeScript strict mode
- Use async/await over promise chains
- Implement consistent error handling
- Follow naming conventions: PascalCase for components, camelCase for functions

### Communication Style
- Be concise and professional
- Focus on technical accuracy
- Provide clear implementation details
- Document architectural decisions

### Database Migration Requirements
- **ALWAYS update migrations when adding new features**: Any schema change (new columns, new tables, field modifications) MUST have a corresponding migration file in the `migrations/` folder
- **Never assume existing data**: Migrations must check and create parent records before inserting child records (e.g., ensure `data_masters` entry exists before inserting into `master_data_entries`)
- **Audit schema vs migrations**: When working on database-related tasks, compare `shared/schema.ts` against existing migrations to identify any gaps
- **Migration naming**: Use sequential numbering format `NNNN_descriptive_name.sql` (e.g., `0013_add_uploaded_photo_column.sql`)
- **Idempotent migrations**: Use `IF NOT EXISTS` / `IF EXISTS` clauses to make migrations safe to re-run
- **Data backfill migrations**: When consolidating or renaming fields, create separate backfill migrations to ensure existing data is properly migrated (e.g., `0016_backfill_crew_sign_on_date.sql`)

## System Architecture
The application employs a modern web stack with a module-first architecture, prioritizing clear separation of concerns and scalability.

### UI/UX Decisions
- Consistent layout, alignment, error handling, and loading states.
- Adherence to SAIL Form Standards.
- Date Display Format: DD-MMM-YYYY.

### Technical Implementations
- **Module-First Architecture**: For clear separation of concerns.
- **Vessel ID/Name Translation**: Backend uses IDs, UI displays names.
- **Canonical Vessel Code Enforcement**: All storage backends enforce VSL-XXX format.
- **Master Data System**: Centralized reference data storage.
- **Vessel Revision System**: Manages vessel rank assignments with draft/submission workflows.
- **Rank Designation Synchronization**: Supports company and vessel-specific rank designations.
- **Vessel Database Module**: Displays vessel data, Officer Matrix, Planning, and Training Matrix. Includes calculation of "Time o/b (months)" from `crew_members.sign_on_date`.
- **Crew Handover Workflow**: Manages crew transitions with primary/secondary status.
- **Crew Archive System**: Manages historical crew records with sign-off workflow.
- **Rotation Module**: Manages crew rotation planning with "Due" and "Plan" sections and visual timelines.
- **Promotion Hierarchy System**: Configurable promotion paths integrated with a Promotions module. Promotion Review Forms dynamically load criteria based on the target rank.
- **Forms Configuration**: Integrates company-specific rank labels for rank group creation and appraisal form matching. Includes rank group uniqueness validation, appraisal form rank validation, and archive/unarchive workflow for rank groups. Utilizes a Form Versioning System with draft/released versions and independent version history per rank group. Rank group configuration allows admins to hide specific fields and sections via a JSON column.
- **Training Matrix Module**: Manages training certifications and requirements, including Training Master, Company Training configurations, and Company Training Groups (A-J). Supports a Training Requirement Matrix for per-rank requirements (Mandatory/Recommended).
- **Vessel Type Hierarchy System**: Centralized 3-level classification from Master Data 004.
- **Crew Appraisals Module**: Manages appraisals through a 3-stage workflow (Draft → Preliminary → Submitted → Reviewed).
- **Drugs & Alcohol Testing Module**: Tracks six test types with filtering, AG Grid tables, and Summary View.
- **Recruitment Module**: Manages candidate applications with AG Grid display and soft delete.
- **Recruitment V2 Module**: Complete restructure using Repository + Service + Controller pattern with complete isolation in v2 folder structure. Uses serial IDs with UUID soft foreign keys (rec_can_uuid as text) instead of database-level FK constraints. Original `recruitment_candidates` table preserved unchanged for legacy system.
  - **Database Schema**: 54 normalized tables across 4 phases:
    - Phase 1 (7 tables): Candidate Core + Profile (recruitment_candidates_v2, cand_personal_details, cand_addresses, cand_family_info, cand_children, cand_next_of_kin, cand_vessel_types_applied)
    - Phase 2 (14 tables): Documents & Attachments (cand_documents, cand_documents_attachments, cand_visas, cand_visas_attachments, cand_education, cand_education_attachments, cand_licenses, cand_licenses_attachments, cand_training_courses, cand_training_attachments, cand_sea_service, cand_sea_service_attachments, cand_additional_info, cand_additional_info_attachments)
    - Phase 3 (27 tables): Screening B1-B8 (B1: Initial Screening - 3 tables, B2: References - 4 tables, B3: Security - 4 tables, B4: Certificates - 4 tables, B5: Tests - 4 tables, B6: Interviews - 4 tables, B7: Training - 2 tables, B8: Shortlisting - 4 tables)
    - Phase 4 (6 tables): Approvals & Decisions (cand_approvals, cand_suitability, cand_suitability_vessel_types, cand_suitability_fleet_groups, cand_recruitment_decision, cand_assigned_groups)
  - **API Endpoints**: Follow `/api/v2/recruitment/` pattern with numeric ID or recCanUuid in URL paths
  - **Feature Flag System**: Version toggle (`useRecruitmentVersion` hook) allows switching between Legacy and V2 modules at runtime via localStorage (`recruitment_version` key). Toggle visible in top-right corner of Recruitment module.
  - **Frontend Structure** (client/src/modules/recruitment-v2/):
    - `RecruitmentModule_v2.tsx`: Main module with AG Grid list view, sidebar navigation, filters
    - `RecruitmentApplicationForm_v2.tsx`: Multi-step application form with stepper navigation
    - `RecruitmentSideBar_v2.tsx`: Sidebar with status-based navigation (In Progress, Recruited, Waitlist, Rejected)
    - `hooks/useRecruitmentV2.ts`: React Query hooks for all 54 tables (95+ endpoints)
    - `hooks/useRecruitmentVersion.ts`: Feature flag hook for version switching
    - `types/formTypes.ts`: TypeScript types for all V2 form data structures
    - `index.ts`: Module exports
  - **Phase 1 Status (Complete)**: Full UI implementation complete with all 10 sections matching legacy (A1.1-A5, B1-B8 placeholders). Core candidate data persistence working (candidate create/update, personal details, address, family info, next of kin, children, vessel types). Form properly loads existing data when editing candidates.
  - **Phase 2 Status (Pending)**: Section-level CRUD for documents, visas, education, licenses, training, sea service requires implementation with reconciliation logic for add/update/delete operations.
- **Crew Pool Module**: Manages active crew database with comprehensive crew information forms. Includes PDF export functionality for Crew Info Form (Parts A-F) using pdf-lib with A4 format. PDF header displays crew photo in top-right corner with name and rank on the left.
- **Rest Hours Module**: Manages seafarer work and rest hours compliance with Dashboard, Record, and Plan sections. Includes a "Majority-Day Violation Assignment" logic for violation display. PDF export generates landscape A4 "Rest_Hour_Record_Extract.pdf" with redesigned header (Name Of Ship, IMO Number, Flag, Seafarer FullName in Rank-FileNo-NAME format, Position/Rank, Month-Year, Watchkeeper checkboxes), 48 half-hour work/rest grid, and mandatory second page with MLC 2006/STCW footnotes, national laws section, and signature lines for Master and Seafarer.
- **Oil Major Compliance Engine**: Validates crew officer experience against various oil major requirements across 7 categories, supporting rank pair logic and CSV import of rules.
- **Rank Ordering System**: All crew-displaying modules use a centralized `useRankOrdering` hook to sort crew by rank based on vessel revision ranks from the backend, ensuring consistent ordering across the system.
- **Performance Optimization**: Achieved through route-level code splitting using `React.lazy()`, memoization of components and calculations (`React.memo`, `useMemo`), and dual schema validation (lenient for drafts, strict for submissions) in complex forms like AppraisalForm.
- **Data Storage**: `PersistentFileStorage` for development, PostgreSQL/Drizzle ORM for production.
- **Crew Member Update Protection**: Protects vessel assignment fields from accidental clearing.
- **Crew Dashboard Timeline Card**: Canvas-based visualization of 6-month vessel assignments.
- **Sign On Date Consolidation**: Unified `sign_on_date` terminology and implementation across the codebase.
- **Position Display Normalization**: API-level `displayRole` field provides correct display names for vessel positions. Single-slot ranks show base label (e.g., "Fitter"), multi-slot ranks show suffixed positions (e.g., "Fitter_1", "Fitter_2"). Applied consistently across Vessel Crew List, Planning, Officer Matrix, Training Matrix, and Rotation modules.

## External Dependencies
- React 18
- TypeScript
- Vite
- Express.js
- AG Grid Enterprise
- shadcn/ui
- Tailwind CSS
- TanStack Query v5
- React Hook Form
- Zod
- Wouter
- PostgreSQL
- Drizzle ORM
- SAIL ERP API (for Master Data 001, 004, 014, 015, 017, 018, 019, 020)
- SAIL Audits API (for Users Master 024)