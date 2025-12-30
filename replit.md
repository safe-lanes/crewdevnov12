# Seafarer Performance Management System

## Overview
A comprehensive system designed to streamline seafarer and vessel management, optimizing crew deployment and compliance through a scalable, module-first architecture. It integrates crew and appraisal functionalities, a robust vessel revision system for rank assignments, advanced form configuration, and an intuitive user experience to enhance maritime operational efficiency.

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
The application uses a modern web stack with a module-first architecture.

### UI/UX Decisions
- Consistent layout, alignment, error handling, and loading states.
- Adherence to SAIL Form Standards.
- Date Display Format: DD-MMM-YYYY.

### System Design Choices
- **Module-First Architecture**: Ensures clear separation of concerns and scalability.
- **Vessel ID/Name Translation**: Backend uses vessel IDs, UI displays vessel names.
- **Canonical Vessel Code Enforcement**: All storage backends strictly enforce VSL-XXX format vessel codes.
- **Master Data System**: Centralized storage for reference data.
- **Vessel Revision System**: Manages vessel rank assignments with draft/submission workflows.
- **Rank Designation Synchronization**: Supports company and vessel-specific rank designations.
- **Vessel Database Module**: Displays vessel data, Officer Matrix, Planning, and Training Matrix.
    - **Officer Matrix Vessel Type Integration**: Displays vessel-type-specific experience in "Tanker Type" column by linking vessels (Master 014) to vessel types (Master 004) and calculating officer experience on current vessel type from sea service history.
    - **Time on Board Calculation**: Calculated from crew_members.sign_on_date (months from sign-on to today), displayed in Officer Matrix "Time o/b (months)" column. Backfill migration ensures all deployed crew have sign_on_date populated.
    - **Crew Handover Workflow**: Manages crew transitions with primary/secondary status.
    - **Crew Archive System**: Manages historical crew records with sign-off workflow.
- **Rotation Module**: Manages crew rotation planning with "Due" and "Plan" sections and visual timelines.
- **Promotion Hierarchy System**: Configurable promotion paths, integrated with a Promotions module.
    - **Promotion Review Form Rank Lookup**: Runtime form dynamically loads A2 Minimum Promotion Criteria configuration based on the "Next Promotion Rank" (target rank), not the current rank. Uses normalizeRank() to convert rank variants (e.g., "3rd Officer_1") to parent ranks for matching. Shows alert when no rank group is configured for the target rank.
- **Forms Configuration - Company Rank Integration**: Uses company-specific rank labels for rank group creation and form matching.
    - **Rank Group Uniqueness Validation**: Each rank can only belong to one active (non-archived) rank group per form. UI disables already-assigned ranks with "(assigned to 'GroupName')" message. Server-side validation prevents bypassing the constraint.
    - **Appraisal Form Rank Validation**: Vessel Module validates rank group assignment before opening appraisal form. Shows alert "No Appraisal Rank Group assigned from Admin Module" if crew member's rank has no assigned rank group.
    - **Archive/Unarchive Workflow**: Rank groups can be archived (soft delete) to preserve historical data. Unarchiving restores the group but may conflict with ranks reassigned during archive period.
    - **Appraisal Type Master (023)**: Centralized reference data for appraisal types (End of Contract, Mid Term, Special, Probation). AppraisalForm.tsx dynamically fetches types from this master instead of hardcoded options.
    - **Form Versioning System**: Forms support draft/released versioning with version numbers and dates. Uses form_versions table to track version history per form. UI displays artificial IDs (form.id * 1000) but API calls use real database IDs via originalFormId property.
    - **Rank Group Version Isolation**: Each rank group has independent version history via rankGroupId column in form_versions table. New versions MUST specify a rank group (enforced by POST validation). Query includes both rank-group-specific versions AND legacy NULL versions for backward compatibility. Save Draft button is disabled until a rank group is selected.
    - **Rank Group Configuration System**: Per-rank-group configuration for appraisal forms stored in rank_groups.configuration JSON column. Admins can hide specific fields (e.g., personalityIndexCategory) and sections (partB, partB1, partB2, partD) via FormEditor.tsx Configuration Mode. AppraisalForm.tsx loads configuration via GET /api/forms/for-rank/:rankLabel and applies visibility guards using isFieldVisible() and isSectionVisible() helpers. Section navigation dynamically filters hidden sections and synchronizes active section state.
- **Training Matrix Module**: Manages training certifications and requirements.
    - **Training Master**: Central repository of all training types with categories (S for Statutory, N for Non-Statutory).
    - **Company Training**: Company-specific training configurations synced from Training Master when "Applicable to Company" is checked.
    - **Company Training Groups**: Trainings can be organized into groups A-J with customizable labels (e.g., "A. Flag"). Sorted by group first (A-J), unassigned trainings appear last, then alphabetically within each group.
    - **Training Requirement Matrix**: Per-rank training requirements using M (Mandatory) or R (Recommended) status. Stored in company_training_requirements join table with (companyTrainingId, rankId, status) columns. UI displays rank columns with M/R checkboxes in edit mode. Mutually exclusive selection (clicking M clears R and vice versa). Batch save updates all changed requirements via POST /api/company-training-requirements/batch.
