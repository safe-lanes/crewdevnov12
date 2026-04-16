# New Module Development Guide

> **For AI Agents & Developers**: Follow this file **exactly** when building any new module.
> This guide exists because the original crewing module was built with patterns that caused
> serious production issues. Every rule below prevents a real problem we encountered.
>
> **Reference**: See `standard architecture.md` for full system architecture details.

---

## 🚫 THE 25 DON'Ts — Mistakes That Happened Before, Never Again

### Backend DON'Ts

| # | ❌ DON'T | Why It Failed In Crewing | ✅ DO Instead |
|---|---|---|---|
| 1 | **Add code to `server/storage.ts`** | Grew to 5,300+ lines, untestable, unreadable monolith | Create `server/v2/<module>/repositories/<entity>Repository.ts` |
| 2 | **Add code to `server/database.ts`** | 1,700+ line god class mixing queries + business logic | Create separate repository + service files |
| 3 | **Add routes inline in `server/routes.ts`** | 200-line inline handlers with embedded business logic | Create `server/v2/<module>/routes.ts` with Express Router, mount via `app.use()` |
| 4 | **Add tables/types to `shared/schema.ts`** | 1,760+ line monolith, 60+ `any` type aliases, all modules coupled | Create `shared/v2/<module>/schema.ts` and `shared/v2/<module>/types.ts` |
| 5 | **Put business logic in controllers** | Controllers became 500+ lines doing calculations, validations, transformations | Controllers only: parse request → call service → send response |
| 6 | **Put business logic in repositories** | Repositories became decision engines instead of data access layers | Repositories only: Drizzle ORM queries (select, insert, update, delete) |
| 7 | **Put Drizzle queries in services** | Services became tightly coupled to database implementation | Services call repositories, never touch `db` or `getDb()` directly |
| 8 | **Import `pool` or `db` directly** | Broke multi-tenant isolation | Always use `getDb()` from `server/v2/db.ts` in repositories |
| 9 | **Duplicate functions across files** | `isTankerVesselType()`, `isOfficerRank()`, `calculateExperience()` all existed in BOTH `storage.ts` AND `database.ts` | Extract shared logic to `shared/` utilities. Write once, import everywhere |
| 10 | **Use `any` type** | 60+ `type X = any` aliases masked real bugs, TypeScript couldn't catch errors | Define proper interfaces in `shared/v2/<module>/types.ts` |
| 11 | **Store arrays as JSON strings in `text` columns** | `documents`, `visas`, `licenses` stored as JSON text — can't query, can't index, can't enforce integrity | Create normalized relational tables with foreign keys |
| 12 | **Hardcode entity mappings in code** | Vessel name→UUID mappings hardcoded in `storage.ts` | All lookups come from database (Master Data) or external APIs |
| 13 | **Skip Zod validation on request body** | Invalid data reached the database causing runtime crashes | Validate every POST/PATCH/PUT body with Zod in the controller |
| 14 | **Use inconsistent error responses** | Some routes returned `{error}`, others `{message}`, others plain strings | Standard format: `res.status(4xx/5xx).json({ error: "message" })` |
| 15 | **Write files over 500 lines** | `storage.ts` (5,300), `database.ts` (1,700), `routes.ts` (600) — impossible to review | Split by entity: one controller, service, repository per entity |

### Frontend DON'Ts

| # | ❌ DON'T | Why It Failed In Crewing | ✅ DO Instead |
|---|---|---|---|
| 16 | **Create giant component files** | `CrewInfoForm_v2.tsx` = 384KB, `VesselModule_v2.tsx` = 168KB — impossible to maintain | Max 500 lines per `.tsx` file. Break into sub-components |
| 17 | **Manually add `x-tenant-id` or `Authorization` headers** | Inconsistent header injection, some requests missed headers | `tenantFetch.ts` auto-injects both headers on ALL `/api/*` requests |
| 18 | **Install new UI libraries** | Multiple UI systems cause inconsistent look, bundle bloat | Use existing shadcn/ui components from `@/components/ui/` |
| 19 | **Put pages outside `modules/` directory** | Pages scattered across `pages/`, `components/`, `modules/` — no clear ownership | Every feature lives in `client/src/modules/<module>/` |
| 20 | **Skip `<ProtectedRoute>` wrapper** | Unprotected routes visible to unauthorized users | Always wrap with `<ProtectedRoute menuName="...">` in `App.tsx` |
| 21 | **Use relative imports for shared code** | `../../../shared/schema` — fragile, hard to refactor | Use `@shared/` and `@/` path aliases always |
| 22 | **Put module-specific hooks in `hooks/` root** | `client/src/hooks/` became a dumping ground with 21+ files | Module hooks go in `client/src/modules/<module>/hooks/` |
| 23 | **Put Zustand stores in `store/`** | Both `store/` AND `stores/` directories exist — confusing | Use `client/src/stores/` (plural) for global stores only |
| 24 | **Fetch data without TanStack Query** | Raw `fetch()` calls without caching, deduplication, or error handling | Use `useQuery()` / `useMutation()` from TanStack Query v5 |
| 25 | **Skip lazy loading for module routes** | All modules loaded upfront — slow initial page load | Use `lazy(() => import("./modules/<module>/index"))` in `App.tsx` |

---

## ✅ THE COMPLETE DO's — Step-by-Step New Module Blueprint

### Step 1: Plan Your Module Structure

Before writing any code, create this folder layout:

```
shared/v2/<module>/
├── schema.ts              # Drizzle table definitions + Zod insert schemas
└── types.ts               # TypeScript interfaces (API request/response types)

server/v2/<module>/
├── index.ts               # Barrel exports
├── routes.ts              # Express Router
├── controllers/
│   ├── index.ts           # Re-export all controllers
│   └── <entity>Controller.ts
├── services/
│   ├── index.ts           # Re-export all services
│   └── <entity>Service.ts
└── repositories/
    ├── index.ts           # Re-export all repositories
    └── <entity>Repository.ts

client/src/modules/<module>/
├── index.tsx              # Module router (lazy-loaded entry)
├── <Module>Module.tsx     # Main page component
├── <Module>SideBar.tsx    # Sidebar (if needed)
├── api/
│   └── <module>Api.ts     # API client functions
├── hooks/
│   └── use<Module>.ts     # Data fetching hooks
└── components/
    └── <Component>.tsx    # Module-specific components
```

---

### Step 2: Define Schema (shared)

**File**: `shared/v2/<module>/schema.ts`

```typescript
import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ✅ DO: Use UUID for identifiers
// ✅ DO: Always include created_at and updated_at
// ✅ DO: Use proper column types (not JSON strings for arrays)
export const myEntities = pgTable("my_entities_v2", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ✅ DO: Omit auto-generated fields from insert schema
export const insertMyEntitySchema = createInsertSchema(myEntities).omit({
  id: true,
  uuid: true,
  createdAt: true,
  updatedAt: true,
});

// ✅ DO: Create update schema (partial of insert)
export const updateMyEntitySchema = insertMyEntitySchema.partial();

// ✅ DO: Export types from schema
export type MyEntity = typeof myEntities.$inferSelect;
export type InsertMyEntity = z.infer<typeof insertMyEntitySchema>;
export type UpdateMyEntity = z.infer<typeof updateMyEntitySchema>;
```

---

### Step 3: Define Types (shared)

**File**: `shared/v2/<module>/types.ts`

```typescript
// ✅ DO: Define API response types explicitly — never use `any`
export interface MyEntityResponse {
  uuid: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ✅ DO: Define create/update DTOs
export interface CreateMyEntityDto {
  name: string;
  description?: string;
}

export interface UpdateMyEntityDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// ✅ DO: Define list query params
export interface MyEntityFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
```

---

### Step 4: Create Migration

**File**: `migrations/NNNN_create_my_entities_v2.sql`

```sql
-- ✅ DO: Use IF NOT EXISTS for safety
-- ✅ DO: Include indexes on frequently queried columns
-- ✅ DO: Add UUID unique constraint

CREATE TABLE IF NOT EXISTS my_entities_v2 (
  id SERIAL PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ✅ DO: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_my_entities_v2_is_active ON my_entities_v2(is_active);
CREATE INDEX IF NOT EXISTS idx_my_entities_v2_name ON my_entities_v2(name);
```

