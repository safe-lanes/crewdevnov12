# Seafarer Performance Management System

## Overview
A comprehensive seafarer performance management system for streamlined seafarer and vessel management. It includes crew and appraisal functionalities, a robust vessel revision system for rank assignments, advanced form configuration, and a responsive, intuitive user experience. The system is designed for maintainability and scalability through a module-first architecture, aiming to optimize crew deployment and compliance.

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
- **SAIL Form Standards**: Standardized input field labels, subsection headings, and containers.
- **Error Handling**: Global error boundaries and consistent API error handling.
- **Loading States**: Consistent loading indicators.

### Technical Implementations
- **Vessel ID/Name Translation Architecture**: Ensures all backend storage uses vessel IDs (VSL-XXX format) while the UI consistently displays vessel names, with a dedicated translation layer (`useVesselLookup` hook) for bidirectional conversion. Backend APIs handle legacy assignments by looking up vessel names in Master Data (master ID "014") when vesselId is missing.
- **Master Data System**: Centralized master data management where vessels (master ID "014") and other reference data are stored as master data entries with `entryId` (e.g., VSL-003) and descriptive fields. The `getMasterDataEntries()` API provides consistent access to master data across the application.
- **Vessel Revision System**: Manages vessel rank assignments with "Save Draft" and "Submit" workflows, including date validation and draft cleanup.
- **Rank Designation Synchronization**: A two-tier system for company and vessel rank designations, supporting inheritance and vessel-specific overrides with API backward compatibility.
- **Vessel Database Module**: Displays vessel data, calculates dynamic crew counts, and includes an Officer Matrix, Planning tab for crew relief, and Training Matrix with compliance indicators.
- **Rotation Module**: A dedicated workspace for crew rotation planning and management, featuring:
    - **Due Section**: Lists crew members due/overdue for rotation with a unified dual-section table combining AG Grid and a Canvas-rendered 7-month timeline for visual representation. Includes a comprehensive filter bar.
    - **Plan Section**: Allows creation and editing of rotation plans through a dialog that enables assigning available crew to vessels with specified joining dates and contract periods. Features a multi-vessel assignment indicator and a timeline canvas.
    - **Approval Section**: Displays proposed rotation assignments with canvas-rendered timelines showing current crew contract periods (green), grace periods (yellow), overdue periods (pink), and new assignments (blue). Fully supports all ranks including Master positions with proper vessel ID resolution. Deployment conflict detection correctly excludes the assignment being deployed to prevent false self-conflict errors.
- **Promotion Hierarchy System**: Configurable promotion paths for different rank groups (Deck Officers, Engine Officers, Ratings) accessible from Rank Master screen. Features:
    - **Hierarchy Configuration**: Create multiple promotion hierarchies with custom group names and rank progression paths
    - **Rank Selection**: Only ranks marked as "Applicable to Company" can be used in hierarchies
    - **Visual Display**: Ranks displayed senior-to-junior (top-to-bottom) for intuitive reading, while stored senior-to-junior for correct promotion logic (index 0 = most senior)
    - **Rank Reordering**: Up/down arrow controls to adjust rank positions within the hierarchy
    - **Data Persistence**: RankPath stored as JSON array with automatic parsing/stringifying between frontend and backend
    - **CRUD Operations**: Full create, read, update, delete support with visual indicators for most senior and entry-level positions
    - **Duplicate Prevention**: Validates that each rank appears in only one hierarchy to avoid conflicts
    - **Promotions Module Integration**: Automatically filters Promotions table to show only crew members with available promotion paths, excluding those at senior positions or with unmapped ranks. Column "Next Promotion Rank" displays the calculated next rank based on hierarchy configuration.
    - **Promotion Review Form**: Modal-based 3-part form (A: Criteria Review, B: Approval, C: Execution) integrated with PromotionsTable. Features:
        - **Part A - Criteria Review**:
            - **A1. Seafarer Information**: Displays crew details including name, DOB/age, current rank, promotion rank, and vessel assignment
            - **A2. Minimum Promotion Criteria**: Interactive table with tri-state badge logic (Met/Not Met/Pending) supporting numeric ranges, comparisons, and string matching. Includes verification radio buttons (Yes/No/NA), progress bar, and CES/Language test management with controlled inputs
            - **A3. Training Needs**: Dynamic training table with add/delete functionality, DB selection, category/status dropdowns
            - **A4. Comments & Recommendations**: Reviewer comments system with add/delete handlers
        - **Part B - Approval**: Records approval from designated approvers with:
            - **B1. Approved?**: Dynamic approver management with date, approver selection (Marine Superintendent, Technical Superintendent, Crew Manager, Fleet Manager), status dropdown (Pending/Approved/Rejected), approval radio buttons (Yes/Yes, Conditional/No), and comments display. Add/delete approver functionality with unique ID generation using useRef
            - **B2. Suitable for**: Multi-select chip displays for vessel types and vessel classes with remove capability. Each chip features light blue background with X button for removal
        - **Part C - Execution**: Records promotion execution details with:
            - **C.1 Confirmation & Assignment**: Captures promotion confirmation status (Yes/Waitlist/Rejected), vessel assignment dropdown, and promotion date with timing options (Promoted on board/Promoted prior joining)
            - **B2.1 Promotion confirmed**: Radio button selection with info icon
            - **B2.2 Vessel Assigned**: Dropdown with vessel options and info icon
            - **B2.3 Date of Promotion**: Date input with radio buttons for promotion timing and info icon
            - **Submitted by display**: Shows submitter name with Save and Submit action buttons
        - **Form Interaction**: All action buttons use `type="button"` to prevent unintended form submission, ensuring add/delete operations work correctly. Unique ID generation for dynamic rows uses useRef counters to prevent duplicate key issues
        - **Testing**: Comprehensive data-testid attributes on all interactive elements for e2e testing compatibility
    - **Promotion Checklist Form**: Modal-based 2-part form accessible via A2.5 progress bar click in Promotion Review Form. Features:
        - **Continuous Scroll Layout**: Custom modal with fixed header (title, Save button, close button) and scrollable content area displaying Parts A and B in single continuous view, eliminating tab-based navigation for seamless user experience
        - **Part A - General** (read-only):
            - **A1. Seafarer's Information**: Displays name, current rank, promotion rank, vessel, DOB, and age from promotionData
            - **A2. Details of Sea Service**: Dynamically fetches and displays sea service records from crew member API with loading/error states
            - **A3. Progress of completion**: Shows checklist completion progress with visual indicators
        - **Part B - Promotion Checklist** (stub): Placeholder for dynamic promotion checklist sections
        - **Data Integration**: Properly typed PromotionData interface, fetches crew member details via `/api/crew-members/${id}`, parses currentCompanySeaService JSON, handles loading/error/empty states
        - **Save Behavior**: handleSave closes modal after submission for consistent user experience
