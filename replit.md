# Element Crew Appraisals System

## Overview
This is a full-stack web application designed for managing crew appraisals in the maritime industry. Its primary purpose is to track and manage crew member performance evaluations across various vessels. The system aims to provide a comprehensive solution for appraisal data population, filtering, and administration, supporting detailed performance assessment, training needs identification, and overall crew management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a modern full-stack architecture, separating frontend and backend concerns.
- **Frontend**: Built with React 18 and TypeScript, using Vite for development and shadcn/ui with Tailwind CSS for UI components and styling. It leverages TanStack Query for server state management and Wouter for client-side routing.
- **Backend**: An Express.js server developed with TypeScript, integrated with a PostgreSQL database via Drizzle ORM for type-safe operations.
- **UI/UX Decisions**: Consistent design is maintained through shadcn/ui and Tailwind CSS with CSS variables for theming. Forms utilize React Hook Form with Zod validation.
- **Feature Specifications**:
    - **Crew Appraisals**: Data is populated from submitted forms, with auto-populated fields for Crew ID and Vessel Type. Features robust filtering by name, rank, vessel type, nationality, appraisal type, and rating range.
    - **Admin Module**: Accessible via `/admin`, this module allows configuration of various forms. It includes a Form Editor for customizing appraisal forms (Parts A-G) with version control, configurable rank groups, and dynamic field/section hiding. It also supports configurable dropdowns for fields like "Appraisal Type" and "Effectiveness" ratings.
    - **Standard Form Popup**: A reusable `FormPopup` component ensures consistent spacing and styling for all modal popups across the application.
- **System Design Choices**: The architecture supports modern deployment practices with separate build processes for frontend and backend, environment-specific configurations, and static asset serving. It's designed for scalability and maintainability.

## External Dependencies

### Frontend Dependencies
- `@radix-ui/*`: Accessible UI primitive components.
- `@tanstack/react-query`: Server state management.
- `wouter`: Lightweight routing solution.
- `tailwindcss`: Utility-first CSS framework.
- `lucide-react`: Icon library.

### Backend Dependencies
- `express`: Web application framework.
- `drizzle-orm`: Type-safe ORM.
- `@neondatabase/serverless`: Neon PostgreSQL driver.
- `connect-pg-simple`: PostgreSQL session store.

### Development Dependencies
- `vite`: Fast build tool and dev server.
- `typescript`: Type checking and compilation.
- `drizzle-kit`: Database migration tool.

### Database
- **Type**: PostgreSQL (with a note indicating past migration to MySQL for specific compatibility).
- **ORM**: Drizzle ORM.
- **Tables**: `users`, `forms`, `available_ranks`, `rank_groups`, `crew_members`, `appraisal_results`.
- **Functionality**: Full CRUD operations are available for all key entities, with automatic database seeding and persistent data storage.