> ❌ **DON'T**: Never modify an existing migration file. Create a new one.

---

### Step 5: Build Repository (data access only)

**File**: `server/v2/<module>/repositories/<entity>Repository.ts`

```typescript
import { eq, and, like, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { myEntities } from "@shared/v2/<module>/schema";
import type { InsertMyEntity, UpdateMyEntity, MyEntity } from "@shared/v2/<module>/schema";

// ✅ DO: Repository = pure data access, no business logic
// ✅ DO: Use getDb() — never import pool/db directly
// ✅ DO: Return typed results — never return `any`

export const myEntityRepository = {
  async getAll(filters?: { isActive?: boolean; search?: string }): Promise<MyEntity[]> {
    const db = getDb();
    let query = db.select().from(myEntities);

    const conditions = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(myEntities.isActive, filters.isActive));
    }
    if (filters?.search) {
      conditions.push(like(myEntities.name, `%${filters.search}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(myEntities.createdAt));
  },

  async getByUuid(uuid: string): Promise<MyEntity | undefined> {
    const db = getDb();
    const [result] = await db.select().from(myEntities).where(eq(myEntities.uuid, uuid));
    return result;
  },

  async create(data: InsertMyEntity): Promise<MyEntity> {
    const db = getDb();
    const [created] = await db.insert(myEntities).values(data).returning();
    return created;
  },

  async update(uuid: string, data: UpdateMyEntity): Promise<MyEntity | undefined> {
    const db = getDb();
    const [updated] = await db
      .update(myEntities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(myEntities.uuid, uuid))
      .returning();
    return updated;
  },

  async delete(uuid: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(myEntities).where(eq(myEntities.uuid, uuid));
    return (result.rowCount ?? 0) > 0;
  },
};
```

---

### Step 6: Build Service (business logic only)

**File**: `server/v2/<module>/services/<entity>Service.ts`

```typescript
import { myEntityRepository } from "../repositories/<entity>Repository";
import type { InsertMyEntity, UpdateMyEntity, MyEntity } from "@shared/v2/<module>/schema";

// ✅ DO: Service = business logic, orchestration, validation
// ❌ DON'T: Import getDb() here — that's the repository's job
// ❌ DON'T: Import req/res here — that's the controller's job

export const myEntityService = {
  async getAll(filters?: { isActive?: boolean; search?: string }): Promise<MyEntity[]> {
    return myEntityRepository.getAll(filters);
  },

  async getByUuid(uuid: string): Promise<MyEntity> {
    const entity = await myEntityRepository.getByUuid(uuid);
    if (!entity) {
      throw new NotFoundError(`Entity with UUID ${uuid} not found`);
    }
    return entity;
  },

  async create(data: InsertMyEntity): Promise<MyEntity> {
    // ✅ DO: Put business validations here
    // Example: check for duplicates, enforce business rules
    return myEntityRepository.create(data);
  },

  async update(uuid: string, data: UpdateMyEntity): Promise<MyEntity> {
    const existing = await myEntityRepository.getByUuid(uuid);
    if (!existing) {
      throw new NotFoundError(`Entity with UUID ${uuid} not found`);
    }

    // ✅ DO: Put update business rules here
    const updated = await myEntityRepository.update(uuid, data);
    if (!updated) {
      throw new Error("Update failed unexpectedly");
    }
    return updated;
  },

  async delete(uuid: string): Promise<void> {
    const existing = await myEntityRepository.getByUuid(uuid);
    if (!existing) {
      throw new NotFoundError(`Entity with UUID ${uuid} not found`);
    }
    await myEntityRepository.delete(uuid);
  },
};

// ✅ DO: Define custom error classes for business errors
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
```

---

### Step 7: Build Controller (HTTP handling only)

**File**: `server/v2/<module>/controllers/<entity>Controller.ts`

```typescript
import { Request, Response } from "express";
import { myEntityService, NotFoundError } from "../services/<entity>Service";
import { insertMyEntitySchema, updateMyEntitySchema } from "@shared/v2/<module>/schema";

// ✅ DO: Controller = parse HTTP request + call service + send response
// ❌ DON'T: Put business logic here
// ❌ DON'T: Import repository or getDb() here

export const myEntityController = {
  async getAll(req: Request, res: Response) {
    try {
      const filters = {
        isActive: req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined,
        search: req.query.search as string | undefined,
      };
      const entities = await myEntityService.getAll(filters);
      res.json(entities);
    } catch (error) {
      console.error("Failed to fetch entities:", error);
      res.status(500).json({ error: "Failed to fetch entities" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const entity = await myEntityService.getByUuid(req.params.uuid);
      res.json(entity);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Failed to fetch entity:", error);
      res.status(500).json({ error: "Failed to fetch entity" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      // ✅ DO: Validate request body with Zod
      const parsed = insertMyEntitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.issues,
        });
      }
      const created = await myEntityService.create(parsed.data);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create entity:", error);
      res.status(500).json({ error: "Failed to create entity" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      // ✅ DO: Validate with partial schema for updates
      const parsed = updateMyEntitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.issues,
        });
      }
      const updated = await myEntityService.update(req.params.uuid, parsed.data);
      res.json(updated);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Failed to update entity:", error);
      res.status(500).json({ error: "Failed to update entity" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await myEntityService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Failed to delete entity:", error);
      res.status(500).json({ error: "Failed to delete entity" });
    }
  },
};
```

---

### Step 8: Define Routes

**File**: `server/v2/<module>/routes.ts`

```typescript
import { Router } from "express";
import { myEntityController } from "./controllers/<entity>Controller";

const router = Router();

// ✅ DO: Keep routes clean — no inline logic
// ✅ DO: Use RESTful naming conventions
router.get("/entities", myEntityController.getAll);
router.get("/entities/:uuid", myEntityController.getByUuid);
router.post("/entities", myEntityController.create);
router.patch("/entities/:uuid", myEntityController.update);
router.delete("/entities/:uuid", myEntityController.delete);

export default router;
```

---

### Step 9: Create Barrel Exports

**File**: `server/v2/<module>/index.ts`

```typescript
export { default as myModuleV2Routes } from "./routes";
export * from "./controllers";
export * from "./services";
export * from "./repositories";
```

---

### Step 10: Mount Routes

**In `server/routes.ts`** — add ONE line:

```typescript
import myModuleV2Routes from "./v2/<module>/routes";

// Inside registerRoutes():
app.use("/api/v2/<module>", myModuleV2Routes);
```

> ❌ **DON'T**: Add inline route handlers here. Only mount the module's router.

---

### Step 11: Build Frontend API Client

**File**: `client/src/modules/<module>/api/<module>Api.ts`

```typescript
import { apiRequest } from "@/lib/queryClient";
import type { MyEntityResponse, CreateMyEntityDto, UpdateMyEntityDto } from "@shared/v2/<module>/types";

const BASE = "/api/v2/<module>";

// ✅ DO: Use apiRequest() — it auto-adds auth + tenant headers
// ❌ DON'T: Use raw fetch() or add headers manually

export const myModuleApi = {
  async getAll(filters?: { search?: string; isActive?: boolean }): Promise<MyEntityResponse[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));

    const query = params.toString();
    const res = await apiRequest("GET", `${BASE}/entities${query ? `?${query}` : ""}`);
    return res.json();
  },

  async getByUuid(uuid: string): Promise<MyEntityResponse> {
    const res = await apiRequest("GET", `${BASE}/entities/${uuid}`);
    return res.json();
  },

  async create(data: CreateMyEntityDto): Promise<MyEntityResponse> {
    const res = await apiRequest("POST", `${BASE}/entities`, data);
    return res.json();
  },

  async update(uuid: string, data: UpdateMyEntityDto): Promise<MyEntityResponse> {
    const res = await apiRequest("PATCH", `${BASE}/entities/${uuid}`, data);
    return res.json();
  },

  async delete(uuid: string): Promise<void> {
    await apiRequest("DELETE", `${BASE}/entities/${uuid}`);
  },
};
```

---

### Step 12: Build Frontend Hook

**File**: `client/src/modules/<module>/hooks/use<Module>.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { myModuleApi } from "../api/<module>Api";
import { useToast } from "@/hooks/use-toast";
import type { CreateMyEntityDto, UpdateMyEntityDto } from "@shared/v2/<module>/types";

const QUERY_KEY = ["my-module-entities"];