- **Forms Configuration - Company Rank Integration**: The Forms Configuration module (Admin > Forms Configuration) uses company-specific rank labels for rank group creation and connects to the Appraisal Form. Key features:
    - **Company-Applicable Ranks Only**: The "Add Rank Group" dialog displays only ranks where `applicableToCompany` is checked in Rank Administration > Company tab
    - **Company Label Usage**: Uses company-specific rank labels (from `rank.label` field) instead of master rank names, ensuring consistency with company terminology (e.g., "2nd Officer" vs "Second Officer")
    - **Form Selection Logic**: When creating appraisals, the system automatically matches crew member ranks against rank groups using company labels to determine which form configuration to use
    - **Data Persistence**: Rank groups store company labels in JSON format in persistent storage, maintaining consistency across the system
    - **Dynamic Form Loading**: AppraisalForm component automatically fetches the correct form configuration via `GET /api/forms/for-rank/:rankLabel` endpoint when opening an appraisal, ensuring the configured form template is used for each rank
    - **Backend Matching**: `getFormForRank()` storage method iterates through rank groups to find which form is configured for a given rank, providing seamless integration between Admin configuration and Appraisal execution
    - **Multi-Category Form Support**: Forms support independent categories (Appraisal and Promotion) with category-specific rank group mappings:
        - **Schema**: Forms table includes `category` field (default: "appraisal")
        - **Category Filtering**: `getFormForRank(rankLabel, category?)` supports optional category filtering
        - **API**: GET /api/forms/for-rank/:rankLabel accepts optional `?category=` query parameter
        - **UI Grouping**: Forms Configuration table groups forms by category with appraisal forms displayed first, then promotion forms
        - **Create Dialog**: Category dropdown in Create Form dialog allows selecting "Appraisal Form" or "Promotion Form"
        - **Rank Group Association**: AddRankGroupDialog correctly resolves form ID from form name to prevent rank groups from being added to wrong forms
        - **Error Handling**: Explicit error handling when form lookup fails, preventing silent fallback to incorrect form association
        - **Table Display**: Forms without rank groups are automatically filtered out from the table display to maintain clean UI and prevent empty form rows. Each form name appears once with rowSpan covering all its rank group rows
- **Performance Optimization**: Utilizes map-based lookups, TanStack Query for caching, `useRef` for preventing re-renders, `useMemo` for calculations, and optimized `PersistentFileStorage`. Fixed infinite render loop in AppraisalForm by memoizing the sections array.
- **Data Storage**: `PersistentFileStorage` for development, with PostgreSQL/Drizzle ORM schema for production.

## External Dependencies
- **AG Grid Enterprise**: Advanced data tables.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Styling framework.
- **TanStack Query**: Server state management and data fetching.
- **React Hook Form**: Form management library.
- **Zod**: Schema validation library.
- **Wouter**: Client-side routing library.
- **PostgreSQL**: Relational database (planned for production).
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.