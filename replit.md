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
- **Rotation Module** (Added Oct 2025): Crew rotation planning and management workspace for crewing executives:
  - **Module Purpose**: Bridge between Crew Database and Vessel Database to match available crew with vessel requirements and plan optimal crew changes
  - **Left Sidebar Navigation**: Three dedicated sections:
    - **Due**: Lists crew members due/overdue for rotation
    - **Plan**: Rotation planning workspace for matching crew across multiple vessels
    - **Approval**: Rotation plan approval workflow
  - **Due Section Filter Bar** (Implemented Oct 2025):
    - Matches Vessel Database filter pattern with radio button group
    - **Radio Button Group** (Mutually Exclusive - Vessel-level Filtering):
      - **Vessel**: Multi-select dropdown (Popover + Checkbox pattern) from vessel master data (ID 014)
        - Shows "Vessel" when empty, "X selected" when items selected
        - Users can select multiple vessels for filtering
      - **Fleet**: Single-select dropdown for fleet group filtering
        - Options: Fleet Group 1, Fleet Group 2, Fleet Group 3 (to be integrated with admin masters)
      - **Add Group**: Single-select dropdown for additional group filtering
        - Options: Additional Group 1, 2, 3 (to be integrated with admin masters)
    - **Independent Filters** (Combinable with any vessel-level filter):
      - **Due in**: Time-based filtering with options:
        - Due in 3M, Due in 2M, Due in 1M (based on Contract End date)
        - Overdue in 1M, Overdue (based on Range End date)
      - **Rank**: Single-select from company ranks via `/api/company-ranks`
    - Clear button resets all filters (radio to "vessel", clears all values)
    - Filters toggle button to show/hide filter bar
    - Data sources: `/api/masters/014/data` (vessels), `/api/company-ranks` (ranks)
    - **State Management**:
      - Local React state hooks for filter values (filterType, selectedVessels, fleetValue, addGroupValue, dueInValue, rankValue, showFilters)
      - TanStack Query for data fetching and caching (vessels from `/api/masters/014/data`, ranks from `/api/company-ranks`)
      - No shared store - filter state isolated to RotationModule component
      - Future: Query invalidation will trigger when filter-driven table data is implemented
    - Fixed Issues (Oct 2025):
      - Resolved double-toggle bug in vessel multi-select checkbox handling
      - Proper state management for radio button group and independent filters
  - **Future Implementation**: Plan and Approval sections, crew matching algorithms, multi-vessel optimization workspace

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