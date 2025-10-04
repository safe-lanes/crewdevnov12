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
  - **Due Section Unified Dual-Section Table** (Implemented Oct 2025):
    - **Architecture**: Hybrid AG Grid + Custom Canvas Timeline rendering
    - **Left Section (620px fixed width)**: AG Grid Enterprise table with columns: Vessel, Rank, Name, Relief Due
      - Full sorting support (click column headers for ascending/descending)
      - Client-side filtering via API integration with filter bar
      - Row identification via unique `getRowId` using crew member `id` field
    - **Right Section (flexible width)**: Canvas-rendered 7-month timeline visualization
      - 2 months before today + today (yellow anchor line) + 5 months after today
      - Color-coded timeline bars per crew member:
        - **Green**: Contract period (joining date → relief due date)
        - **Yellow**: Grace/range period (relief due → range end date)
        - **Pink**: Overdue period (after range end date)
      - Month headers displayed at top
    - **Unified Interface Synchronization**:
      - Row synchronization: AG Grid's `forEachNodeAfterFilterAndSort()` extracts displayed rows after sort/filter events and updates Timeline state
      - Scroll synchronization: AG Grid's `bodyScroll` event drives Timeline's vertical scroll position in real-time
      - Event listeners: `sortChanged` and `filterChanged` use `requestAnimationFrame` to ensure AG Grid completes operations before Timeline updates
    - **Business Logic** (via `/api/rotation/due-crew`):
      - Joins crew_members with vesselPlanning data
      - Calculates `rangeStartDate`/`rangeEndDate` (defaults to 1-month range if no planning data exists)
      - Returns crew with vessel, rank, contract dates, and range dates
    - **Performance Optimizations**:
      - Canvas rendering for timeline (no DOM overhead)
      - Virtualized row rendering (only visible rows drawn)
      - Debounced scroll updates via requestAnimationFrame
      - TanStack Query caching for crew data
    - **Critical Bug Fixes** (Oct 2025):
      - Fixed `getRowId` returning undefined (changed from `crewMemberId` to `id` field)
      - Removed `crewData.length > 0` guard to properly clear timeline when filters return empty results
      - Fixed "Maximum update depth exceeded" error using setTimeout and requestAnimationFrame timing
  - **Plan Section - New Rotation Plan Dialog** (Implemented Oct 2025):
    - **Purpose**: Create rotation plans by assigning available crew to vessels with joining dates and contract periods
    - **Dialog Structure**:
      - **Vessel & Rank Selection**: Multi-select dropdowns at top for vessels (from master data ID 014) and ranks (from company ranks)
      - **Left Section (1/3 width)**: Crew columns displaying available crew per selected rank
        - Shows crew name (First Last-Initial format) and experience data: Company Yrs / Rank Yrs / Tankers Yrs / OOW Yrs / Endorsements
        - **Multi-vessel Assignment Indicator**: Crew names turn RED when assigned to multiple vessels
        - Horizontal scroll for multiple rank columns
      - **Right Section (2/3 width)**: Vessel timeline canvas showing existing crew and new assignments
        - **Vessel Headers**: Blue background with vessel name and radio button for selection
        - **Month Headers**: Day-based alignment (7-month window: 2 months before + today + 5 months after)
        - **Existing Crew Bars (top half of rows)**: Green (contract period) → Yellow (grace period) → Red (overdue)
        - **New Assignment Bars (bottom half of rows)**: Blue bars for crew assignments with joining date and contract period
        - Click vessel header to select vessel via radio button
    - **Assignment Workflow**:
      1. Select vessels and ranks → Timeline displays existing crew from `/api/rotation/due-crew`
      2. Click vessel header → Selects active vessel (radio button visual feedback)
      3. Click crew member → Opens DatePeriodDialog for joining date and contract period selection
      4. Select date (calendar picker) and period (3, 6, 9, 12 months dropdown) → Click Apply
      5. Assignment created → Blue bar appears on timeline bottom half for that crew/vessel/rank
      6. Assign same crew to multiple vessels → Crew name turns RED in crew column
    - **DatePeriodDialog Component**:
      - Joining Date picker using shadcn Calendar component
      - Contract Period dropdown (3, 6, 9, 12 months options)
      - Apply button (disabled until both fields filled)
      - Auto-resets form on dialog close (via useEffect on open state)
    - **Technical Implementation**:
      - Canvas rendering with day-based positioning for timeline bars
      - Month header clamping to visible range [startDate, endDate] to prevent off-canvas labels
      - Assignment tracking via state array: `{ vessel, rank, crewId, crewName, joiningDate, contractPeriod }`
      - Multi-vessel detection using Set to count unique vessels per crewId
      - Auto-select first vessel when vessels are selected
    - **Save Functionality** (Implemented Oct 2025):
      - Validates plan has at least one vessel, rank, and assignment before saving
      - Generates unique draftId using timestamp format: DRAFT-{timestamp}
      - Calculates planFromDate from earliest crew joining date
      - Calculates planToDate from latest contract end date (joining + contract period)
      - Saves to persistent storage via POST /api/rotation-plans endpoint
      - Sets planStatus to "In Draft" by default
      - Shows success toast and closes dialog on successful save
      - Resets form state to prevent stale data
      - Fixed PersistentFileStorage to properly load and save rotationPlans data
    - **Planned Features**: Propose for Approval functionality with plan submission workflow
  - **Future Implementation**: Approval section workflow, crew matching algorithms, multi-vessel optimization workspace

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