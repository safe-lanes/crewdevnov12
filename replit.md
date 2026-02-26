# SAIL Crewing

## Overview
SAIL Crewing is a comprehensive maritime operations platform designed to streamline and manage seafarer performance, crew deployment, vessel operations, and regulatory compliance. Its primary purpose is to enhance operational efficiency, ensure adherence to maritime regulations, and optimize crew management through advanced analytics and robust data handling. Key capabilities include detailed seafarer appraisal workflows, dynamic crew rotation and recruitment, real-time vessel management, and automated compliance checks for rest hours, training, and drug & alcohol policies. The platform provides a unified view for maritime stakeholders, enabling informed decision-making, improved crew welfare, and safe, efficient vessel operations. The project aims to become the leading solution for global maritime crew and vessel management.

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
- **Module-first architecture** promotes clear feature separation and maintainability.
- **Master Data System:** Centralized reference data management with dedicated V2 APIs (`/api/v2/masters/`).
- **Vessel Revision System:** Supports draft and submission workflows for vessel configurations.
- **Crew Deployment:** Implements a two-stage workflow (Deploy from Rotation → Sign On).
- **Role-Based Access Control (RBAC):** Gated access to modules and CRUD operations based on user permissions.
- **Rest Hours Compliance:** Advanced calculations for work/rest hour violations using work-anchored and rolling-window logic.
- **Multi-Tenant Database Architecture:** Production uses per-tenant database isolation via `MASTER_DATABASE_URL`. The `TenantConnectionManager` singleton (`server/utils/tenantConnectionManager.ts`) manages tenant resolution from a master `tenants` table, per-tenant connection pools (max 5 connections each, idle eviction after 10 min), and `AsyncLocalStorage`-based request-scoped tenant context. `getDb()` in `server/v2/db.ts` transparently returns the correct tenant DB — zero changes needed in service/repository code. Frontend auto-injects `x-tenant-id` header via global fetch interceptor (`client/src/lib/tenantFetch.ts`) and explicit headers in `queryClient.ts`. Tenant init flow: `POST /api/v2/tenant/init { domain }` → returns `tuid`. When `MASTER_DATABASE_URL` is not set (Replit dev), everything runs in single-tenant mode with no behavioral changes.

### Feature Specifications
- **Crew Pool:** Manages seafarer data with UUIDs and soft deletes.
- **Vessel Management:** Comprehensive oversight of vessel data, officer matrices, and training matrices.
- **Recruitment:** Manages the entire candidate application lifecycle.
- **Rotation:** Provides tools for crew rotation planning and visual timelines.
- **Rest Hours:** Tracks and ensures compliance with maritime work and rest hour regulations.
- **Crew Appraisals:** Manages a 3-stage workflow for seafarer performance evaluation.
- **Training Matrix:** Tracks certifications and training requirements.
- **Drugs & Alcohol Testing:** Manages various types of tests.
- **Oil Major Compliance:** Validates crew experience against industry standards.
- **Promotions:** Configurable career progression paths for seafarers.
- **Admin / Forms Configuration:** Manages company-specific forms, versioning, rank groups, and promotion hierarchies.
- **V2 Masters Module:** Provides common REST endpoints for 13 master tables, including normalized tables for licenses, manning agents, crew pools, and appraisal types.

## External Dependencies
- **SAIL ERP API:** Used for enterprise resource planning data integration.
- **SAIL Audits API:** Integrated for auditing and compliance tracking.