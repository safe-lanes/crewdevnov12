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
The codebase is organized into feature modules (`crewing`, `admin`, `vessel`, `crew-pool`, `recruitment`) within the `client/src/modules/` directory, alongside shared components, utilities, hooks, and global types. Each module has its own dedicated sidebar for navigation when applicable.

### UI/UX Decisions
- **Layout and Alignment**: Content, filter bars, and tables align consistently with screen titles.
- **SAIL Form Standards**: Standardized input field labels (`text-xs text-gray-500`), subsection headings (`text-base font-medium` with `#16569e`), and subsection containers (`mb-6 border border-[#EAEBEF] rounded-lg p-4`) ensure visual uniformity.
- **Error Handling**: Global error boundaries and consistent API error handling provide user-friendly feedback.
- **Loading States**: Consistent loading indicators are implemented for improved user experience.

### Technical Implementations
- **Vessel Revision System**: Manages vessel rank assignments with distinct "Save Draft" (temporary, no date) and "Submit" (finalized, mandatory date, auto-sequencing R0→R1→R2) workflows. It includes robust date validation and cleans up drafts upon submission.
- **Rank Designation Synchronization** (Fixed Oct 2025): Comprehensive two-tier designation system ensuring proper data flow from Company Ranks to Vessel Ranks:
  - **Company-only fields** (officer, rating, seniorOfficer, deckOfficer, engOfficer, pettyOfficer, deckRating, engineRating, generalRating, cateringRating): Flow down automatically from Company Ranks, always kept in sync, not editable at vessel level
  - **Vessel-specific override fields** (safetyOfficer, sso, medicalOfficer, navigatingOfficer, emtOfficer): Inherit company defaults but allow vessel-specific customization
  - Merge logic preserves vessel overrides while updating company-only fields when loading saved data from API
  - **API Backward Compatibility** (Fixed Oct 2025): GET `/api/vessel-revisions/ranks/:vesselId` endpoint dynamically merges designation fields from current company ranks before returning vessel rank data, ensuring legacy revisions saved before designation sync implementation still display correctly in Officer Matrix
  - Enables Officer Matrix to correctly display officer ranks based on company designation settings
- **Vessel Database Module**: Displays all vessels configured in Admin > Rank Admin > Vessel Tab (Master Data ID 014). Features:
  - Real-time vessel data fetching from `/api/masters/014/data`
  - Dynamic crew count calculation by matching crew members to vessels
  - Filter bar with radio buttons for Vessel, Fleet, and Add Group views
  - AG Grid table with columns: Vessel name, Type, Crew o/b count, Actions
  - Loading states handled via TanStack Query
  - Integrated with crew management system for accurate on-board counts
  - **Crew List Display**: Shows ONLY ranks with "Actual Manning" checked, ensuring data consistency with Admin > Rank Admin > Vessel Tab configuration. All manning types (Safe, Optimum, High Workload) remain stored in vessel revisions for future compliance checks and alerts (Oct 2025)
  - **Planning Tab** (Added Oct 2025): Crew relief planning interface with dual-section table layout:
    - Auto-populated rank rows from vessel revision system
    - On Board Status section: displays crew name, relief due date, sign-off details, and relief status
    - Reliever Status section: shows reliever crew name, joining date/port, and joining status
    - **On Board Status Edit Dialog** (Added Oct 2025): Dialog for editing on-board crew member relief details:
      - Display-only fields: Name, Nationality, Relief Due (auto-populated from crew list)
      - Editable fields: Sign Off Date (date picker with Popover + Calendar), Sign Off Port (dropdown), Relief Status (dropdown: Proposed, Planned, Confirmed)
      - Date picker: Uses react-day-picker Calendar component, stores dates as YYYY-MM-DD, displays as dd-MMM-yyyy format
      - Full React Hook Form + Zod validation integration
      - Data persistence via PATCH/POST to `/api/vessel-planning/:id`
    - **Relief Status Edit Dialog**: Fully functional form for editing reliever details with proper React Hook Form integration:
      - Form fields: Name (read-only), Nationality (read-only), Joining Status, Contract Period, Contract End Range (Start/End), Joining Date, Joining Port, Deployment Checklist, Applicable Docs
      - Number inputs correctly convert string inputs to numbers using custom onChange handlers
      - Select components handle undefined/empty values properly (value={field.value || undefined})
      - useEffect hook resets form when dialog opens to load saved data from planningData prop
      - All fields persist correctly on save/submit (Oct 2025 bug fix)
    - Data persisted via vesselPlanning schema in PersistentFileStorage
    - API endpoints: POST `/api/vessel-planning`, PATCH `/api/vessel-planning/:id`, GET `/api/vessel-planning/vessel/:vesselId`
- **Performance Optimization**: 
  - Map-based O(1) lookups for vessel rank checkboxes to prevent browser freezing
  - TanStack Query for data caching
  - useRef pattern in AdminModule to prevent infinite re-render loops:
    - `prevVesselOptionsRef`: Prevents redundant vessel option syncs
    - `prevCompanyRankSyncRef`: Blocks duplicate company rank data syncs from rank master
    - `prevCompanyFormSyncRef`: Guards React Hook Form sync to prevent infinite updates (added Oct 2025)
    - `loadedVesselsRef`: Tracks loaded vessels to prevent race conditions where stale sync overwrites API data
  - All refs use JSON.stringify for value comparison to detect actual data changes
  - useMemo for derived vessel data calculations to minimize re-renders
  - **Storage Performance** (Oct 2025): Optimized `PersistentFileStorage` with async file writes, 300ms debouncing to batch changes, and race condition protection via `needsResave` flag to prevent data loss during rapid operations
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