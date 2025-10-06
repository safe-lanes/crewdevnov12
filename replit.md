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
- **Vessel ID/Name Translation Architecture**: Ensures all backend storage uses vessel IDs while the UI consistently displays vessel names, with a dedicated translation layer (`useVesselLookup` hook) for bidirectional conversion.
- **Vessel Revision System**: Manages vessel rank assignments with "Save Draft" and "Submit" workflows, including date validation and draft cleanup.
- **Rank Designation Synchronization**: A two-tier system for company and vessel rank designations, supporting inheritance and vessel-specific overrides with API backward compatibility.
- **Vessel Database Module**: Displays vessel data, calculates dynamic crew counts, and includes an Officer Matrix, Planning tab for crew relief, and Training Matrix with compliance indicators.
- **Rotation Module**: A dedicated workspace for crew rotation planning and management, featuring:
    - **Due Section**: Lists crew members due/overdue for rotation with a unified dual-section table combining AG Grid and a Canvas-rendered 7-month timeline for visual representation. Includes a comprehensive filter bar.
    - **Plan Section**: Allows creation and editing of rotation plans through a dialog that enables assigning available crew to vessels with specified joining dates and contract periods. Features a multi-vessel assignment indicator and a timeline canvas.
    - **Approval Section**: Planned workflow for rotation plan approval.
- **Performance Optimization**: Utilizes map-based lookups, TanStack Query for caching, `useRef` for preventing re-renders, `useMemo` for calculations, and optimized `PersistentFileStorage`.
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