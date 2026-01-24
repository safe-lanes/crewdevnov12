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
- **Module-First Architecture**: Emphasizes clear separation of concerns.
- **Vessel ID/Name Translation**: Backend uses IDs, UI displays names.
- **Canonical Vessel Code Enforcement**: All storage backends enforce VSL-XXX format.
- **Master Data System**: Centralized reference data storage.
- **Vessel Revision System**: Manages vessel rank assignments with draft/submission workflows.
- **Crew Modules**:
    - **Vessel Database Module**: Displays vessel data, Officer Matrix, Planning, and Training Matrix, including "Time o/b (months)" calculation.
    - **Crew Handover Workflow**: Manages crew transitions with primary/secondary status.
    - **Crew Archive System**: Manages historical crew records with sign-off workflow.
    - **Rotation Module**: Manages crew rotation planning with visual timelines.
    - **Crew Appraisals Module**: Manages appraisals through a 3-stage workflow.
    - **Crew Pool Module (V1 & V2)**: Manages active crew database. V2 features a re-architected system with a Repository + Service + Controller pattern, UUID identifiers, soft deletes, and comprehensive forms. Includes a "Save-Before-Attachment" pattern (uses direct API calls via `crewPoolApiV2` to preserve unsaved rows - mutations cause query invalidation which overwrites local form state) and generates sequential 'A000001' format Crew IDs.
    - **Crew Dashboard Timeline Card**: Canvas-based visualization of 6-month vessel assignments.
- **Forms & Configuration**:
    - **Forms Configuration**: Integrates company-specific rank labels for rank group creation and appraisal form matching. Features a Form Versioning System and allows admin configuration of hidden fields/sections via JSON.
    - **Promotion Hierarchy System**: Configurable promotion paths integrated with a Promotions module, with dynamic criteria loading for review forms.
- **Compliance & Training**:
    - **Drugs & Alcohol Testing Module**: Tracks six test types with filtering and summary views.
    - **Training Matrix Module**: Manages certifications and requirements, including Company Training configurations and a per-rank Training Requirement Matrix.
    - **Oil Major Compliance Engine**: Validates crew officer experience against various oil major requirements.
    - **Rest Hours Module**: Manages seafarer work and rest hours compliance with Dashboard, Record, and Plan sections, including "Majority-Day Violation Assignment" logic and PDF export.
- **Recruitment Module (V1 & V2)**: Manages candidate applications. V2 is a complete restructure using Repository + Service + Controller pattern, serial IDs with UUID soft foreign keys, and 54 normalized tables across 4 phases (Candidate Core, Documents, Screening, Approvals). Features API endpoints following `/api/v2/recruitment/` and a feature flag system for version toggling.
- **Core Utilities**:
    - **Rank Designation Synchronization**: Supports company and vessel-specific rank designations.
    - **Vessel Type Hierarchy System**: Centralized 3-level classification from Master Data 004.
    - **Rank Ordering System**: Centralized `useRankOrdering` hook for consistent crew sorting.
    - **Database Connection Resilience**: Production-critical connection pool management with retry logic, exponential backoff, and request queuing.
    - **Master Data UUID Resolution**: Utility for resolving master data values to UUIDs, storing UUIDs, and using JOINs for read operations.
- **Performance Optimization**: Achieved through route-level code splitting, memoization, and dual schema validation.
- **Data Storage**: `PersistentFileStorage` for development, PostgreSQL/Drizzle ORM for production.
- **Position Display Normalization**: API-level `displayRole` field provides correct display names for vessel positions.

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