// ✅ DO: Use TanStack Query for all server state
// ✅ DO: Invalidate queries after mutations

export function useMyEntities(filters?: { search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: [...QUERY_KEY, filters],
    queryFn: () => myModuleApi.getAll(filters),
  });
}

export function useMyEntity(uuid: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, uuid],
    queryFn: () => myModuleApi.getByUuid(uuid),
    enabled: !!uuid,
  });
}

export function useCreateMyEntity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateMyEntityDto) => myModuleApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Success", description: "Entity created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateMyEntity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: UpdateMyEntityDto }) =>
      myModuleApi.update(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Success", description: "Entity updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteMyEntity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (uuid: string) => myModuleApi.delete(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Success", description: "Entity deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
```

---

### Step 13: Build Frontend Module Entry

**File**: `client/src/modules/<module>/index.tsx`

```tsx
import { MyModulePage } from "./MyModuleModule";

export default function MyModuleRouter() {
  return <MyModulePage />;
}
```

---

### Step 14: Register Route in App.tsx

```tsx
// Add lazy import at the top:
const MyModule = lazy(() => import("./modules/<module>/index"));

// Add route inside <Switch>:
<Route path="/my-module">
  <ProtectedRoute menuName="My Module">
    <MyModule />
  </ProtectedRoute>
</Route>
```

---

## 📏 Production Quality Gates

### File Size Limits

| File Type | Max Lines | What To Do If Exceeded |
|---|---|---|
| Controller | **300** | Split by entity: `userController.ts`, `roleController.ts` |
| Service | **500** | Extract helpers to utility files |
| Repository | **300** | Split by entity |
| Component (`.tsx`) | **500** | Break into sub-components in `components/` dir |
| Schema | **300** | One schema file per module |
| API Client | **200** | One file per module |
| Hook | **300** | Split into one hook per concern |
| Routes | **200** | No inline logic — just route definitions |

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| DB table name | `snake_case_v2` | `crew_documents_v2` |
| DB column name | `snake_case` | `created_at`, `is_active` |
| Schema variable | `camelCase` | `crewDocumentsV2` |
| Repository file | `<entity>Repository.ts` | `crewDocumentsRepository.ts` |
| Service file | `<entity>Service.ts` | `crewDocumentsService.ts` |
| Controller file | `<entity>Controller.ts` | `crewDocumentsController.ts` |
| API route | `/api/v2/<module>/<entities>` | `/api/v2/crew-pool/documents` |
| Frontend module dir | `kebab-case` | `crew-pool`, `rest-hours` |
| React component | `PascalCase` | `CrewDocumentsList.tsx` |
| Custom hook | `use<Name>` | `useCrewDocuments.ts` |
| Zustand store | `<name>Store.ts` | `filtersStore.ts` |
| Types file | `types.ts` | `shared/v2/crew-pool/types.ts` |

### Error Response Standard

```typescript
// ✅ ALWAYS return this shape from all V2 API endpoints:

// Success (list):
res.json(items);                                    // 200

// Success (single):
res.json(item);                                     // 200

// Success (created):
res.status(201).json(created);                      // 201

// Success (deleted):
res.status(204).send();                             // 204

// Validation error:
res.status(400).json({                              // 400
  error: "Validation failed",
  details: zodError.issues,
});

// Not found:
res.status(404).json({ error: "Entity not found" }); // 404

// Conflict (duplicate):
res.status(409).json({ error: "Entity already exists" }); // 409

// Server error:
res.status(500).json({ error: "Failed to <verb> <entity>" }); // 500
```

---

## 🔍 Quick Self-Check Before Submitting

Run through this checklist. If any item is ❌, fix it before proceeding:

```
BACKEND
□ All new code is under server/v2/<module>/ ?
□ Nothing added to storage.ts, database.ts, or shared/schema.ts ?
□ Every repository uses getDb() from server/v2/db.ts ?
□ Controllers have ZERO business logic ?
□ Services have ZERO req/res references ?
□ Repositories have ZERO business rules ?
□ All request bodies validated with Zod ?
□ No file exceeds 500 lines ?
□ No `any` types used ?
□ Migration file created (not modified existing) ?
□ Routes mounted in server/routes.ts via app.use() ?

FRONTEND
□ Module lives in client/src/modules/<module>/ ?
□ API client uses apiRequest() from @/lib/queryClient ?
□ No manual header injection (no x-tenant-id or Authorization) ?
□ Data fetching uses TanStack Query (useQuery/useMutation) ?
□ Forms use React Hook Form + Zod ?
□ UI uses shadcn/ui components only ?
□ Route registered in App.tsx with <ProtectedRoute> ?
□ Module entry is lazy-loaded ?
□ No component file exceeds 500 lines ?
□ Types imported from @shared/v2/<module>/types ?

SHARED
□ Schema in shared/v2/<module>/schema.ts (not shared/schema.ts) ?
□ Types in shared/v2/<module>/types.ts (not inline any) ?
□ Tables use UUID identifiers (not serial integers) ?
□ Tables have created_at and updated_at columns ?
□ No JSON-stringified arrays in text columns ?
□ Related data in separate normalized tables ?
```

---

## 🔒 Security Guidelines

### Token Authentication — How It Works

This system uses **JWT (JSON Web Token)** authentication. Every API request (except exempt paths) must carry a valid token.

#### JWT Token Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT (Browser)                                                   │
│                                                                     │
│  1. User logs in via parent SAIL Audits app                        │
│  2. Parent app sends JWT token via redirect/postMessage             │
│  3. Token stored encrypted in sessionStorage ("credentials" key)    │
│     → Encrypted using AES via crypto-js (VITE_CLIENT_ENCRYPTION_KEY)│
│  4. tenantFetch.ts patches window.fetch() globally                  │
│  5. Every /api/* request auto-gets:                                 │
│     • Authorization: Bearer <decrypted-token>                       │
│     • x-tenant-id: <encrypted-tenant-id-from-localStorage>         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP Request
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVER (Express Middleware Chain)                                   │
│                                                                     │
│  1. tenantMiddleware: Reads x-tenant-id header                      │
│     → Falls back to extracting domain from JWT if no header         │
│     → Resolves tenant via tenantConnectionManager                   │
│     → Stores DB connection in AsyncLocalStorage                     │
│                                                                     │
│  2. authMiddleware: Extracts token from:                            │
│     → Authorization: Bearer <token> (primary)                       │
│     → ?sail=<token> query param (file download routes only)         │
│     → jwt.verify(token, JWT_SECRET) — validates + decodes           │
│     → Sets req.user = { id, domain, userType, iat, exp }           │
│     → Verifies tenant binding (JWT domain must match tenant ID)     │
│                                                                     │
│  3. Route handler processes authenticated request                   │
└─────────────────────────────────────────────────────────────────────┘
```

#### JWT Payload Structure

```typescript
interface JwtPayload {
  id: number;        // User ID from parent system
  domain: string;    // Tenant domain (e.g., "company.sail.com")
  userType: string;  // User role/type
  iat?: number;      // Issued at (auto-set by JWT)
  exp?: number;      // Expiration time (auto-set by JWT)
}
```

#### Token Extraction Priority

```typescript
// 1. Authorization header (primary — all API calls)
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// 2. Query parameter (secondary — file downloads only)
/api/v2/crew-pool/documents/download?sail=eyJhbGciOiJIUzI1NiIs...
// Only works for paths containing: /download, /attachment, /document, /file
```

### Auth-Exempt Paths

These paths skip authentication entirely:

```typescript
// server/middleware/exemptPaths.ts
const EXEMPT_PATHS = ["/api/v2/tenant/init", "/api/health"];

// Also exempt: ALL paths NOT starting with /api/v2/ (static files, etc.)
```

> ❌ **DON'T**: Add new paths to exemptPaths unless absolutely required (e.g., health checks)
> ✅ **DO**: All V2 API endpoints are protected by default — no extra code needed

### Security Rules for New Modules

| # | Rule | Details |
|---|---|---|
| 1 | **Never handle tokens manually** | `tenantFetch.ts` (client) and `authMiddleware.ts` (server) handle everything automatically |
| 2 | **Never store tokens in localStorage** | JWT goes in `sessionStorage` (encrypted). Only `tenantId` uses `localStorage` |
| 3 | **Never expose JWT_SECRET in code** | It comes from `process.env.JWT_SECRET` — set in `.env` or hosting provider |
| 4 | **Never skip auth for V2 routes** | All `/api/v2/*` routes are protected by default. You don't need to add auth checks manually |
| 5 | **Handle 401 on frontend** | `tenantFetch.ts` auto-redirects to login on 401 responses — no manual handling needed |
| 6 | **Validate Zod on request body** | Auth ensures WHO is calling; Zod ensures WHAT they're sending is valid |
| 7 | **Never trust client data** | Always validate, sanitize, and type-check in the controller even if the frontend validates too |
| 8 | **Use `req.user` for audit trails** | Access `req.user.id`, `req.user.domain` for `createdByUuid` / `updatedByUuid` fields |
| 9 | **File downloads use query token** | For file endpoints, support `?sail=<token>` query param for browser direct downloads |
| 10 | **Dev bypass is dev-only** | `AUTH_BYPASS=true` works only when `NODE_ENV=development`. Production ALWAYS enforces auth |

### Error Responses for Auth Failures

```typescript
// These are returned AUTOMATICALLY by the middleware — you never need to handle them:

// Missing token:
401 { error: "unauthorized", message: "Missing authorization token" }

// Expired token:
401 { error: "token_expired", message: "Authorization token has expired" }

// Invalid token:
401 { error: "invalid_token", message: "Invalid authorization token" }

// Token domain doesn't match tenant:
403 { error: "tenant_mismatch", message: "Authorization token does not match the requested tenant" }

// Tenant not found:
403 { error: "invalid_tenant", message: "The provided tenant identifier is not valid." }

// Tenant inactive:
403 { error: "tenant_inactive", message: "Tenant account is inactive" }

// Tenant DB down:
503 { error: "Tenant database unavailable", message: "..." }
```

---

## 🏢 Multi-Tenant Architecture — Built In From Day 1

### How Multi-Tenancy Works

```
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│   Tenant A (Client)  │    │   Tenant B (Client)  │    │   Tenant C (Client)  │
│   x-tenant-id: AAA   │    │   x-tenant-id: BBB   │    │   x-tenant-id: CCC   │
└──────────┬───────────┘    └──────────┬───────────┘    └──────────┬───────────┘
           │                           │                           │
           └───────────────────────────┼───────────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │  Express Server  │
                              │  (single app)    │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │tenantMiddleware  │
                              │ reads x-tenant-id│
                              │ resolves tenant  │
                              │ via master DB    │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┬┴────────────────────┐
                    │                  │                      │
          ┌─────────▼──────┐  ┌───────▼────────┐  ┌─────────▼──────┐
          │ Tenant A DB    │  │ Tenant B DB    │  │ Tenant C DB    │
          │ (PostgreSQL)   │  │ (PostgreSQL)   │  │ (PostgreSQL)   │
          └────────────────┘  └────────────────┘  └────────────────┘
```

### The Tenant Context Flow (Server-Side)

```typescript
// 1. tenantMiddleware reads the x-tenant-id header
const rawTenantId = req.headers["x-tenant-id"];

// 2. Validates the tenant ID against master database
await tenantConnectionManager.validateTuid(tenantId);

// 3. Runs the entire request inside AsyncLocalStorage context
await tenantConnectionManager.runInTenantContext(tenantId, () => {
  // All code inside here has access to the correct tenant DB
  next(); // Express route handler runs within this context
});

// 4. In your repository, getDb() automatically returns the right tenant's DB
import { getDb } from "../../db";
const db = getDb(); // ← Returns tenant-specific Drizzle instance
```

### Multi-Tenant Rules for New Modules

| # | ✅ DO | ❌ DON'T |
|---|---|---|
| 1 | Use `getDb()` from `server/v2/db.ts` in every repository | Import `pool` or `db` from `server/db.ts` directly |
| 2 | Trust that `getDb()` resolves the correct tenant automatically | Try to resolve tenant manually in your code |
| 3 | Access tenant info via `req.tenantId` (set by middleware) | Read `x-tenant-id` header manually |
| 4 | Let `tenantFetch.ts` inject the `x-tenant-id` header on frontend | Manually add `x-tenant-id` to fetch calls |
| 5 | Test with multiple tenants in development | Assume single-tenant mode will always work |
| 6 | Use tenant-scoped queries (your data is already isolated by DB) | Add `WHERE tenant_id = ?` filters (tenant isolation is at DB level, not row level) |

### Key Files You Must NOT Touch

| File | Purpose | Why Not Touch |
|---|---|---|
| `server/utils/tenantConnectionManager.ts` | Master tenant resolution + DB pool management | Core infrastructure — changes here break all tenants |
| `server/middleware/tenantMiddleware.ts` | Reads header, validates, sets AsyncLocalStorage context | Middleware is already called for all V2 routes |
| `server/v2/db.ts` | `getDb()` and `getCurrentTenantDb()` | Just import and use `getDb()` — never modify |
| `client/src/lib/tenantFetch.ts` | Auto-injects `x-tenant-id` into all `/api/*` fetch calls | Already works for all routes — nothing to add |
| `client/src/lib/tenantStorage.ts` | Encrypted tenant ID in `localStorage` | Already handles get/set/clear — just import |

### Tenant Init Flow (Client-Side)

```typescript
// This happens AUTOMATICALLY on app startup in App.tsx via useTenantInit() hook:

// 1. Check if tenant is cached in localStorage
const cachedTenantId = getTenantId();

// 2. If not cached, call tenant init API
const response = await fetch("/api/v2/tenant/init", {
  method: "POST",
  body: JSON.stringify({ domain: window.location.hostname }),
});
const { tenantId } = await response.json();

// 3. Store tenant ID (encrypted) in localStorage
setTenantId(tenantId);

// 4. All subsequent API calls auto-include x-tenant-id header
// → tenantFetch.ts handles this globally
```

> **You don't need to do anything** — multi-tenancy is built into the middleware chain.
> Just use `getDb()` in repositories and `apiRequest()` on the frontend.

---

## 📋 Standard Table Columns — Mandatory for Every Table

### The `auditColumns` Pattern

Every V2 table **MUST** include the standard audit columns. Import and spread the pre-defined `auditColumns` object:

```typescript
// shared/v2/crew-pool/schema.ts — THIS IS THE SOURCE OF TRUTH
export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};
```

### Table Column Blueprint

Every new table MUST have these columns at minimum:

```typescript
export const myEntitiesV2 = pgTable("my_entities_v2", {
  // ═══════════════════════════════════════════
  // MANDATORY: Primary Key
  // ═══════════════════════════════════════════
  id: serial("id").primaryKey(),

  // ═══════════════════════════════════════════
  // MANDATORY: UUID (public-facing identifier)
  // ═══════════════════════════════════════════
  uuid: text("uuid").notNull().unique(),               // or entityUuid like "crew_uuid"

  // ═══════════════════════════════════════════
  // YOUR BUSINESS COLUMNS GO HERE
  // ═══════════════════════════════════════════
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  // ... more domain-specific columns

  // ═══════════════════════════════════════════
  // MANDATORY: Audit Columns (always last, spread)
  // ═══════════════════════════════════════════
  ...auditColumns,
});
```

### Column-by-Column Breakdown

| Column | Type | Purpose | Required? |
|---|---|---|---|
| `id` | `serial` | Internal auto-increment PK (never exposed to API) | ✅ Always |
| `uuid` / `<entity>_uuid` | `text` | Public identifier for API URLs and cross-references | ✅ Always |
| `created_at` | `timestamp` | When the row was created | ✅ Always (via auditColumns) |
| `updated_at` | `timestamp` | When the row was last modified | ✅ Always (via auditColumns) |
| `created_by_uuid` | `text` | UUID of the user who created the record | ✅ Always (via auditColumns) |
| `updated_by_uuid` | `text` | UUID of the user who last modified the record | ✅ Always (via auditColumns) |
| `is_deleted` | `boolean` | Soft delete flag (never hard-delete production data) | ✅ Always (via auditColumns) |
| `is_sync` | `boolean` | Sync status with external systems | ✅ Always (via auditColumns) |
| `is_active` | `boolean` | Business-level active/inactive status | ⚡ When applicable |
| `sort_order` | `integer` | Display order for user-sortable lists | ⚡ When applicable |

### Setting Audit Fields in Repository

```typescript
// In your repository — update audit columns on every write:

async create(data: InsertMyEntity, userUuid?: string): Promise<MyEntity> {
  const db = getDb();
  const [created] = await db.insert(myEntities).values({
    ...data,
    createdByUuid: userUuid,     // ✅ Track who created
    updatedByUuid: userUuid,     // ✅ Same user on creation
  }).returning();
  return created;
},

async update(uuid: string, data: UpdateMyEntity, userUuid?: string): Promise<MyEntity | undefined> {
  const db = getDb();
  const [updated] = await db
    .update(myEntities)
    .set({
      ...data,
      updatedAt: new Date(),       // ✅ Always refresh timestamp
      updatedByUuid: userUuid,     // ✅ Track who modified
    })
    .where(eq(myEntities.uuid, uuid))
    .returning();
  return updated;
},

// ✅ Soft delete — never hard delete in production
async softDelete(uuid: string, userUuid?: string): Promise<void> {
  const db = getDb();
  await db
    .update(myEntities)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
      updatedByUuid: userUuid,
    })
    .where(eq(myEntities.uuid, uuid));
},
```

### Passing User Context from Controller → Service → Repository

```typescript
// Controller: extract user from req.user (set by authMiddleware)
async create(req: Request, res: Response) {
  const parsed = insertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ... });

  const userUuid = req.user?.id?.toString();  // ✅ From JWT payload
  const created = await myService.create(parsed.data, userUuid);
  res.status(201).json(created);
},

// Service: pass userUuid through to repository
async create(data: InsertMyEntity, userUuid?: string): Promise<MyEntity> {
  // business logic...
  return myRepository.create(data, userUuid);
},
```

### SQL Migration Standard Columns

```sql
CREATE TABLE IF NOT EXISTS my_entities_v2 (
  -- Primary key (internal only)
  id SERIAL PRIMARY KEY,

  -- UUID (public identifier)
  uuid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,

  -- Business columns
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- MANDATORY audit columns
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- MANDATORY indexes
CREATE INDEX IF NOT EXISTS idx_my_entities_v2_uuid ON my_entities_v2(uuid);
CREATE INDEX IF NOT EXISTS idx_my_entities_v2_is_deleted ON my_entities_v2(is_deleted);
```

---

## 🌐 RESTful API Standards

### HTTP Methods & Their Meaning

| Method | Purpose | Request Body | Response Body | Status Code |
|---|---|---|---|---|
| `GET` | Read / List resources | None | JSON array or object | `200 OK` |
| `POST` | Create a new resource | JSON object | Created resource | `201 Created` |
| `PATCH` | Partial update of a resource | Partial JSON object | Updated resource | `200 OK` |
| `PUT` | Full replace of a resource | Complete JSON object | Updated resource | `200 OK` |
| `DELETE` | Remove a resource (soft delete) | None | Empty | `204 No Content` |

### URL Structure Convention

```
BASE: /api/v2/<module>

# Resource operations:
GET    /api/v2/<module>/<entities>                        → List all
GET    /api/v2/<module>/<entities>/:uuid                  → Get one by UUID
POST   /api/v2/<module>/<entities>                        → Create new
PATCH  /api/v2/<module>/<entities>/:uuid                  → Partial update
PUT    /api/v2/<module>/<entities>/:uuid                  → Full replace
DELETE /api/v2/<module>/<entities>/:uuid                  → Soft delete

# Nested resources:
GET    /api/v2/<module>/<parent>/:parentUuid/<children>   → List children
POST   /api/v2/<module>/<parent>/:parentUuid/<children>   → Create child
PATCH  /api/v2/<module>/<children>/:childUuid             → Update child
DELETE /api/v2/<module>/<children>/:childUuid             → Delete child

# Special actions (use verbs only when REST doesn't fit):
POST   /api/v2/<module>/<entities>/:uuid/archive          → Archive
POST   /api/v2/<module>/<entities>/:uuid/unarchive        → Unarchive
POST   /api/v2/<module>/<entities>/bulk                   → Bulk create
PATCH  /api/v2/<module>/<entities>/bulk                   → Bulk update
```

### URL Naming Rules

| ✅ DO | ❌ DON'T |
|---|---|
| Use **plural nouns**: `/entities`, `/documents` | Use verbs: `/getEntities`, `/createEntity` |
| Use **kebab-case**: `/crew-pool`, `/rest-hours` | Use camelCase: `/crewPool`, `/restHours` |
| Use **UUID** in URLs: `/entities/:uuid` | Use integer IDs: `/entities/:id` |
| Use query params for filtering: `?status=active&search=john` | Use path segments for filters: `/entities/active/john` |
| Use `PATCH` for partial updates | Use `PUT` for partial updates |
| Use `POST` for actions that aren't CRUD | Use `GET` for actions with side effects |

### Query Parameter Standards (for GET list endpoints)

```typescript
// Standard query parameters every list endpoint should support:

GET /api/v2/module/entities?search=keyword           // Text search
GET /api/v2/module/entities?isActive=true             // Boolean filter
GET /api/v2/module/entities?status=active             // Enum filter
GET /api/v2/module/entities?limit=50&offset=0         // Pagination
GET /api/v2/module/entities?sortBy=createdAt&order=desc // Sorting

// Controller parsing pattern:
async getAll(req: Request, res: Response) {
  const filters = {
    search: req.query.search as string | undefined,
    isActive: req.query.isActive === "true" ? true
            : req.query.isActive === "false" ? false
            : undefined,
    status: req.query.status as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };
  const result = await myService.getAll(filters);
  res.json(result);
}
```

### Response Format Standards

```typescript
// ✅ List response — always return array:
GET /api/v2/module/entities → [{ uuid, name, ... }, { uuid, name, ... }]

// ✅ Single resource — return object:
GET /api/v2/module/entities/:uuid → { uuid, name, ... }

// ✅ Created — return created object with 201 status:
POST /api/v2/module/entities → 201 { uuid, name, ... }

// ✅ Updated — return updated object:
PATCH /api/v2/module/entities/:uuid → 200 { uuid, name, ... }

// ✅ Deleted — empty body with 204:
DELETE /api/v2/module/entities/:uuid → 204 (no body)

// ✅ Error — consistent shape:
4xx/5xx → { error: "Human readable message", details?: [...] }

// ❌ NEVER return different shapes for the same endpoint
// ❌ NEVER return { success: true, data: {...} } wrapper — return data directly
// ❌ NEVER return integer IDs in response — use UUID only
```

---

## 📂 Proper File & Folder Structure — Mandatory Hierarchy

### Complete Module Structure (Full Reference)

```
📦 NEW MODULE: "<module-name>"
│
├── 📂 shared/v2/<module>/                    ← SHARED (client + server)
│   ├── schema.ts                             ← Drizzle tables + Zod schemas
│   └── types.ts                              ← TypeScript interfaces (DTOs, filters)
│
├── 📂 server/v2/<module>/                    ← BACKEND
│   ├── index.ts                              ← Barrel exports (routes, controllers, services, repos)
│   ├── routes.ts                             ← Express Router (route → controller mapping)
│   ├── 📂 controllers/
│   │   ├── index.ts                          ← Re-exports all controllers
│   │   ├── <entity1>Controller.ts            ← HTTP handling for entity1
│   │   └── <entity2>Controller.ts            ← HTTP handling for entity2 (if multiple entities)
│   ├── 📂 services/
│   │   ├── index.ts                          ← Re-exports all services
│   │   ├── <entity1>Service.ts               ← Business logic for entity1
│   │   └── <entity2>Service.ts               ← Business logic for entity2
│   └── 📂 repositories/
│       ├── index.ts                          ← Re-exports all repositories
│       ├── <entity1>Repository.ts            ← Drizzle queries for entity1
│       └── <entity2>Repository.ts            ← Drizzle queries for entity2
│
├── 📂 client/src/modules/<module>/           ← FRONTEND
│   ├── index.tsx                             ← Module entry (lazy-loaded router)
│   ├── <Module>Module.tsx                    ← Main page component
│   ├── <Module>SideBar.tsx                   ← Sidebar navigation (if needed)
│   ├── 📂 api/
│   │   └── <module>Api.ts                    ← API client (uses apiRequest)
│   ├── 📂 hooks/
│   │   ├── use<Entity1>.ts                   ← useQuery/useMutation hooks for entity1
│   │   └── use<Entity2>.ts                   ← Hooks for entity2
│   ├── 📂 components/
│   │   ├── <Entity1>List.tsx                 ← List/table component
│   │   ├── <Entity1>Form.tsx                 ← Create/edit form
│   │   ├── <Entity1>Details.tsx              ← Detail view
│   │   └── <Entity1>Dialog.tsx               ← Dialog component
│   └── 📂 mappers/                           ← (only if needed for legacy compatibility)
│       └── v2ToLegacyMapper.ts
│
└── 📂 migrations/
    └── NNNN_create_<module>_tables.sql       ← SQL migration file
```

### Strict Rules

| Rule | Why |
|---|---|
| **Every directory MUST have an `index.ts`** barrel export file | Enable clean imports: `from "./controllers"` instead of `from "./controllers/entityController"` |
| **One entity per file** — never combine multiple entities in one file | Keeps files small, testable, and reviewable |
| **Module directory name = kebab-case** | Consistency: `crew-pool`, `rest-hours`, `drugs-alcohol` |
| **Backend controllers/services/repos MUST be in subdirectories** | Flat files in module root = messy. Always use subdirectories |
| **Frontend module MUST have `api/` and `hooks/` dirs** | Separates data layer from UI layer |
| **Frontend components go in `components/` subdir** — never at module root | Only `index.tsx`, `<Module>Module.tsx`, and `<Module>SideBar.tsx` at module root |
| **Migrations go in root `migrations/`** — not inside the module | Drizzle Kit reads from root `migrations/` directory |

### Where Each Type of File Goes

| Type of Code | Goes In | Never In |
|---|---|---|
| Drizzle table definitions | `shared/v2/<module>/schema.ts` | `shared/schema.ts` |
| TypeScript interfaces/DTOs | `shared/v2/<module>/types.ts` | inline in server or client files |
| Database queries | `server/v2/<module>/repositories/` | `server/storage.ts`, `server/database.ts`, services |
| Business logic | `server/v2/<module>/services/` | controllers, repositories, routes |
| HTTP parsing + response | `server/v2/<module>/controllers/` | services, repositories |
| Route definitions | `server/v2/<module>/routes.ts` | `server/routes.ts` inline handlers |
| API client functions | `client/src/modules/<module>/api/` | `client/src/lib/`, `client/src/hooks/` |
| Module-specific hooks | `client/src/modules/<module>/hooks/` | `client/src/hooks/` (root) |
| Module-specific components | `client/src/modules/<module>/components/` | `client/src/components/` |
| Global Zustand stores | `client/src/stores/` | `client/src/store/` |
| UI primitives (button, dialog, input) | `client/src/components/ui/` | Inside module components |
| Shared utility functions | `shared/` (if used by both) or `server/utils/` | Inside storage, database, or schema files |
| SQL migrations | `migrations/NNNN_*.sql` (root) | `server/migrations/` |

---

## 🔍 Quick Self-Check Before Submitting

Run through this checklist. If any item is ❌, fix it before proceeding:

```
BACKEND
□ All new code is under server/v2/<module>/ ?
□ Nothing added to storage.ts, database.ts, or shared/schema.ts ?
□ Every repository uses getDb() from server/v2/db.ts ?
□ Controllers have ZERO business logic ?
□ Services have ZERO req/res references ?
□ Repositories have ZERO business rules ?
□ All request bodies validated with Zod ?
□ No file exceeds 500 lines ?
□ No `any` types used ?
□ Migration file created (not modified existing) ?
□ Routes mounted in server/routes.ts via app.use() ?

SECURITY
□ No manual token/header handling — relying on middleware ?
□ No new exempt paths added (unless health check) ?
□ User UUID passed to repository for audit columns ?
□ No JWT_SECRET hardcoded — using env var ?
□ File download endpoints support ?sail= query token ?

MULTI-TENANCY
□ Repository uses getDb() — not direct pool/db import ?
□ No manual x-tenant-id reading — middleware handles it ?
□ No tenant_id column in tables (isolation is at DB level) ?
□ Tested with at least 2 different tenant IDs ?

FRONTEND
□ Module lives in client/src/modules/<module>/ ?
□ API client uses apiRequest() from @/lib/queryClient ?
□ No manual header injection (no x-tenant-id or Authorization) ?
□ Data fetching uses TanStack Query (useQuery/useMutation) ?
□ Forms use React Hook Form + Zod ?
□ UI uses shadcn/ui components only ?
□ Route registered in App.tsx with <ProtectedRoute> ?
□ Module entry is lazy-loaded ?
□ No component file exceeds 500 lines ?
□ Types imported from @shared/v2/<module>/types ?

SHARED
□ Schema in shared/v2/<module>/schema.ts (not shared/schema.ts) ?
□ Types in shared/v2/<module>/types.ts (not inline any) ?
□ Tables use UUID identifiers (not serial integers) ?
□ Tables have ALL audit columns (spread ...auditColumns) ?
□ No JSON-stringified arrays in text columns ?
□ Related data in separate normalized tables ?
□ SQL migration includes proper indexes ?

DATABASE
□ Every table has id (serial PK) + uuid (text unique) ?
□ Every table spreads ...auditColumns ?
□ created_by_uuid and updated_by_uuid populated in repository ?
□ Soft delete via is_deleted (not hard DELETE) in production ?
□ Table name ends with _v2 suffix ?
□ All column names use snake_case ?

REST API
□ URLs use plural nouns (/entities not /entity) ?
□ URLs use kebab-case (/crew-pool not /crewPool) ?
□ GET returns 200, POST returns 201, DELETE returns 204 ?
□ PATCH used for partial updates (not PUT) ?
□ Errors return { error: "message" } format ?
□ No data wrapped in { success: true, data: {...} } ?
□ UUIDs used in URLs (not integer IDs) ?
```

---

## 🔑 Authentication & Token Management Guidelines

> [!IMPORTANT]
> Every new module MUST support **individual user login** (not just parent-app JWT) and **token verification on every request**. This section defines the standard for how authentication should work across the entire system.

### Guideline 1: Support Individual Login

Future modules MUST support standalone user authentication — users log in with their own credentials, independent of the parent SAIL Audits app.

**Login credentials format:**

```typescript
// Login request body — always these 3 fields:
{
  "username": "string",   // crew ID, employee number, or username
  "password": "string",   // plain text (hashed on server via bcrypt)
  "domain": "string"      // tenant domain (e.g., "company.sail.com")
}
```

**Rules:**
| # | Rule |
|---|---|
| 1 | Login endpoint MUST be `POST /api/v2/auth/login` |
| 2 | Login endpoint MUST be auth-exempt (add to `exemptPaths.ts`) |
| 3 | Passwords MUST be hashed with `bcrypt` (min 10 salt rounds) — never store plain text |
| 4 | The `domain` field is used to resolve the correct tenant database before authenticating |
| 5 | Login MUST return both `accessToken` (short-lived) and `refreshToken` (long-lived) |
| 6 | Failed login attempts MUST be rate-limited (max 5 per minute per username+domain) |
| 7 | After 10 consecutive failures, the account MUST be temporarily locked (15 min) |
| 8 | Login response MUST NOT include the password hash or any sensitive server data |

---

### Guideline 2: Token Generation Standard

**Access Token (short-lived):**

```typescript
// Generated on login — expires quickly
const accessToken = jwt.sign(
  {
    id: user.id,               // Internal user ID
    uuid: user.uuid,           // Public user UUID
    username: user.username,   // Username / crew ID
    domain: user.domain,       // Tenant domain
    userType: user.userType,   // "admin" | "user" | "crew" | "viewer"
  },
  process.env.JWT_SECRET,
  { expiresIn: "15m" }        // 15 minutes — NEVER longer than 1 hour
);
```

**Refresh Token (long-lived):**

```typescript
// Generated alongside access token — used to get new access tokens
const refreshToken = jwt.sign(
  {
    id: user.id,
    uuid: user.uuid,
    domain: user.domain,
    type: "refresh",           // Distinguishes from access token
  },
  process.env.JWT_REFRESH_SECRET,  // DIFFERENT secret from access token
  { expiresIn: "7d" }             // 7 days
);
```

**Rules:**
| # | Rule |
|---|---|
| 1 | Access token expiry: **15 minutes** (configurable via env var, max 1 hour) |
| 2 | Refresh token expiry: **7 days** (configurable via env var, max 30 days) |
| 3 | Use **two different secrets**: `JWT_SECRET` for access, `JWT_REFRESH_SECRET` for refresh |
| 4 | Refresh tokens MUST be stored in the database (for revocation on logout) |
| 5 | Access tokens are stateless — NOT stored in the database |
| 6 | Token payload MUST include: `id`, `uuid`, `username`, `domain`, `userType` |
| 7 | NEVER put sensitive data in the token payload (no passwords, no email, no PII) |
| 8 | Both tokens MUST be returned in the login response body — NOT in cookies |

---

### Guideline 3: Token Verification on EVERY Request

> [!CAUTION]
> **This is where crewing went wrong.** Some endpoints had inconsistent auth checks, missing token validation, or hardcoded bypass logic. Every single API request MUST be verified.

**Server-side verification flow:**

```
Every /api/v2/* request (except exempt paths):
│
├── 1. tenantMiddleware: reads x-tenant-id header → resolves tenant DB
│
├── 2. authMiddleware: extracts token → verifies → sets req.user
│     │
│     ├── Token present? → jwt.verify(token, JWT_SECRET)
│     │   ├── Valid? → req.user = decoded payload → next()
│     │   ├── Expired? → 401 { error: "token_expired" }
│     │   └── Invalid? → 401 { error: "invalid_token" }
│     │
│     └── Token missing? → 401 { error: "unauthorized" }
│
└── 3. Route handler: processes authenticated request with req.user
```

**Rules:**
| # | Rule |
|---|---|
| 1 | The `authMiddleware` runs on ALL `/api/v2/*` routes automatically — you NEVER add manual auth checks in controllers |
| 2 | Every controller method can access `req.user` — it's always populated by middleware |
| 3 | If a route needs to be public, add it to `server/middleware/exemptPaths.ts` — never bypass auth inline |
| 4 | The middleware verifies BOTH the JWT signature AND expiry — you never do `jwt.verify()` manually |
| 5 | Token domain MUST match the tenant ID — prevents cross-tenant access |
| 6 | On 401 response, the client (`tenantFetch.ts`) automatically attempts refresh or redirects to login |
| 7 | File download endpoints accept token via `?sail=<token>` query param (browser can't set headers on `<a href>`) |

---

### Guideline 4: Passing Token With Every API Request

**Client-side (automatic — via `tenantFetch.ts`):**

```typescript
// tenantFetch.ts patches window.fetch() globally:
// Every fetch to /api/* automatically gets:
headers.set("Authorization", `Bearer ${accessToken}`);
headers.set("x-tenant-id", tenantId);

// YOU NEVER DO THIS MANUALLY. It's automatic.
```

**Rules:**
| # | Rule |
|---|---|
| 1 | **NEVER** manually add `Authorization` or `x-tenant-id` headers in API client code |
| 2 | Always use `apiRequest()` from `@/lib/queryClient` — it uses the patched `fetch()` |
| 3 | Store access token in `sessionStorage` (encrypted via AES) — never `localStorage` |
| 4 | Store refresh token in `sessionStorage` (encrypted) — cleared on tab close |
| 5 | On 401 response → attempt silent refresh → if refresh fails → redirect to login page |
| 6 | On 403 response → show "Access Denied" — do NOT redirect to login (user is authenticated but unauthorized) |
| 7 | For file downloads, append token as query param: `/api/v2/.../download?sail=${token}` |

---

### Guideline 5: Token Refresh Flow

```
Client detects 401 (token expired):
│
├── 1. Call POST /api/v2/auth/refresh with { refreshToken }
│
├── 2. Server verifies refresh token:
│     ├── Valid + not revoked? → return new accessToken + refreshToken
│     └── Invalid/expired/revoked? → 401 → client redirects to login
│
├── 3. Client stores new tokens in sessionStorage
│
└── 4. Client retries the original failed request with new token
```

**Rules:**
| # | Rule |
|---|---|
| 1 | Refresh endpoint MUST be auth-exempt (user's access token is already expired) |
| 2 | Refresh MUST issue BOTH new access token AND new refresh token (rotation) |
| 3 | Old refresh token MUST be invalidated after use (prevents token reuse) |
| 4 | If refresh token is expired/invalid, clear all stored tokens and redirect to login |
| 5 | Only ONE refresh request at a time — queue concurrent requests waiting for refresh |

---

### Guideline 6: Auth-Related Endpoints Standard

Every application MUST have these standard auth endpoints:

```
POST   /api/v2/auth/login              ← Login (exempt from auth)
POST   /api/v2/auth/refresh            ← Refresh token (exempt from auth)
GET    /api/v2/auth/profile            ← Get current user profile (auth required)
POST   /api/v2/auth/change-password    ← Change password (auth required)
POST   /api/v2/auth/logout             ← Invalidate refresh token (auth required)
```

---

## 📝 API Documentation & Structure Standards

> [!IMPORTANT]
> The NestJS-style pattern (`@ApiOperation`, `@UseGuards`, `@ApiBearerAuth()`) is the **industry standard** for documenting APIs. Since this project uses Express (not NestJS), we achieve the same clarity using **JSDoc + Swagger YAML inline with routes**.

### Standard 1: Every Controller Method MUST Have JSDoc

```typescript
// ❌ BAD — No documentation (what crewing did)
async getAll(req: Request, res: Response) {
  const crew = await crewMembersService.getAll();
  res.json(crew);
}

// ✅ GOOD — NestJS-equivalent documentation in Express
/**
 * @description List all entities with optional filters
 * @route GET /api/v2/<module>/entities
 * @access Authenticated (Bearer Token)
 * @query {string} [search] - Text search filter
 * @query {boolean} [isActive] - Active status filter
 * @returns {200} Entity[] - List of entities
 * @returns {401} Unauthorized - Missing or invalid token
 * @returns {500} Server Error - Internal failure
 */
async getAll(req: Request, res: Response) {
  // ...
}
```

**Mapping from NestJS to our Express standard:**

| NestJS Decorator | Our Express Equivalent |
|---|---|
| `@ApiOperation({ summary: '...' })` | `@description ...` in JSDoc |
| `@ApiResponse({ status: 200 })` | `@returns {200} ...` in JSDoc |
| `@ApiUnauthorizedResponse()` | `@returns {401} Unauthorized` in JSDoc |
| `@ApiForbiddenResponse()` | `@returns {403} Forbidden` in JSDoc |
| `@ApiBearerAuth()` | `@access Authenticated (Bearer Token)` in JSDoc |
| `@Get('profile')` | Route defined in `routes.ts`: `router.get("/profile", ...)` |
| `@UseGuards(AuthGuard)` | Automatic via `authMiddleware` (global) |
| `@Request() req` | `req: Request` parameter |

---

### Standard 2: Swagger YAML Must Be Co-Located With Routes

```typescript
// ❌ BAD — What we did in crewing: Swagger in separate file (1,400 lines of YAML)
// server/swagger-docs/crew-pool.ts → 1,379 lines disconnected from actual routes

// ✅ GOOD — Swagger YAML directly above the route it documents
/**
 * @swagger
 * /api/v2/my-module/entities:
 *   get:
 *     tags: [My Module]
 *     summary: List all entities
 *     description: Returns paginated list with optional search and filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Entity list returned successfully
 *       401:
 *         description: Unauthorized — token missing or expired
 *       500:
 *         description: Internal server error
 */
router.get("/entities", myEntityController.getAll);
```

**Rules:**
| # | Rule |
|---|---|
| 1 | Swagger YAML lives in the module's `routes.ts` file — directly above each route |
| 2 | Every route MUST have a `@swagger` JSDoc block |
| 3 | Every Swagger block MUST include: `tags`, `summary`, `security`, `responses` |
| 4 | `security: [{ bearerAuth: [] }]` on every protected endpoint |
| 5 | New modules MUST NOT create files in `server/swagger-docs/` (legacy location) |
| 6 | Update `server/swagger.ts` → `apis` array to include `"./server/v2/*/routes.ts"` |

---

### Standard 3: Controller Method Documentation Template

Every controller method MUST follow this JSDoc template:

```typescript
/**
 * @description <What this endpoint does — one sentence>
 * @route <METHOD> /api/v2/<module>/<path>
 * @access <Authenticated | Public> (Bearer Token)
 * @param {string} req.params.<name> - <description>
 * @query {string} [req.query.<name>] - <description> (optional params in brackets)
 * @body {<Schema>} req.body - <description>
 * @returns {<statusCode>} <Type> - <description>
 * @returns {400} ValidationError - Zod validation failed
 * @returns {401} Unauthorized - Token missing or expired
 * @returns {404} NotFound - Entity not found
 * @returns {500} ServerError - Internal failure
 */
```

**Example — full controller with NestJS-equivalent docs:**

```typescript
export const myEntityController = {
  /**
   * @description List all entities with optional search and active filter
   * @route GET /api/v2/my-module/entities
   * @access Authenticated (Bearer Token)
   * @query {string} [search] - Text search across name field
   * @query {boolean} [isActive] - Filter by active/inactive status
   * @returns {200} MyEntity[] - Paginated entity list
   * @returns {401} Unauthorized - Token missing or expired
   */
  async getAll(req: Request, res: Response) { ... },

  /**
   * @description Get a single entity by UUID
   * @route GET /api/v2/my-module/entities/:uuid
   * @access Authenticated (Bearer Token)
   * @param {string} req.params.uuid - Entity UUID
   * @returns {200} MyEntity - Entity details
   * @returns {401} Unauthorized - Token missing or expired
   * @returns {404} NotFound - Entity with given UUID not found
   */
  async getByUuid(req: Request, res: Response) { ... },

  /**
   * @description Create a new entity
   * @route POST /api/v2/my-module/entities
   * @access Authenticated (Bearer Token)
   * @body {InsertMyEntitySchema} req.body - Entity data (Zod validated)
   * @returns {201} MyEntity - Created entity
   * @returns {400} ValidationError - Request body failed Zod validation
   * @returns {401} Unauthorized - Token missing or expired
   * @returns {409} Conflict - Entity with same identifier already exists
   */
  async create(req: Request, res: Response) { ... },

  /**
   * @description Partially update an entity
   * @route PATCH /api/v2/my-module/entities/:uuid
   * @access Authenticated (Bearer Token)
   * @param {string} req.params.uuid - Entity UUID
   * @body {UpdateMyEntitySchema} req.body - Partial entity data (Zod validated)
   * @returns {200} MyEntity - Updated entity
   * @returns {400} ValidationError - Request body failed Zod validation
   * @returns {401} Unauthorized - Token missing or expired
   * @returns {404} NotFound - Entity not found
   */
  async update(req: Request, res: Response) { ... },

  /**
   * @description Soft-delete an entity (sets is_deleted = true)
   * @route DELETE /api/v2/my-module/entities/:uuid
   * @access Authenticated (Bearer Token)
   * @param {string} req.params.uuid - Entity UUID
   * @returns {204} - Entity deleted (no body)
   * @returns {401} Unauthorized - Token missing or expired
   * @returns {404} NotFound - Entity not found
   */
  async delete(req: Request, res: Response) { ... },
};
```

---

## ⚠️ Mistakes We Made in Crewing — Avoid in All Future Modules

> [!CAUTION]
> This section catalogs **specific mistakes** made during crewing development, grouped by category. Every AI agent MUST read this before building any new module.

### Authentication Mistakes

| # | What Went Wrong | Impact | Correct Approach |
|---|---|---|---|
| 1 | **No standalone login** — relied entirely on parent app JWT | Can't use the system independently | Build `/api/v2/auth/login` with username + password + domain |
| 2 | **No token refresh mechanism** — when JWT expired, user had to re-login from parent app | Poor UX, broken sessions | Implement refresh tokens (guideline 5 above) |
| 3 | **AUTH_BYPASS leaked into non-dev code** — some routes checked AUTH_BYPASS inline | Security risk | AUTH_BYPASS only in middleware, controlled by env var, dev-only |
| 4 | **No user context in audit columns** — `created_by_uuid` and `updated_by_uuid` left as null | Can't track who changed what | Pass `req.user.id` through controller → service → repository |
| 5 | **Inconsistent 401 vs 403** — some handlers returned 403 when token was missing (should be 401) | Confusing for frontend error handling | 401 = missing/expired token, 403 = valid token but not allowed |

### API Structure Mistakes

| # | What Went Wrong | Impact | Correct Approach |
|---|---|---|---|
| 6 | **No JSDoc on controller methods** — methods had zero documentation | New devs/agents can't understand what endpoints do | Every method gets the JSDoc template above |
| 7 | **Swagger in separate files** — `swagger-docs/crew-pool.ts` (1,379 lines) disconnected from routes | Docs go stale, nobody updates them | Swagger YAML inline in `routes.ts` above each route |
| 8 | **No security annotations** — Swagger didn't show which endpoints need auth | Frontend devs didn't know which calls need tokens | Add `security: [{ bearerAuth: [] }]` to every protected route |
| 9 | **Mixed response formats** — some returned `{ data: [...] }`, others returned arrays directly | Frontend had to guess the shape | Always return data directly (array for lists, object for single) |
| 10 | **No response type definitions in Swagger** — only status codes, no schema for response body | API consumers can't auto-generate types | Define `$ref` schemas or inline response schemas in Swagger |

### Data & Database Mistakes

| # | What Went Wrong | Impact | Correct Approach |
|---|---|---|---|
| 11 | **JSON arrays in text columns** — documents, visas stored as stringified JSON | Can't query, index, or enforce FK constraints | Normalized relational tables with proper columns |
| 12 | **No soft delete** — some delete operations used `DELETE FROM` SQL | Data lost forever, no recovery | Always use `is_deleted = true` flag, never hard delete |
| 13 | **No `updated_at` refresh on update** — some UPDATE queries didn't set `updated_at = NOW()` | Can't tell when a record was last modified | Always set `updatedAt: new Date()` in every update query |
| 14 | **Hardcoded lookup data** — vessel names and UUIDs in source code | Data goes stale, can't update without deploy | All lookups from database master tables or external API |
| 15 | **No indexes on UUID columns** — queries by UUID did full table scans | Slow queries on large tables | Create `INDEX` on every UUID column used in WHERE/JOIN |

### Code Organization Mistakes

| # | What Went Wrong | Impact | Correct Approach |
|---|---|---|---|
| 16 | **5,300-line storage.ts** — ALL queries for ALL entities in one file | Impossible to review, test, or merge | One repository file per entity, max 300 lines |
| 17 | **Business logic in repositories** — experience calculations inside DB query functions | Can't unit test logic without DB | Repo = queries only, Service = all business logic |
| 18 | **Business logic in controllers** — status computation, data transformation in route handlers | Duplicated logic, untestable | Controller = HTTP only, call service for everything |
| 19 | **Duplicated functions** — same helper in 2+ files (`isTankerVesselType`, `isOfficerRank`) | Changes needed in multiple places | Extract to `shared/` utility, import everywhere |
| 20 | **60+ `type X = any` exports** — TypeScript couldn't catch real bugs | Runtime errors that TS should have prevented | Define proper interfaces, use `z.infer<>` and `$inferSelect` |
| 21 | **Giant React components** — `CrewInfoForm_v2.tsx` at 384KB | Impossible to maintain or modify | Max 500 lines per `.tsx`, break into sub-components |
| 22 | **No barrel exports (index.ts)** — imports used full file paths | Fragile imports, hard to refactor | Every directory has `index.ts` that re-exports |

### Multi-Tenancy Mistakes

| # | What Went Wrong | Impact | Correct Approach |
|---|---|---|---|
| 23 | **Direct DB pool imports** — some code imported `pool` directly | Bypassed tenant context, queries hit wrong DB | Always use `getDb()` from `server/v2/db.ts` |
| 24 | **Manual tenant header injection** — some frontend code added `x-tenant-id` manually | Inconsistent, some calls missed the header | `tenantFetch.ts` handles ALL headers automatically |
| 25 | **No tenant validation on token** — didn't verify JWT domain matched request tenant | User of Tenant A could potentially access Tenant B | `authMiddleware` now verifies `jwt.domain === req.tenantId` |

---

> **Remember**: Every rule in this file exists because we learned it the hard way.
> Following this guide means your module will be production-ready from day one.
