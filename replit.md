# Seafarer Performance Management System

## Project Overview

A comprehensive seafarer performance management system that leverages advanced form configuration, responsive design, and intuitive user experience for maritime professionals. The system currently uses PersistentFileStorage (test-data.json) for development with PostgreSQL schema defined for future production deployment. The codebase has been refactored to use a module-first architecture for better maintainability and scalability.

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript  
- **Storage**: PersistentFileStorage (development) with PostgreSQL/Drizzle ORM schema (production-ready)
- **UI Components**: shadcn/ui + Tailwind CSS
- **Data Tables**: AG Grid Enterprise
- **State Management**: TanStack Query v5
- **Form Management**: React Hook Form + Zod validation
- **Routing**: Wouter

### Module Structure

The application follows a module-first architecture:

```
client/src/
├── app/                    # Application root and routing
├── modules/               # Feature modules
│   ├── crewing/          # Crew management module
│   └── admin/            # Administration module
├── components/           # Shared components
│   ├── common/          # Pure UI components
│   ├── layout/          # Layout components
│   ├── feedback/        # Error handling & loading states
│   ├── form/            # Form field components
│   └── ui/              # shadcn/ui components
├── utils/               # Utility functions
│   ├── data/           # Static data and constants
│   ├── http.ts         # HTTP client
│   ├── format.ts       # Data formatting utilities
│   └── validation.ts   # Common validation functions
├── hooks/              # Global React hooks
├── lib/                # Third-party library configs
├── styles/             # Global styles
└── types/              # Global type definitions
```

## Recent Changes

### Navigation Menu Fix (September 30, 2025)
- **Date**: September 30, 2025
- **Changes**:
  - Fixed duplicate key issue where "Vessel" and "Admin" menu items both used `/admin` route
  - Changed "Vessel" menu item to use unique `/vessel` route
  - Resolved multiple menu highlighting bug - now only the clicked menu item gets highlighted
  - "Vessel" route now shows 404 page until vessel submodule is implemented

### Vessel Checkbox Performance Fix (September 30, 2025)
- **Date**: September 30, 2025
- **Changes**:
  - Fixed critical infinite loop causing "Maximum update depth exceeded" errors
  - Resolved browser freeze when clicking vessel rank checkboxes
  - Replaced global `optimizedVesselRankLookup` with scoped `currentVesselRankLookup` for O(R) performance
  - Fixed React useEffect dependency array violation by adding `vesselOptions` to dependencies
  - Added change detection to prevent unnecessary state updates and infinite loops
  - Checkboxes now respond instantly without browser freezing or "Page Unresponsive" dialogs

### Vessel Revision System Implementation (September 30, 2025)
- **Date**: September 30, 2025
- **Changes**:
  - Implemented comprehensive vessel revision management system with automatic sequencing
  - Added vessel draft storage for temporary saves (no date required)
  - Added vessel revision storage for finalized versions (mandatory dd/mm/yyyy date)
  - Implemented automatic revision numbering (R0→R1→R2) where each vessel maintains independent counters
  - Created Save Draft endpoint with upsert logic (update existing draft or create new)
  - Created Submit endpoint with automatic sequencing and draft cleanup
  - Added mandatory date validation (dd/mm/yyyy format) with calendar date verification
  - Implemented performance optimization using Map-based O(1) lookups for vessel rank checkboxes
  - All data persists via PersistentFileStorage (test-data.json) across application restarts

### Major Refactoring - Module-First Architecture (January 2025)
- **Date**: January 5, 2025
- **Changes**:
  - Restructured entire codebase to module-first architecture while preserving original UI
  - Organized code into feature modules (crewing, admin) for better maintainability
  - Created reusable form components infrastructure for future use
  - Implemented comprehensive utility functions (http, validation, formatting)
  - Maintained existing ElementCrewAppraisals interface without visual changes
  - Updated module exports and imports to use new structure
  - Added error handling components and HTTP client utilities
  - Preserved all existing functionality while improving code organization

