# Seafarer Performance Management System

## Overview
A comprehensive seafarer performance management system designed to streamline seafarer and vessel management. It integrates crew and appraisal functionalities, a robust vessel revision system for rank assignments, advanced form configuration, and an intuitive user experience. The system aims to optimize crew deployment and compliance through a scalable, module-first architecture, ultimately enhancing maritime operational efficiency and compliance.

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
The application employs a modern web stack with a module-first architecture for clear separation of concerns and scalability.

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Express.js, TypeScript
- **UI Components**: shadcn/ui, Tailwind CSS
- **Data Tables**: AG Grid Enterprise
- **State Management**: TanStack Query v5
- **Form Management**: React Hook Form, Zod validation
- **Routing**: Wouter

### UI/UX Decisions
- Consistent layout, alignment, error handling, and loading states.
- Adherence to SAIL Form Standards for input fields and sections.

### System Design Choices
- **Module-First Architecture**: Ensures clear separation of concerns and scalability.
- **Vessel ID/Name Translation**: Backend uses vessel IDs, UI displays vessel names with a dedicated translation layer.
- **Master Data System**: Centralized storage for reference data (e.g., vessels) via a consistent API.
- **Vessel Revision System**: Manages vessel rank assignments with draft/submission workflows and date validation.
- **Rank Designation Synchronization**: Supports company and vessel-specific rank designations with inheritance and overrides.
- **Vessel Database Module**: Displays vessel data, calculates crew counts, and includes Officer Matrix, Planning, and Training Matrix.
- **Rotation Module**: Manages crew rotation planning with "Due" and "Plan" sections, visual timelines, and comprehensive filters.
- **Promotion Hierarchy System**: Configurable promotion paths for different rank groups, integrated with the Promotions module for filtering and "Next Promotion Rank" calculation.
    - **Promotion Review Form**: A three-part modal for managing promotions (Criteria Review, Approval, Execution) with dynamic criteria and approver management.
    - **Promotion Checklist Form**: A detailed modal for reviewing seafarer information, sea service, and promotion checklist items.
- **Forms Configuration - Company Rank Integration**: Uses company-specific rank labels for rank group creation and automatically matches forms to crew member ranks during appraisals, supporting multi-category forms (Appraisal, Promotion).
- **Drugs & Alcohol Testing Module**: Tracks testing with six test types, comprehensive filtering, and AG Grid tables.
    - **Summary View**: Vessel-centric consolidated view with aggregated history, due-in badges, frequency configuration, and planning fields.
    - **D&A Test Form**: Modal for creating/editing records with dynamic sections for general information, testing equipment, personnel tested (pre-populated roster with dynamic filtering, violation flags, witness selection, and "+ Add Other" option), and digital signature. Includes field visibility logic based on test type and dynamic crew filtering.
