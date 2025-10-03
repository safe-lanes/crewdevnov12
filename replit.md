# Seafarer Performance Management System

## Overview
A comprehensive seafarer performance management system designed to streamline seafarer management, including crew and appraisal functionalities, with a robust vessel revision system for managing rank assignments. The system features advanced form configuration, responsive design, and an intuitive user experience, aiming for maintainability and scalability through a module-first architecture.

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

### UI/UX Decisions
- **Layout and Alignment**: Consistent alignment of content, filter bars, and tables.
- **SAIL Form Standards**: Standardized input field labels, subsection headings, and containers for visual uniformity.
- **Error Handling**: Global error boundaries and consistent API error handling.
- **Loading States**: Consistent loading indicators.

### Technical Implementations
- **Vessel Revision System**: Manages vessel rank assignments with "Save Draft" and "Submit" workflows, including date validation and draft cleanup.
- **Rank Designation Synchronization**: Two-tier system for company and vessel rank designations, with inheritance and vessel-specific overrides. Includes API backward compatibility for legacy data.
- **Vessel Database Module**: Displays vessel data, calculates dynamic crew counts, and features a filter bar and AG Grid table.
  - **Crew List Display**: Shows only ranks with "Actual Manning" checked, with rank matching logic that normalizes suffixed rank names.
  - **Officer Matrix Tab**: Displays officer qualifications and experience, with multi-row headers and filters for officer ranks. Includes a "Compliance Matrix Dialog" for checking against oil major requirements.
  - **Planning Tab**: Crew relief planning interface with auto-populated rank rows, "On Board Status" and "Reliever Status" sections, and editable dialogs for relief and reliever details with full React Hook Form and Zod integration.
  - **Training Matrix Tab**: Displays certification and training requirements, categorized by Licenses & DOC, Statutory Courses, and Value Add Courses, with visual compliance indicators and dynamic rank columns.
- **Performance Optimization**: Map-based O(1) lookups, TanStack Query for caching, `useRef` pattern to prevent re-renders, `useMemo` for derived calculations, and optimized `PersistentFileStorage` with async, debounced, and race-condition-protected file writes.
- **Data Storage**: `PersistentFileStorage` for development; PostgreSQL/Drizzle ORM schema for production.
- **Crew Database Population**: Seeded with 135 realistic crew members with varied data, unique IDs, and full CRUD API support.
- **Rotation Module**: Crew rotation planning and management workspace with "Due" section for crew members due/overdue for rotation, including filter bar with time, vessel, fleet, group, and rank filters.

## External Dependencies
- **AG Grid Enterprise**: Advanced data tables.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Styling.
- **TanStack Query**: Server state management and caching.
- **React Hook Form**: Form management.
- **Zod**: Schema validation.
- **Wouter**: Client-side routing.
- **PostgreSQL**: Planned production database.
- **Drizzle ORM**: ORM for PostgreSQL.