### Recruitment Module Implementation (September 2025)
- **Date**: September 2, 2025
- **Changes**:
  - Created Recruitment module with left sidebar navigation (In Progress, Recruited, Waitlist, Rejected)
  - Implemented In Progress submodule with filters and AG Grid table
  - Established standard alignment for filters and tables with screen titles
  - Added sample recruitment candidate data and full CRUD interface structure

### Key Features Implemented
- **Crew Management**: Complete CRUD operations for crew members
- **Performance Ratings**: Visual rating badges with color coding
- **Advanced Filtering**: Search and filter by multiple criteria
- **Form Validation**: Zod-based validation with user-friendly error messages
- **Error Handling**: Global error boundary with retry functionality
- **Loading States**: Consistent loading indicators throughout the app
- **Responsive Design**: Mobile-first approach with responsive tables

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

## Development Guidelines

### File Organization
- Group related functionality into modules
- Use index.ts files for clean exports
- Keep components focused and reusable
- Separate concerns (validation, API, UI)

### Error Handling
- Use AppErrorBoundary for React error catching
- Implement consistent API error handling
- Provide user-friendly error messages
- Log errors for debugging

### Performance
- Use TanStack Query for data caching
- Implement loading states for better UX
- Optimize AG Grid configurations
- Use React.memo for expensive components

### Layout and Alignment Standards
- **Content Alignment**: All filters bars and tables must align with screen titles (no left padding on container elements)
- **Filter Sections**: Use `p-4 pl-0` for filter containers to maintain consistent alignment
- **Table Containers**: Use `p-4 pl-0` for CardContent wrapping AG Grid tables to align with screen titles
- **Standard Pattern**: Remove left padding (`pl-0`) from main content containers while maintaining other padding for proper spacing

