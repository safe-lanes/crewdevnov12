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