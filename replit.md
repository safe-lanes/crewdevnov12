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
    - **Crew Handover Workflow**: Manages crew transitions with primary/secondary status.
    - **Crew Archive System**: Manages historical crew records with sign-off workflow.
- **Rotation Module**: Manages crew rotation planning with "Due" and "Plan" sections and visual timelines.
- **Promotion Hierarchy System**: Configurable promotion paths, integrated with a Promotions module.
- **Forms Configuration - Company Rank Integration**: Uses company-specific rank labels for rank group creation and form matching.
- **Vessel Type Hierarchy System**: Centralized 3-level vessel type classification from Master Data 004, enabling efficient querying and analytics.
- **Crew Appraisals Module**: Comprehensive appraisal management with a 3-stage workflow (Draft → Preliminary → Submitted → Reviewed) and AG Grid display.
- **Drugs & Alcohol Testing Module**: Tracks six test types with filtering, AG Grid tables, and a Summary View.
- **Recruitment Module**: Manages candidate applications with AG Grid display and soft delete functionality.
- **Rest Hours Module**: Manages seafarer work and rest hours compliance.
    - **Dashboard (Office)**: Fleet-wide overview with AG Charts, performance cards, and drill-down.
    - **Record**: Interactive RH Recording Form with real-time violation detection.
    - **Plan**: Work planning with full CRUD for variable tasks and automated synchronization.
- **Rank Ordering System**: All crew-displaying modules use rank-based sorting.
- **Performance Optimization**: Utilizes map-based lookups, TanStack Query, `useRef`, `useMemo`, and optimized `PersistentFileStorage`.
- **Data Storage**: `PersistentFileStorage` for development, PostgreSQL/Drizzle ORM for production.
- **Crew Member Update Protection**: Vessel assignment fields are protected from accidental clearing during updates.
- **Crew Dashboard Timeline Card**: Canvas-based visualization of 6-month vessel assignments with color coding and appraisal/handover badges.

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