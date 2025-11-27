# Seafarer Performance Management System

## Overview
A comprehensive system designed to streamline seafarer and vessel management. It integrates crew and appraisal functionalities, a robust vessel revision system for rank assignments, advanced form configuration, and an intuitive user experience. The system aims to optimize crew deployment and compliance through a scalable, module-first architecture, ultimately enhancing maritime operational efficiency and compliance.

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

### UI/UX Decisions
- Consistent layout, alignment, error handling, and loading states.
- Adherence to SAIL Form Standards for input fields and sections.
- **Date Display Format**: All dates throughout the application are displayed in DD-MMM-YYYY format (e.g., 15-Dec-2025) unless otherwise specified. Use the `formatDate()` utility from `client/src/utils/format.ts` or inline date-fns `format(date, 'dd-MMM-yyyy')` for consistency.

### System Design Choices
- **Module-First Architecture**: Ensures clear separation of concerns and scalability.
- **Vessel ID/Name Translation**: Backend uses vessel IDs, UI displays vessel names with a dedicated translation layer.
- **Canonical Vessel Code Enforcement**: All storage backends strictly enforce VSL-XXX format vessel codes with zero fallback logic.
    - **DatabaseStorage (Production)**: Only accepts vessels from master data (master_id='014') with valid `nuid` matching `/^VSL-\d+$/` pattern. Rejects vessels with missing nuid or numeric ID fallbacks.
    - **MemStorage/PersistentFileStorage (Testing)**: Uses `STATIC_VESSEL_MAPPING` for vessel name → code translation. Helper function `translateVesselNameToCode()` throws error on translation failure.
    - **Data Integrity**: All backends throw descriptive errors when vessel translation fails. No silent data corruption possible. Rotation deployments return canonical `vesselCode` for proper frontend cache invalidation.
- **Master Data System**: Centralized storage for reference data (e.g., vessels) via a consistent API.
- **Vessel Revision System**: Manages vessel rank assignments with draft/submission workflows and date validation.
- **Rank Designation Synchronization**: Supports company and vessel-specific rank designations with inheritance and overrides.
- **Vessel Database Module**: Displays vessel data and includes Officer Matrix, Planning, and Training Matrix.
    - **Crew Handover Workflow**: Manages crew transitions with primary/secondary status system. When a reliever signs on:
        - If position is vacant (no primary crew): Reliever is promoted directly to primary status
        - If position is occupied: Reliever becomes secondary crew while existing crew remains primary
        - Crew names display in "LastName, FirstName" format with status indicator (P/S)
        - Backend enrichment joins vessel_planning with crew_members table for name display
    - **Crew Archive System**: Manages historical crew records with sign-off workflow and archive toggle.
        - **Archive Trigger**: Setting Relief Status to "Signed Off" with a Sign Off Date auto-sets isArchived=true and archivedDate
        - **Business Rule**: Primary crew cannot sign off when secondary (reliever) exists - reliever must take over first
        - **API Filtering**: GET /api/vessel-planning/vessel/:vesselId supports `?archived=true|false` for server-side filtering
        - **Show Archived Toggle**: Checkbox in Crew List page header to switch between active and archived crew views
        - **Conditional Columns**: Archived view displays 8 columns (S.No., Rank, Name, Nationality, Joined, Actual Sign Off Date, Appraisal, Handover); Active view displays full 15 columns
        - **Data Retention**: Archived records preserved indefinitely for compliance and historical reference
- **Rotation Module**: Manages crew rotation planning with "Due" and "Plan" sections, visual timelines, and comprehensive filters.
- **Promotion Hierarchy System**: Configurable promotion paths, integrated with a Promotions module for filtering and "Next Promotion Rank" calculation. Includes a multi-part Promotion Review Form and a detailed Promotion Checklist Form.
- **Forms Configuration - Company Rank Integration**: Uses company-specific rank labels for rank group creation and automatically matches forms to crew member ranks during appraisals.
- **Vessel Type Hierarchy System**: Centralized 3-level vessel type classification in `client/src/utils/data/vesselTypes.ts`.
    - **Level 1 (Categories)**: Tanker Vessels, Dry Vessels, Other Vessels
    - **Level 2 (Types)**: Oil Tanker, Chemical Tanker, Gas Tanker, Bitumen/Asphalt Carriers, Bulk Carrier, General Cargo, Container, RoRo, Barges, Offshore Support Vessels, Shuttle Tankers
    - **Level 3 (Subtypes)**: Product Oil Tanker, Crude Oil Tanker, LNG Tanker, LPG Tanker
    - **Utility Functions**: `getParentTypes()` for experience inheritance (e.g., LPG Tanker → Gas Tanker → Tanker Vessels), `getChildTypes()` for analytics aggregation
    - **Dropdown Integration**: `DEFAULT_DROPDOWN_VESSEL_TYPES` exports Level 2 + Level 3 types for form dropdowns; can filter by level with `getVesselTypesByLevel([2])` or `getVesselTypesByLevel([3])`
    - **Modules Using**: CrewInfoForm, RecruitmentApplicationForm, ElementCrewAppraisals, PromotionsModule
