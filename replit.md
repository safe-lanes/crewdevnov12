# Seafarer Performance Management System

## Overview
A comprehensive seafarer performance management system designed to streamline seafarer and vessel management. It integrates crew and appraisal functionalities, a robust vessel revision system for rank assignments, advanced form configuration, and an intuitive user experience. The system aims to optimize crew deployment and compliance through a scalable, module-first architecture.

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

### Technical Implementations
- **Vessel ID/Name Translation**: Backend uses vessel IDs, UI displays vessel names with a dedicated translation layer.
- **Master Data System**: Centralized storage for reference data like vessels, accessible via a consistent API.
- **Vessel Revision System**: Manages vessel rank assignments with draft and submission workflows, including date validation.
- **Rank Designation Synchronization**: Supports company and vessel-specific rank designations with inheritance and overrides.
- **Vessel Database Module**: Displays vessel data, calculates crew counts, and includes Officer Matrix, Planning, and Training Matrix.
- **Rotation Module**: Manages crew rotation planning with "Due" and "Plan" sections, featuring visual timelines, comprehensive filters, and multi-vessel assignment.
- **Promotion Hierarchy System**: Configurable promotion paths for different rank groups, accessible from the Rank Master screen.
    - **Hierarchy Configuration**: Allows creation, reordering, and CRUD operations for promotion paths.
    - **Promotions Module Integration**: Filters the Promotions table and calculates the "Next Promotion Rank" based on configured hierarchies.
    - **Promotion Review Form**: A three-part modal form (Criteria Review, Approval, Execution) for managing promotions, including dynamic criteria, approver management, and execution details.
    - **Promotion Checklist Form**: A continuous-scroll modal for detailed review of seafarer information, sea service, and promotion checklist items.
- **Forms Configuration - Company Rank Integration**: The Forms Configuration module uses company-specific rank labels for rank group creation and automatically matches forms to crew member ranks during appraisals.
    - **Multi-Category Form Support**: Supports independent categories (Appraisal, Promotion) with category-specific rank group mappings and filtering.
    - **Promotion Form Builder**: Provides a comprehensive configuration interface for promotion forms, mirroring the three-part structure of the Promotion Review Form.
- **Drugs & Alcohol Testing Module**: Tracks drug and alcohol testing with six test types, comprehensive filtering, and AG Grid tables for data display.
    - **Summary View**: Vessel-centric consolidated view showing all 5 test types in a single table with aggregated history, due-in badges, frequency configuration, and planning fields. Supports single-vessel selection with auto-selection.
    - **D&A Test Form**: Modal form for creating/editing test records with Part A (Basic Information) and Part B (Personnel Details).
        - **Part A - B1. General**: 13 fields including vessel, location, test type, multi-select alcohol/drug type (checkboxes), date/time, incident linking, reason, description, and external results date (conditional).
        - **Part A - B2. Testing Equipment**: Dynamic equipment section with N/A checkbox, multiple equipment entries (Equipment ID dropdown with auto-populate for Make/Model and Serial No from master data), last calibrated dates, and add/remove functionality.
        - **Part B - B1. Personnel Tested**: Dynamic table pre-populated with vessel crew roster, featuring columns for rank, name, alcohol/drug test checkboxes with date/time, results (BAC levels), violation flags, and witness selection. Supports "+ Add Other" button for manual personnel entries. Table dynamically refreshes when vessel selection changes in the form, clearing/updating crew roster while preserving draft data.
        - **Part B - Comments**: Textarea for additional testing notes and observations.
        - **Part B - Master/Deputy Confirmation**: Digital signature section with confirmation checkbox, name field, date selector, and attachment file upload displaying filename on selection.
        - **Field Visibility Logic**: Post-incident fields (Incident Title, Date & Time of Incident, Alcohol/Drug Test Date & Times) show only for post-incident type; Other test fields (Initiated By, Reason for Testing, Description) show only for others type; External Results Date visible for annual, post-incident, and others types only.
        - **Dynamic Crew Filtering**: Form watches vessel selection changes and automatically refreshes personnel table with current vessel's crew using useEffect with vessel change detection. Handles empty crew scenarios by clearing personnel rows when switching to vessels without crew.
        - **Data Structure**: alcoholDrugType stored as array for true multi-select support, testingEquipment as JSON array for multiple entries, personnelTested as JSON array with nested test objects, masterDeputySignature as JSON object, all integrated with PersistentFileStorage.
- **Rest Hours Module**: Manages seafarer work and rest hours in compliance with maritime regulations (ILO, MLC, US-OPA 90).
    - **Dashboard**: Provides fleet-wide overview of recordkeeping status, compliance, violations, non-conformities, and statistics. Features comprehensive filtering with Period dropdown (last 12 months + older periods), radio-button selection for Vessel/Fleet/Additional Group filters, vessel multi-select using live data from master storage, and Clear functionality. Follows the same filter pattern as the Rotation module. Dashboard content implementation pending.
    - **Record**: Manages recordkeeping of work and rest hours for seafarers. Features comprehensive filtering with Period dropdown (last 12 months + older periods), radio-button selection for Vessel/Fleet/Additional Group filters, vessel multi-select using live data from master storage, and Clear functionality. Follows the same filter pattern as the Rotation module.
        - **RH Recording Form**: Modal form with 3-level drill-down structure (Vessel Overview → Crew Records → Recording Form) featuring interactive dropdowns for Period, Vessel, and Crew Member selection. Uses HTML table with half-hour divisions (48 cells per day) for data entry with arrow key navigation support. Displays both calendar-day metrics and regulatory "any period" rolling window calculations across all possible time windows.
        - **Violation Detection**: Implements 8 violation codes checking regulatory compliance across all possible rolling windows. Code 3 (rest period distribution) checks that rest periods are divided into no more than 2 periods with at least one being ≥6 hours, evaluated across all 49 possible 24-hour windows per day. Code 4 (interval between rest periods) validates that work gaps between consecutive rest periods don't exceed 14 hours, including post-loop check for windows ending with continuous work.
        - **UX Features**: Vessel-dependent crew filtering (shows only crew assigned to selected vessel via presentVessel field), auto-reset crew selection on vessel change, keyboard navigation (arrow keys, Tab), fixed cell widths (15px) to prevent layout shifts, and two-row header structure for "any period" columns.
    - **Plan**: Handles work planning, fixed working hours, and variable tasks affecting groups of seafarers. Features comprehensive filtering with Period dropdown (last 12 months + older periods) and vessel single-select using live data from master storage, and Clear functionality. Includes centered module switcher (Fixed Tasks/Variable Tasks) using same rounded-pill style as Rank Administration, with period display in "YYYY, MMM" format shown next to the title. Plan content implementation pending.
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