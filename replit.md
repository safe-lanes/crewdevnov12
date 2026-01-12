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
- **Crew Pool Module**: Manages active crew database with comprehensive crew information forms. Includes PDF export functionality for Crew Info Form (Parts A-F) using pdf-lib with A4 format.
- **Rest Hours Module**: Manages seafarer work and rest hours compliance with Dashboard, Record, and Plan sections. Includes a "Majority-Day Violation Assignment" logic for violation display.
- **Oil Major Compliance Engine**: Validates crew officer experience against various oil major requirements across 7 categories, supporting rank pair logic and CSV import of rules.
- **Rank Ordering System**: All crew-displaying modules use a centralized `useRankOrdering` hook to sort crew by rank based on vessel revision ranks from the backend, ensuring consistent ordering across the system.
- **Performance Optimization**: Achieved through route-level code splitting using `React.lazy()`, memoization of components and calculations (`React.memo`, `useMemo`), and dual schema validation (lenient for drafts, strict for submissions) in complex forms like AppraisalForm.
- **Data Storage**: `PersistentFileStorage` for development, PostgreSQL/Drizzle ORM for production.
- **Crew Member Update Protection**: Protects vessel assignment fields from accidental clearing.
- **Crew Dashboard Timeline Card**: Canvas-based visualization of 6-month vessel assignments.
- **Sign On Date Consolidation**: Unified `sign_on_date` terminology and implementation across the codebase.

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