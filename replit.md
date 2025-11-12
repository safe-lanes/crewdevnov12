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

### System Design Choices
- **Module-First Architecture**: Ensures clear separation of concerns and scalability.
- **Vessel ID/Name Translation**: Backend uses vessel IDs, UI displays vessel names with a dedicated translation layer.
- **Master Data System**: Centralized storage for reference data (e.g., vessels) via a consistent API.
- **Vessel Revision System**: Manages vessel rank assignments with draft/submission workflows and date validation.
- **Rank Designation Synchronization**: Supports company and vessel-specific rank designations with inheritance and overrides.
- **Vessel Database Module**: Displays vessel data and includes Officer Matrix, Planning, and Training Matrix.
- **Rotation Module**: Manages crew rotation planning with "Due" and "Plan" sections, visual timelines, and comprehensive filters.
- **Promotion Hierarchy System**: Configurable promotion paths, integrated with a Promotions module for filtering and "Next Promotion Rank" calculation. Includes a multi-part Promotion Review Form and a detailed Promotion Checklist Form.
- **Forms Configuration - Company Rank Integration**: Uses company-specific rank labels for rank group creation and automatically matches forms to crew member ranks during appraisals.
- **Crew Appraisals Module**: Comprehensive crew appraisal management with AG Grid table display and advanced filtering.
    - **Master Data Integration**: Filters connected to master data sources with intelligent fallback:
        - Rank filter: `/api/available-ranks` (Available Ranks Master)
        - Vessel filter: `/api/masters/014/data` (Vessel Master)
        - Vessel Type filter: `/api/masters/015/data` with fallback to unique values extracted from crew data
        - Nationality filter: `/api/masters/001/data` with fallback to unique values extracted from crew data
    - **Intelligent Fallback**: When master data endpoints return empty arrays, the system automatically extracts unique values from existing crew member data to populate filters
    - **Appraisal Workflow**: Supports draft and submitted status, with comprehensive form for performance evaluation
    - **Filter Functionality**: Combined filter support with case-insensitive matching across all filter criteria
- **Drugs & Alcohol Testing Module**: Tracks six test types with comprehensive filtering, AG Grid tables, and a Summary View. Features a D&A Test Form with dynamic sections and digital signature.
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