# System Architecture

## Overview

The Seafarer Performance Management System follows a modern full-stack JavaScript architecture with a React frontend and Express.js backend, connected to a PostgreSQL database via Drizzle ORM.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (React)                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Modules: Admin | Vessel | Crew | Rest Hours | etc.    ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Components: shadcn/ui | AG Grid | Custom Components    ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  State: TanStack Query (server) | Zustand (client)      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │ HTTP/REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Express.js)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Routes Layer (routes.ts) - 253 API endpoints           ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Storage Interface (IStorage) - Business Logic          ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Database Storage (database.ts) - PostgreSQL via Drizzle││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │ SQL via Drizzle ORM
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
│  52 Tables | Migrations via SQL files | Neon-backed         │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack Details

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool and dev server |
| TailwindCSS | 3.x | Utility-first CSS |
| shadcn/ui | Latest | UI component library |
| AG Grid Enterprise | 32.x | Data grid with advanced features |
| AG Charts Enterprise | 10.x | Charting library |
| TanStack Query | 5.x | Server state management |
| Zustand | 4.x | Client state management |
| React Hook Form | 7.x | Form handling |
| Zod | 3.x | Schema validation |
| Wouter | 3.x | Lightweight routing |
| Lucide React | Latest | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| Drizzle ORM | Latest | Database ORM |
| PostgreSQL | 15+ | Database (Neon-backed on Replit) |
| Zod | 3.x | Request validation |

### Development Tools

| Tool | Purpose |
|------|---------|
| TSX | TypeScript execution for Node.js |
| ESBuild | Fast bundling |
| PostCSS | CSS processing |

## Application Flow

### Server Initialization

```
server/index.ts
    │
    ├── Initialize Express app
    ├── Configure middleware
    ├── Connect to PostgreSQL (database.ts)
    ├── Run migrations (migrationRunner.ts)
    ├── Register routes (routes.ts)
    ├── Setup Vite for development (vite.ts)
    └── Listen on port 5000
```

### Request/Response Lifecycle

```
HTTP Request
    │
    ├── Express middleware (CORS, JSON parsing)
    │
    ├── Route handler (routes.ts)
    │   ├── Request validation (Zod schemas from schema.ts)
    │   ├── Storage interface call (storage.ts)
    │   └── Response formatting
    │
    ├── Storage Layer (IStorage interface)
    │   ├── DatabaseStorage (PostgreSQL via Drizzle)
    │   └── MemStorage (in-memory for testing)
    │
    └── HTTP Response (JSON)
```

## Module Architecture

### Frontend Modules

Each module follows this structure:
```
client/src/modules/{module-name}/
├── {ModuleName}Module.tsx    # Main module component
├── {ModuleName}SideBar.tsx   # Navigation sidebar
├── {Feature}Form.tsx         # Form components
├── {Feature}Table.tsx        # AG Grid tables
├── types.ts                  # TypeScript types
├── utils/                    # Module utilities
└── components/               # Module-specific components
```

### Module List

| Module | Path | Description |
|--------|------|-------------|
| Admin | `modules/admin/` | System configuration, masters, forms |
| Vessel | `modules/vessel/` | Vessel operations, officer matrix, planning |
| Crew Pool | `modules/crew-pool/` | Crew database management |
| Crewing | `modules/crewing/` | Appraisals and evaluations |
| Rest Hours | `modules/rest-hours/` | Work/rest compliance tracking |
| Rotation | `modules/rotation/` | Crew rotation planning |
| Promotions | `modules/promotions/` | Promotion management |
| Recruitment | `modules/recruitment/` | Candidate applications |
| Drugs & Alcohol | `modules/drugs-alcohol/` | D&A testing records |
| Accounts | `modules/accounts/` | Wage and payroll (WIP) |

## State Management

### Server State (TanStack Query)

Used for all data fetched from the API:
```typescript
// Query example
const { data, isLoading } = useQuery({
  queryKey: ['/api/crew-members'],
});

// Mutation example
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/crew-members', data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/crew-members'] }),
});
```

### Client State (Zustand)

Used for UI state that doesn't need server persistence:
```typescript
// stores/restHoursFiltersStore.ts
export const useRestHoursFiltersStore = create((set) => ({
  selectedVessel: null,
  selectedMonth: null,
  setSelectedVessel: (vessel) => set({ selectedVessel: vessel }),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
}));
```

## Database Architecture

### Schema Organization

The database schema is defined in `shared/schema.ts` using Drizzle ORM:

```typescript
// Table definition
export const crewMembers = pgTable("crew_members", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  // ... other columns
});

// Insert schema (for validation)
export const insertCrewMemberSchema = createInsertSchema(crewMembers);

// Types
export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
```

### Migration System

Migrations are stored in `migrations/` as SQL files:
- Format: `NNNN_descriptive_name.sql`
- Executed via `migrationRunner.ts` on server startup
- Tracked in `migrations` table to prevent re-execution

## Storage Interface Pattern

The storage layer uses an interface pattern for flexibility:

```typescript
// IStorage interface (storage.ts)
interface IStorage {
  // Crew Members
  getAllCrewMembers(): Promise<CrewMember[]>;
  getCrewMember(id: string): Promise<CrewMember | undefined>;
  createCrewMember(data: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: string, data: Partial<InsertCrewMember>): Promise<CrewMember>;
  deleteCrewMember(id: string): Promise<void>;
  
  // ... other entity methods
}

// Implementations
class DatabaseStorage implements IStorage { /* PostgreSQL */ }
class MemStorage implements IStorage { /* In-memory for testing */ }
```

## Error Handling

### Backend Error Handling

```typescript
app.get("/api/resource/:id", async (req, res) => {
  try {
    const result = await storage.getResource(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Resource not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error fetching resource:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Frontend Error Handling

```typescript
// Query error handling
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/resource'],
});

if (error) {
  return <ErrorDisplay message={error.message} />;
}

// Mutation error handling
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/resource', data),
  onError: (error) => {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  },
});
```

## Security Considerations

### Current Implementation
- No authentication system currently implemented
- All API endpoints are publicly accessible
- Input validation via Zod schemas
- SQL injection prevention via Drizzle ORM parameterized queries

### Recommended Additions
- Implement Replit Auth or similar authentication
- Add role-based access control (RBAC)
- Rate limiting for API endpoints
- CORS configuration for production

## Performance Optimizations

### Frontend
- Route-level code splitting with React.lazy()
- Memoization with useMemo and React.memo
- Efficient AG Grid configurations
- TanStack Query caching (5-minute default)

### Backend
- Connection pooling via Drizzle/Neon
- Indexed database queries
- Efficient JSON storage for complex nested data
- Batch operations for bulk updates

## External Integrations

### SAIL ERP API
External master data fetched from SAIL ERP:
- Base URL: `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/`
- Masters: Nationalities, Vessels, Vessel Types, Ports, Languages, Countries

### AG Grid Enterprise
- License required for enterprise features
- Set via `VITE_AG_GRID_LICENSE_KEY` environment variable
