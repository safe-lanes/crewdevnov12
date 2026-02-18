# Seafarer Performance Management System

## Overview
A comprehensive maritime operations platform designed to streamline and manage all aspects of seafarer performance, crew deployment, vessel operations, and regulatory compliance. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and optimize crew management through advanced analytics and robust data handling. Its core capabilities include detailed seafarer appraisal workflows, dynamic crew rotation and recruitment, real-time vessel management, and automated compliance checks for rest hours, training, and drug & alcohol policies. The platform provides a unified view for maritime stakeholders to make informed decisions, improve crew welfare, and ensure safe and efficient vessel operations.

## Recent Changes
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

## External Dependencies
- **SAIL ERP API:** For enterprise resource planning data integration.
- **SAIL Audits API:** For auditing and compliance tracking.