- **Vessel Type Hierarchy System**: Centralized 3-level vessel type classification from Master Data 004, enabling efficient querying and analytics.
- **Crew Appraisals Module**: Comprehensive appraisal management with a 3-stage workflow (Draft → Preliminary → Submitted → Reviewed) and AG Grid display.
- **Drugs & Alcohol Testing Module**: Tracks six test types with filtering, AG Grid tables, and a Summary View.
- **Recruitment Module**: Manages candidate applications with AG Grid display and soft delete functionality. Uses external API for master data.
- **Crew Pool Module**: Manages active crew database with comprehensive crew information forms. Uses external API for master data.
- **Manning Agents Data Master (021)**: Configurable list of manning agents with fields: ID, Name, Country, Email. Used by:
    - Crew Recruitment Form: Dropdown selection for manning agent
    - Crew Information Form: Dropdown selection for manning agent
    - Admin > Masters: Full CRUD management with 5-column grid layout
- **External API Integration (SAIL ERP)**: Modules fetch master data from external SAIL ERP API (https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/) for:
    - Master 001: Nationalities
    - Master 004: Vessel Types
    - Master 014: Vessels
    - Master 015: Fleet Groups
    - Master 017: Additional Groups
    - Master 018: Ports
    - Master 019: Languages
    - Master 020: Countries
    - All hooks use 5-minute cache and 2 retry attempts with fallback to static data
- **Users Master (024)**: External data source from SAIL Audits API. Displays 7 columns: UUID, User Name, Role, Designation, User Type, Department, Email. Uses useExternalUsers.tsx hook with placeholder endpoint (to be updated with actual SAIL Audits endpoint). Read-only display following the same pattern as other external masters.
- **Rest Hours Module**: Manages seafarer work and rest hours compliance.
    - **Dashboard (Office)**: Fleet-wide overview with AG Charts, performance cards, and drill-down.
    - **Record**: Interactive RH Recording Form with real-time violation detection.
    - **Plan**: Work planning with full CRUD for variable tasks and automated synchronization.
- **Oil Major Compliance Engine**: Validates crew officer experience against oil major requirements (BP, Chevron, Shell, etc.)
    - **7 Compliance Categories**: Years with operator, years in rank, years on tanker types, years on all tankers, years as OOW, date joined gaps, and language proficiency.
    - **Rank Pair Logic**: Supports combined rank pairs (Master + Chief Officer) and individual rank rules.
    - **CSV Import**: Import compliance rules from CSV files for 70+ oil majors.
    - **Real-time Validation**: Color-coded compliance status (green/yellow/red) per oil major.
    - **ComplianceMatrixDialog**: Interactive UI showing all oil majors and their rule-by-rule validation results.
- **Rank Ordering System**: All crew-displaying modules use rank-based sorting.
- **Performance Optimization**: Utilizes map-based lookups, TanStack Query, `useRef`, `useMemo`, and optimized `PersistentFileStorage`.
    - **Route-Level Code Splitting (Dec 2024)**: All 13 route modules in App.tsx use React.lazy() for dynamic imports, reducing initial bundle size. Suspense boundaries with PageLoader fallback provide smooth loading UX. Large modules like AdminModule (~118K tokens) and AppraisalForm (~71K tokens) are now lazy-loaded on demand.
    - **FormEditor Component Refactor (Dec 2024)**: Extracted 7 section components (PartA-PartG) into client/src/components/form-editor-parts/ wrapped with React.memo. FormEditor.tsx reduced from ~3800 to ~2550 lines. Parent-level useWatch hooks provide stable array references for trainings, targets, assessments, etc. Score calculations (competenceSectionScore, behaviouralSectionScore, overallScore) are memoized with useMemo. This pattern serves as a template for future complex forms.
    - **AppraisalForm Dual Schema Validation (Dec 2024)**: Uses lenient Zod schemas (allowing empty strings) for draft saves, strict schemas (requiring Yes/No/NA enum) for stage submissions. Stage 2 validation enforces recommendation answers via stage2Schema.parse() before mutation execution.
    - **AppraisalForm Part Components (Dec 2024)**: Extracted 7 section components (PartA-PartG) into client/src/components/appraisal-form-parts/ wrapped with React.memo. Each component receives form, partRef, state handlers, and visibility functions as props. All Parts A-G are now fully integrated into AppraisalForm.tsx, reducing file from ~4,780 to 3,463 lines (~1,317 line reduction, 27.5% reduction). Action buttons (Save Draft, Submit Stage 1/2/3) remain in parent for form-level workflow control. The Office Review section remains inline due to Stage 2/3 submission workflow differences. types.ts provides comprehensive interfaces for all props including AppraisalFormData, section-specific props, and shared utilities like getScoreColors and NATIONALITIES.
- **Data Storage**: `PersistentFileStorage` for development, PostgreSQL/Drizzle ORM for production.
- **Crew Member Update Protection**: Vessel assignment fields are protected from accidental clearing during updates.
- **Crew Dashboard Timeline Card**: Canvas-based visualization of 6-month vessel assignments with color coding and appraisal/handover badges.
- **Sign On Date Consolidation**: Unified joiningDate → signOnDate terminology across codebase (Dec 2024):
    - crew_members: Uses sign_on_date (single source of truth)
    - vessel_planning: Uses sign_on_date for primary crew, reliever_sign_on_date for planned relievers
    - UI terminology: Changed from "Joined/Joining" to "Signed On/Sign On" throughout
    - Dual-write strategy during transition: Frontend sends both new (signOnDate, relieverSignOnDate) and legacy (joiningDate) field names to backend

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