- **Crew Appraisals Module**: Comprehensive crew appraisal management with AG Grid table display and advanced filtering.
    - **Master Data Integration**: Filters connected to master data sources with intelligent fallback:
        - Rank filter: `/api/available-ranks` (Available Ranks Master)
        - Vessel filter: `/api/masters/014/data` (Vessel Master)
        - Vessel Type filter: `/api/masters/015/data` with fallback to centralized vessel types from `vesselTypes.ts`
        - Nationality filter: `/api/masters/001/data` with fallback to unique values extracted from crew data
    - **Intelligent Fallback**: When master data endpoints return empty arrays, the system uses centralized vessel types or extracts unique values from existing crew member data
    - **3-Stage Appraisal Workflow**: Independent stage submissions with status progression (Draft → Preliminary → Submitted → Reviewed)
        - **Stage 1** (Parts A & B - Target Setting): Sets appraisal period, personality index, trainings, and targets. Part B evaluation fields are optional and can be left blank.
        - **Stage 2** (Parts C-F - Performance Assessment): Fills Part B evaluations and completes competence/behavioral assessments, training needs, and recommendations.
        - **Stage 3** (Part G - Office Review): Final office review and training follow-ups. Locks form after submission.
    - **Conditional UI**: Part B Evaluation columns hidden during Draft/Preliminary status, visible during Submitted/Reviewed status
    - **Appraisal Editing**: Full support for reopening and editing existing appraisals with automatic form hydration from persisted data
    - **Optional Fields**: Part A fields (appraisalPeriodTo, personalityIndexCategory) and Part B evaluation fields are optional in Stage 1
    - **Filter Functionality**: Combined filter support with case-insensitive matching across all filter criteria
- **Drugs & Alcohol Testing Module**: Tracks six test types with comprehensive filtering, AG Grid tables, and a Summary View. Features a D&A Test Form with dynamic sections and digital signature.
- **Recruitment Module**: Manages candidate applications and recruitment workflow with AG Grid table display and comprehensive filtering.
    - **Soft Delete Functionality**: Non-destructive deletion system that preserves candidate records in database while hiding them from UI.
        - Database: `is_delete` boolean column with index for performance
        - API: `PATCH /api/recruitment-candidates/:id/soft-delete` endpoint
        - Frontend: Confirmation dialog and toast notifications for user feedback
        - Filtering: All GET endpoints automatically exclude soft-deleted records
        - Data Recovery: Deleted records preserved in database for compliance and audit requirements
- **Rest Hours Module**: Manages seafarer work and rest hours in compliance with maritime regulations.
    - **PeriodFilter Component**: Reusable period selection component with year/quarter/month or date range modes.
    - **Dashboard (Office)**: Provides fleet-wide overview with AG Charts Enterprise visualizations, performance overview cards with custom gauges, and drill-down functionality to detailed violation and NC overviews. Includes a Vessel Analysis matrix showing violations/NCs by vessel and month.
    - **Record**: Manages recordkeeping for individual seafarers. Features an interactive RH Recording Form with HTML table for data entry, arrow key navigation, and real-time rolling window violation detection (MLC 2006/ILO, OPA-specific). Handles International Date Line Crossing Adjustments. Displays recording status and violation badges. Includes vessel-level comment functionality and a comprehensive Vessel Review Dialog.
    - **Plan**: Handles work planning, fixed working hours, and variable tasks. Features full CRUD for variable tasks with an advanced Crew Selection System and automated synchronization to RH Recording Forms. Manages fixed tasks with 48 half-hour templates.
- **Rank Ordering System**: All crew-displaying modules use rank-based sorting with suffix normalization from Admin > Rank Administration.
- **Performance Optimization**: Utilizes map-based lookups, TanStack Query for caching, `useRef`, `useMemo`, and optimized `PersistentFileStorage`.
- **Data Storage**: `PersistentFileStorage` for development, with PostgreSQL/Drizzle ORM for production.

## External Dependencies
- React 18
- TypeScript
- Vite
- Express.js
- AG Grid Enterprise
- shadcn/ui
- Tailwind CSS
- TanStack Query v5
- React Hook Form
- Zod
- Wouter
- PostgreSQL (planned for production)
- Drizzle ORM