- **Rest Hours Module**: Manages seafarer work and rest hours in compliance with maritime regulations (ILO, MLC, US-OPA 90).
    - **PeriodFilter Component**: Reusable period selection component with popover interface supporting two modes: (1) Year + Quarter/Month selection with mutually exclusive Quarter/Month buttons, and (2) Date Range selection with calendar pickers. Defaults to current year and month. Implements controlled component pattern with useEffect synchronization to handle external state resets. Integrated consistently across Dashboard, Record, and Plan modules with year-month validation guards.
    - **Dashboard (Office)**: Provides fleet-wide overview with 3x2 grid of AG Charts Enterprise visualizations showing violations by rank (Chart 3), NCs by rank (Chart 6), and other metrics. Features comprehensive filtering (period, vessel/fleet, groups). Implements chart-level `seriesNodeClick` handlers for drill-down functionality. Charts use white backgrounds for proper image downloads and support multiple chart types (bar, line, pie).
        - **Drill-Down Feature**: Clicking any bar in Charts 3 or 6 opens ViolationsOverviewDialog filtered by the selected rank. Dialog implements rank normalization (strips suffixes like "_1", case-insensitive) to match chart labels with crew records. Empty vessel filter handling: when no vessel is selected, dialog fetches data from ALL vessels rather than filtering to empty set.
    - **Record**: Manages recordkeeping for individual seafarers.
        - **RH Recording Form**: Interactive modal form with a 3-level drill-down structure, HTML table for data entry with half-hour divisions, arrow key navigation, and displays both calendar-day and regulatory "any period" rolling window calculations.
        - **Violation Detection**: Implements 8 violation codes using backward-looking windows for regulatory compliance, providing detailed diagnostics and multi-range violation highlighting. Supports OPA-specific violations.
        - **Recording Status Calculation**: Dynamic percentage calculation based on actual form completion (filled days / total days in month). Progress bars display with color coding (grey for 0%, yellow for partial, green for 100%). Crew-level percentages are calculated individually, while vessel-level percentages aggregate across all crew members. Updates automatically when daily records are saved.
        - **Violation Badge Display**: Crew records table displays both "Total Violations" (completed) and "Predicted Violations" (planned) columns with visual badges. Zero values show grey badges (bg-gray-200), non-zero values show red badges (bg-pink-100). Badge rendering applied consistently to all violation and NC columns.
        - **Duplicate Record Handling**: When multiple daily records exist for the same crew/vessel/month combination, the system uses numeric ID comparison to keep the most recent record (highest ID), preventing stale violation data from displaying.
        - **Vessel Violation Comments**: Vessel-level comment functionality for Masters/Chief Engineers to document corrective actions. Comments are saved at vessel+month level in the ViolationsOverviewDialog (actual violations only, not predicted). Includes textarea for comments, Save button with success/error feedback, and automatic persistence via API endpoints with upsert logic.
        - **Vessel Review Dialog**: Comprehensive 3-section review interface triggered by clicking Due/Overdue badges in the Vessel Review column. Shows (1) Violations table with Date/Rank/Name/Violations/Comments, (2) NC summary table with Rank/Name/Dates/Status/View Report, (3) shared vessel comments. Implements Save/Submit workflow with read-only mode when completed. Critical fix: Daily records filter includes `monthYear === monthValue` to prevent cross-month data contamination.
    - **Plan**: Handles work planning, fixed working hours, and variable tasks for groups of seafarers.
        - **Variable Tasks**: Full CRUD implementation for planning and tracking with shadcn Table components.
        - **Variable Task Form**: Modal for task planning including Date/Time, Record Type, Tasks Involved, advanced Crew Selection System (linked to Rank Administration configurations with department categorization and group shortcuts), Comments, and draft/submit workflow.
        - **Auto-Sync to RH Recording Forms**: Automated synchronization system updates crew members' Rest Hours Recording forms when variable tasks are created, edited, or deleted (only for submitted tasks), handling time mapping, multi-day tasks, work code priority, and color coding.
        - **Fixed Tasks**: Monthly fixed working schedule management with 48 half-hour templates for "at Sea" and "in Port" conditions, supporting watch ('w') and daywork ('d') codes. Table structure matches RH Recording form with direct keyboard typing.
- **Rank Ordering System**: All crew-displaying modules use rank-based sorting from Admin > Rank Administration.
    - Fetches sortOrder from `/api/available-ranks` and creates memoized rankOrderMap
    - **Suffix Normalization**: Strips rank suffixes (e.g., "3rd Officer_1" → "3rd Officer") before sortOrder lookup to handle vessel-specific role variants
    - Unknown/null ranks default to sortOrder 999 for consistent fallback behavior
    - Implemented in: Fixed Tasks, Rest Hours Record, Vessel Crew List
- **Performance Optimization**: Utilizes map-based lookups, TanStack Query for caching, `useRef`, `useMemo`, and optimized `PersistentFileStorage`.
- **Data Storage**: `PersistentFileStorage` for development, with PostgreSQL/Drizzle ORM for production.

## External Dependencies
- AG Grid Enterprise
- shadcn/ui
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- Wouter
- PostgreSQL (planned for production)
- Drizzle ORM