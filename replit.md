# Seafarer Performance Management System

## Overview
A comprehensive seafarer performance management system designed for maritime professionals. This system provides advanced form configuration, responsive design, and an intuitive user experience to manage seafarer performance. It includes features for crew management, performance ratings, and a robust vessel revision system for managing rank assignments. The project aims to deliver a scalable and maintainable solution, with a clear path from development (using file-based storage) to a production-ready PostgreSQL environment.

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

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite, shadcn/ui + Tailwind CSS, AG Grid Enterprise for data tables, TanStack Query v5 for state management, React Hook Form + Zod for forms, Wouter for routing.
- **Backend**: Express.js + TypeScript.
- **Storage**: PersistentFileStorage (for development); PostgreSQL/Drizzle ORM schema defined for production.

### Module Structure
The application employs a module-first architecture, organizing code into feature modules (e.g., `crewing`, `admin`), shared components, utilities, hooks, and global types.

### UI/UX Decisions
- **Content Alignment**: Filter bars and tables align with screen titles (no left padding on container elements).
- **Filter Sections**: Use `p-4 pl-0` for filter containers.
- **Table Containers**: Use `p-4 pl-0` for `CardContent` wrapping AG Grid tables.
- **SAIL Form Standards**:
    - Input field labels: `text-xs text-gray-500 tracking-wide`.
    - Subsection headings: `text-base font-medium` with color `#16569e`.
    - Subsection containers: `mb-6 border border-[#EAEBEF] rounded-lg p-4`.

### Key Features
- **Crew Management**: Full CRUD operations.
- **Performance Ratings**: Visual badges with color coding.
- **Advanced Filtering**: Multi-criteria search.
- **Form Validation**: Zod-based with user-friendly messages.
- **Error Handling**: Global error boundary, consistent API error handling.
- **Loading States**: Consistent indicators.
- **Responsive Design**: Mobile-first approach.
- **Vessel Revision System**: Manages vessel rank assignments with distinct draft (temporary save) and revision (finalized, dated, auto-sequenced) workflows. Includes automatic revision numbering (R0, R1, R2, etc.) and strict date validation (dd/mm/yyyy format, calendar validity).

### Performance Optimizations
- TanStack Query for data caching.
- Optimized AG Grid configurations.
- `React.memo` for expensive components.
- Map-based O(1) lookups for vessel rank checkboxes to prevent UI freezes.

## External Dependencies

- **Database**: PersistentFileStorage (development, `test-data.json`), PostgreSQL (production).
- **ORM**: Drizzle ORM (for PostgreSQL).
- **UI Frameworks/Libraries**: shadcn/ui, Tailwind CSS.
- **Data Grids**: AG Grid Enterprise.
- **State Management**: TanStack Query.
- **Form Management**: React Hook Form, Zod (for validation).
- **Routing**: Wouter.