### SAIL Form Standards
- **Input Field Labels**: Use `text-xs text-gray-500 tracking-wide` for all form field labels (color #6b7280, font size 12px)
- **Subsection Headings**: Use `text-base font-medium` with color #16569e for subsection headings (font size 16px)
- **Subsection Containers**: Use `mb-6 border border-[#EAEBEF] rounded-lg p-4` for subsection borders (fine border #EAEBEF, no shadow, rounded corners with padding)
- **Standard Pattern**: All SAIL forms should follow these consistent styling patterns for visual uniformity across the application

## API Endpoints

### Crew Management
- `GET /api/crew-members` - List crew members with filtering
- `POST /api/crew-members` - Create new crew member
- `GET /api/crew-members/:id` - Get crew member details
- `PATCH /api/crew-members/:id` - Update crew member
- `DELETE /api/crew-members/:id` - Delete crew member

### Appraisals
- `GET /api/appraisals` - List appraisals with filtering
- `POST /api/appraisals` - Create new appraisal
- `GET /api/appraisals/:id` - Get appraisal details
- `PATCH /api/appraisals/:id` - Update appraisal
- `DELETE /api/appraisals/:id` - Delete appraisal

### Vessel Drafts (Temporary Saves)
- `GET /api/vessel-drafts` - List all vessel drafts
- `GET /api/vessel-drafts/:id` - Get specific draft by ID
- `GET /api/vessel-drafts/by-vessel/:vesselId` - Get all drafts for a specific vessel
- `POST /api/vessel-drafts` - Create new draft (requires: vesselId, revision, draftData)
- `POST /api/vessel-drafts/upsert` - Save draft (update if exists, create if not) - convenience endpoint
- `PATCH /api/vessel-drafts/:id` - Update existing draft
- `DELETE /api/vessel-drafts/:id` - Delete draft

### Vessel Revisions (Finalized Versions)
- `GET /api/vessel-revisions` - List all vessel revisions
- `GET /api/vessel-revisions/:id` - Get specific revision by ID
- `GET /api/vessel-revisions/by-vessel/:vesselId` - Get all revisions for a specific vessel
- `GET /api/vessel-revisions/next-revision/:vesselId` - Get next revision number for a vessel (R0, R1, R2, etc.)
- `POST /api/vessel-revisions` - Create new revision (requires: vesselId, revision, revisionDate, revisionData)
- `POST /api/vessel-revisions/submit` - Submit revision with automatic sequencing and draft cleanup (requires: vesselId, revisionDate, revisionData)

## Database Schema

Key entities:
- `crew_members` - Personnel information
- `appraisal_results` - Performance evaluations
- `forms` - Appraisal form templates
- `users` - System users
- `rank_groups` - Rank classifications
- `vessel_drafts` - Temporary vessel rank assignments (no date required)
  - `id` - Serial primary key
  - `vesselId` - Text identifier for the vessel
  - `revision` - Revision label (default "R1")
  - `draftData` - JSON string of vessel rank assignments
  - `createdAt`, `updatedAt` - Timestamps
- `vessel_revisions` - Finalized vessel rank assignments (date mandatory)
  - `id` - Serial primary key
  - `vesselId` - Text identifier for the vessel
  - `revision` - Revision label (R0, R1, R2, etc.)
  - `revisionDate` - Mandatory date in dd/mm/yyyy format
  - `revisionData` - JSON string of vessel rank assignments
  - `createdAt`, `updatedAt` - Timestamps

## Vessel Revision System

### Overview
The vessel revision system manages vessel rank assignments with two distinct workflows:
1. **Save Draft** - Temporary saves without date requirements
2. **Submit** - Finalized revisions with automatic sequencing and mandatory dates

### Key Features

#### Automatic Revision Sequencing
- Each vessel maintains its own independent revision counter
- Revisions are automatically numbered: R0 → R1 → R2 → R3...
- The system computes the next revision number based on existing revisions for that specific vessel
- No manual revision numbering required

#### Date Validation
- Submit requires a mandatory date in dd/mm/yyyy format
- Comprehensive validation ensures:
  - Correct format (two digits for day, two for month, four for year)
  - Valid calendar dates (rejects 31/04/2025, 29/02/2023, etc.)
  - Accepts leap years correctly (29/02/2024 is valid)
- Save Draft does not require a date

#### Draft vs Revision Separation
- **Drafts** are temporary saves that can be updated multiple times
- **Revisions** are finalized versions that become part of the permanent record
- When Submit is called, any existing drafts for that vessel are automatically cleaned up

### Workflow Examples

#### Save Draft Workflow
```
1. User makes changes to vessel rank assignments
2. Clicks "Save Draft"
3. POST /api/vessel-drafts/upsert with { vesselId, revision, draftData }
4. System updates existing draft or creates new one
5. Draft saved without requiring a date
```

#### Submit Workflow
```
1. User makes changes to vessel rank assignments
2. Clicks "Submit" and provides date (dd/mm/yyyy)
3. POST /api/vessel-revisions/submit with { vesselId, revisionDate, revisionData }
4. System validates date format and calendar validity
5. System computes next revision number (e.g., R0 if first, R1 if one exists, etc.)
6. System creates finalized revision with auto-assigned number
7. System cleans up any existing drafts for that vessel
8. Returns created revision with metadata
```

### Data Persistence
- All vessel drafts and revisions persist via PersistentFileStorage
- Data is stored in test-data.json and survives application restarts
- Production system would use PostgreSQL database with same schema

### Performance Optimization
- Vessel rank checkbox lookups use Map-based O(1) operations
- Prevents browser freezing during table interactions with large datasets
- Optimized lookup structure: `Map<vesselId, Map<rankId, boolean>>`

## Data Storage

### Current Implementation (Development)
- **Storage Engine**: PersistentFileStorage
- **Storage File**: test-data.json
- **Persistence**: Data persists across application restarts
- **Location**: Root directory of the project
- **Format**: JSON structure matching PostgreSQL schema

### Future Implementation (Production)
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Already defined in shared/schema.ts
- **Migration**: Ready to switch from PersistentFileStorage to PostgreSQL
- **Advantage**: Same schema structure ensures smooth transition

## Deployment

The application is configured for Replit deployment with:
- Automatic workflow management
- Environment variable configuration
- PersistentFileStorage for development persistence
- Production-ready error handling

## Future Roadmap

- [ ] Real-time notifications
- [ ] Bulk import/export functionality
- [ ] Advanced reporting dashboard
- [ ] Mobile application
- [ ] Integration with vessel management systems
- [ ] Multi-language support