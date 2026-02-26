# SAIL Crewing

## Overview
SAIL Crewing is a comprehensive maritime operations platform designed to streamline and manage all aspects of seafarer performance, crew deployment, vessel operations, and regulatory compliance. Its primary goal is to enhance operational efficiency, ensure compliance with maritime regulations, and optimize crew management through advanced analytics and robust data handling. Key capabilities include detailed seafarer appraisal workflows, dynamic crew rotation and recruitment, real-time vessel management, and automated compliance checks for rest hours, training, and drug & alcohol policies. The platform provides a unified view for maritime stakeholders to make informed decisions, improve crew welfare, and ensure safe and efficient vessel operations.

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
The system employs a modern full-stack architecture. The frontend is built with **React 18** (Vite, Tailwind CSS, shadcn/ui, AG Grid Enterprise, TanStack Query v5, React Hook Form, Zod, Wouter), while the backend uses **Express.js** with **TypeScript**. **PostgreSQL** is the primary database, managed with **Drizzle ORM**.

The backend adheres to a **Repository + Service + Controller pattern** for clear separation of concerns. V2 backend routes are organized by feature domain under `server/v2/`.

### Client Module Structure
Client modules reside under `client/src/modules/` and include:
- `admin/`: Company administration, forms, rank groups, vessel configuration.
- `crewing/`: Three-stage crew appraisal workflows.
- `crew-pool/`: Active seafarer management with UUIDs and soft deletes.
- `drugs-alcohol/`: Management of drug & alcohol tests.
- `promotions/`: Configurable promotion paths and checklists.
- `recruitment/`: Candidate application processes.
- `rest-hours/`: Work/rest hour compliance tracking.
- `rotation/`: Crew rotation planning with visual timelines.
- `vessel/`: Vessel data, Officer Matrix, Planning, Training Matrix.
- `accounts/`: User account management.

### UI/UX Decisions
- **Date Format:** DD-MMM-YYYY.
- **Design System:** Utilizes shadcn/ui for consistent component design.
- **Standards:** Adheres to SAIL Form Standards for layout, alignment, error handling, and loading states.

### Technical Implementations
- **Module-first architecture** for clear feature separation.
- **Master Data System:** Centralized reference data managed via dedicated V2 APIs at `/api/v2/masters/`.
- **Vessel Revision System:** Supports draft and submission workflows for vessel-specific configurations.
- **Crew Deployment:** Implements a two-stage workflow (Deploy from Rotation → Sign On).
- **Role-Based Access Control (RBAC):** Implemented for module access and CRUD operations across all modules, integrating with ERP user profiles.
- **Rest Hours Calculation:** Uses work-anchored and rolling window logic for precise violation detection in line with maritime regulations.

### Feature Specifications
- **Crew Pool:** Manages active seafarer data with UUID identifiers and soft deletes.
- **Vessel Management:** Oversees vessel data, Officer Matrix, Planning, and Training Matrix.
- **Recruitment:** Handles candidate application processes.
- **Rotation:** Facilitates crew rotation planning with visual timelines.
- **Rest Hours:** Ensures compliance with work and rest hour regulations.
- **Crew Appraisals:** Features a 3-stage appraisal workflow for performance evaluation.
- **Training Matrix:** Tracks certifications and training requirements for seafarers.
- **Drugs & Alcohol Testing:** Manages various test types and filtering.
- **Oil Major Compliance:** Validates crew experience against compliance standards.
- **Promotions:** Configurable promotion paths for career progression.
- **Admin / Forms Configuration:** Manages company-specific forms, including versioning and hierarchies.
- **V2 Masters Module:** Provides common REST endpoints at `/api/v2/masters/` for 13 master tables.

## External Dependencies
- **SAIL ERP API:** For enterprise resource planning data integration.
- **SAIL Audits API:** For auditing and compliance tracking.