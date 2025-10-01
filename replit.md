# Seafarer Performance Management System

## Overview
A comprehensive seafarer performance management system designed for maritime professionals. It features advanced form configuration, responsive design, and an intuitive user experience. The system currently uses `PersistentFileStorage` for development, with a PostgreSQL schema defined for future production deployment, and employs a module-first architecture for maintainability and scalability. The project aims to streamline seafarer management, including crew and appraisal functionalities, with a robust vessel revision system for managing rank assignments.

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

## System Architecture
The application is built with a modern web stack, adhering to a module-first architecture for clear separation of concerns and scalability.

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **UI Components**: shadcn/ui + Tailwind CSS
- **Data Tables**: AG Grid Enterprise
- **State Management**: TanStack Query v5
- **Form Management**: React Hook Form + Zod validation
- **Routing**: Wouter

### Module Structure
The codebase is organized into feature modules (`crewing`, `admin`) within the `client/src/modules/` directory, alongside shared components, utilities, hooks, and global types.

### UI/UX Decisions
- **Layout and Alignment**: Content, filter bars, and tables align consistently with screen titles.
- **SAIL Form Standards**: Standardized input field labels (`text-xs text-gray-500`), subsection headings (`text-base font-medium` with `#16569e`), and subsection containers (`mb-6 border border-[#EAEBEF] rounded-lg p-4`) ensure visual uniformity.
- **Error Handling**: Global error boundaries and consistent API error handling provide user-friendly feedback.
- **Loading States**: Consistent loading indicators are implemented for improved user experience.

### Technical Implementations
- **Vessel Revision System**: Manages vessel rank assignments with distinct "Save Draft" (temporary, no date) and "Submit" (finalized, mandatory date, auto-sequencing R0→R1→R2) workflows. It includes robust date validation and cleans up drafts upon submission.
- **Performance Optimization**: Utilizes Map-based O(1) lookups for vessel rank checkboxes to prevent browser freezing, and TanStack Query for data caching.
- **Data Storage**: Uses `PersistentFileStorage` (`test-data.json`) for development, with a defined PostgreSQL/Drizzle ORM schema for production readiness.

## External Dependencies
- **AG Grid Enterprise**: For advanced data table functionalities.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: For styling.
- **TanStack Query**: For server state management and caching.
- **React Hook Form**: For form management.
- **Zod**: For schema validation.
- **Wouter**: For client-side routing.
- **PostgreSQL**: Planned production database.
- **Drizzle ORM**: ORM for PostgreSQL.