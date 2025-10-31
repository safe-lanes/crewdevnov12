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
    - **Dashboard**: Provides fleet-wide overview of recordkeeping status, compliance, and statistics with comprehensive filtering.
    - **Record**: Manages recordkeeping for individual seafarers.
        - **RH Recording Form**: Interactive modal form with a 3-level drill-down structure, HTML table for data entry with half-hour divisions, arrow key navigation, and displays both calendar-day and regulatory "any period" rolling window calculations.
        - **Violation Detection**: Implements 8 violation codes using backward-looking windows for regulatory compliance, providing detailed diagnostics and multi-range violation highlighting. Supports OPA-specific violations.
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