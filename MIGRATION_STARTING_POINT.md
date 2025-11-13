# Migration Starting Point Documentation
## Seafarer Performance Management System

**Generated**: November 13, 2025  
**Purpose**: Complete documentation of current state before PostgreSQL migration

---

## 1. CURRENT STORAGE STATUS

### Active Storage Implementation: ✅ **PersistentFileStorage**

**Location**: `server/storage.ts` line 5551

```typescript
// Use PersistentFileStorage for persistent development storage
storage = new PersistentFileStorage();
console.log("✅ PersistentFileStorage initialized successfully - data will persist across restarts!");
```

**Confirmation from Console Output** (lines 5546-5552):
```
📄 PERSISTENT FILE STORAGE MODE: Using file-based storage (PersistentFileStorage)
🚀 Application will use persistent JSON storage for development
💾 All data will be saved to test-data.json and persist across restarts
```

### Data File: `test-data.json`

**File Statistics**:
- **Size**: 1.3 MB (1,342,177 bytes)
- **Format**: JSON (single-line, minified)
- **Location**: Project root directory
- **Last Modified**: November 13, 2025 07:15

**Data Structure** (Top-level keys):
```json
{
  "appraisalResults": [...],
  "availableRanks": [...],
  "companyRanks": [...],
  "crewMembers": [...],
  "currentAppraisalResultId": number,
  "currentAvailableRankId": number,
  "currentCrewIdCounter": string,
  "currentDrugAlcoholTestRecordId": number,
  "currentFixedTaskId": number,
  "currentFormId": number,
  "currentNCReportId": number,
  "currentOfficeViolationCommentId": number,
  "currentPromotionHierarchyId": number,
  "currentRankGroupId": number,
  "currentRestHoursCrewRecordId": number,
  ... (and more entity collections)
}
```

---

## 2. SCHEMA STATUS

### Schema Definition: `shared/schema.ts`

**Line Count**: 1,296 lines

**ORM Import** (Line 2):
```typescript
import { pgTable, text, integer, boolean, timestamp, varchar, serial } from "drizzle-orm/pg-core";
```

**⚠️ CRITICAL FINDING**: Schema uses **PostgreSQL** imports (`drizzle-orm/pg-core`)

### Table Definitions Count: **31 Tables**

All tables are defined using `pgTable`:

```typescript
export const users = pgTable("users", { ... });
export const forms = pgTable("forms", { ... });
export const rankGroups = pgTable("rank_groups", { ... });
export const availableRanks = pgTable("available_ranks", { ... });
export const crewMembers = pgTable("crew_members", { ... });
... (and 26 more tables)
```

### Complete Table List:
1. `users`
2. `forms`
3. `rankGroups`
4. `availableRanks`
5. `crewMembers`
6. `appraisalResults`
7. `recruitmentCandidates`
8. `vessels`
9. `vesselGroups`
10. `vesselDrafts`
11. `vesselRevisions`
12. `seafarers` (legacy)
13. `revisions` (legacy)
14. `vesselRanks`
15. `companyRanks`
16. `promotionHierarchies`
17. `dataMasters`
18. `masterDataEntries`
19. `idCounters`
20. `vesselPlanning`
21. `rotationPlans`
22. `drugAlcoholTestRecords`
23. `restHoursVesselRecords`
24. `restHoursCrewRecords`
25. `restHoursDailyRecords`
26. `vesselViolationComments`
27. `officeViolationComments`
28. `ncReports`
29. `fixedTasks`
30. `vesselDateLineAdjustments`
31. `variableTasks`

---

## 3. DATABASE CONFIGURATION

### Drizzle Config: `drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Please set it to your MySQL connection string.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",  // ⚠️ CONFIGURED FOR MySQL
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

### ⚠️ **SCHEMA vs CONFIG MISMATCH DETECTED**

**Critical Incompatibility**:
- **Schema** (`shared/schema.ts`): Uses PostgreSQL (`drizzle-orm/pg-core`)
- **Drizzle Config** (`drizzle.config.ts`): Configured for MySQL (`dialect: "mysql"`)

**Impact**: 
- Cannot run migrations without resolving this mismatch
- Need to decide: PostgreSQL OR MySQL (not both)

### Environment Variables (Current Status)

```bash
DATABASE_URL=*** (SET - points to MySQL/PostgreSQL database)
DB_HOST=*** (SET)
DB_PORT=*** (SET)
DB_USER=*** (SET)
DB_NAME=(not visible - may be in DATABASE_URL)
DB_PASSWORD=(not visible - likely in DATABASE_URL)
```

### Package Dependencies

```json
{
  "dependencies": {
    "drizzle-orm": "^0.39.3",
    "mysql2": "^3.6.5"
  }
}
```

**Note**: `pg` (PostgreSQL client) is **NOT** installed, but `mysql2` IS installed.

---

## 4. IStorage INTERFACE

### Interface Definition

**Location**: `server/storage.ts` lines 6-173

**Total Methods**: **140 methods**

**Interface Structure**:
```typescript
export interface IStorage {
  // Lines 7-173 contain all method signatures
  // Organized by functional area:
  // - Users & Authentication (3 methods)
  // - Forms Management (9 methods)
  // - Available Ranks (6 methods)
  // - Company Ranks (7 methods)
  // - Promotion Hierarchies (5 methods)
  // - Crew Members (6 methods)
  // - Appraisal Results (7 methods)
  // - Recruitment Candidates (7 methods)
  // - Master Data (10 methods)
  // - Vessel Groups (5 methods)
  // - Vessel Drafts (6 methods)
  // - Vessel Revisions (4 methods)
  // - Vessel Planning (5 methods)
  // - Dashboard Summary (1 method)
  // - Rotation Plans (5 methods)
  // - Rotation Workflow (5 methods)
  // - Drug/Alcohol Tests (6 methods)
  // - Rest Hours Records (18 methods)
  // - Tasks (13 methods)
  // - Violations & Reports (9 methods)
  // - Date Line Adjustments (4 methods)
}
```

**Complete Method Count by Category**: See BACKEND_ARCHITECTURE.md for detailed breakdown.

---

## 5. DatabaseStorage STATUS

### Class Definition: `server/database.ts`

**Total Lines**: 1,511 lines

**Location**: Lines 35-1511

**Import Statement** (Line 1):
```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
```

**⚠️ USES MySQL**: `drizzle-orm/mysql2` (not PostgreSQL)

### Implementation Status

**Class Header** (Lines 35-65):
```typescript
export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: mysql.Pool;
  private columnCache: Map<string, Set<string>> = new Map();

  constructor() {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    
    if (!DB_HOST || !DB_USER || !DB_PASSWORD) {
      throw new Error("DB_HOST, DB_USER, and DB_PASSWORD environment variables are required");
    }
    
    this.pool = mysql.createPool({
      host: DB_HOST,
      port: parseInt(DB_PORT || '3306'),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME || 'crew_database',
      ssl: { rejectUnauthorized: false },
      connectionLimit: 10,
    });
    this.db = drizzle(this.pool);
    
    // Ensure enhanced master data entries schema exists on startup
    this.ensureMasterDataEntriesSchema().catch(err => 
      console.error("Schema migration failed:", err)
    );
  }
}
```

### Methods Implemented

**Count**: **48 async methods** implemented

**Coverage**: DatabaseStorage implements approximately **34%** of IStorage interface (48 out of 140 methods)

**Implementation Pattern**: 
- Uses Drizzle ORM for type-safe queries
- Implements column filtering for dynamic schema
- Has schema migration helpers
- Handles master data entries with dynamic columns

### Current Status in Application

**From** `server/storage.ts` (lines 5451-5452):
```typescript
// DISABLED: DatabaseStorage is incomplete legacy code
// storage = new DatabaseStorage();
throw new Error("DatabaseStorage is disabled - incomplete legacy code");
```

**Status**: ❌ **DISABLED** - Commented out and throws error when attempted

**Reason**: Incomplete implementation (~92 methods missing)

---

## 6. CRITICAL INCOMPATIBILITIES SUMMARY

### 🔴 Problem 1: Schema vs Database Mismatch

| Component | Type | Configured For |
|-----------|------|----------------|
| `shared/schema.ts` | Schema Definition | **PostgreSQL** (`pg-core`) |
| `drizzle.config.ts` | Migration Tool | **MySQL** (`dialect: "mysql"`) |
| `server/database.ts` | Implementation | **MySQL** (`mysql2`) |
| `package.json` | Dependencies | **MySQL** only (`mysql2` installed, `pg` NOT installed) |

**Impact**: Cannot migrate without resolving PostgreSQL vs MySQL conflict

### 🔴 Problem 2: DatabaseStorage Incomplete

- **Implemented**: 48 methods (~34%)
- **Missing**: 92 methods (~66%)
- **Status**: Disabled and unusable

### 🔴 Problem 3: No Active Database Connection

- PersistentFileStorage is active (file-based JSON)
- DatabaseStorage is disabled
- Environment variables are set but unused
- No database migrations have been run

---

## 7. MIGRATION DECISION REQUIRED

### Option A: Migrate to PostgreSQL ✅ RECOMMENDED

**Reasons**:
- Schema is ALREADY written for PostgreSQL (`pg-core`)
- Only need to:
  1. Install `pg` package
  2. Fix `drizzle.config.ts` to use PostgreSQL
  3. Complete DatabaseStorage implementation (92 missing methods)
  4. Run migrations
  5. Switch from PersistentFileStorage to DatabaseStorage

**Advantages**:
- Minimal schema changes
- Better JSON support (native JSONB columns)
- More robust for production
- Industry standard for Node.js applications

### Option B: Migrate to MySQL

**Reasons**:
- `drizzle.config.ts` and `server/database.ts` configured for MySQL
- `mysql2` package already installed

**Disadvantages**:
- Need to rewrite ENTIRE `shared/schema.ts` (1,296 lines)
- Change all `pgTable` → `mysqlTable`
- Change all `serial` → `int AUTO_INCREMENT`
- Rewrite JSON column types
- Higher migration risk

---

## 8. RECOMMENDED MIGRATION PATH

### Phase 1: Fix Schema/Config Alignment (PostgreSQL)

1. Install PostgreSQL client: `npm install pg`
2. Update `drizzle.config.ts` to PostgreSQL
3. Update `server/database.ts` to use `drizzle-orm/node-postgres`
4. Verify DATABASE_URL points to PostgreSQL instance

### Phase 2: Complete DatabaseStorage

1. Implement 92 missing IStorage methods
2. Test each method implementation
3. Ensure all CRUD operations work

### Phase 3: Data Migration

1. Run Drizzle migrations to create tables
2. Export data from `test-data.json`
3. Import data into PostgreSQL
4. Verify data integrity

### Phase 4: Switch Storage

1. Change `server/storage.ts` to use DatabaseStorage
2. Remove/disable PersistentFileStorage
3. Test all API endpoints
4. Verify application functionality

---

## 9. CURRENT DATA ASSETS

### Data in `test-data.json` (1.3 MB)

This file contains all current production data:
- Crew members
- Appraisal results
- Forms and configurations
- Rest hours records
- Vessel planning data
- Master data entries
- ... and all other entities

**⚠️ CRITICAL**: This data must be preserved and migrated during database transition.

---

## 10. NEXT STEPS

Before proceeding with migration, you must decide:

1. **Database Choice**: PostgreSQL or MySQL?
   - **Recommendation**: PostgreSQL (schema already compatible)

2. **Migration Scope**: 
   - Partial (migrate incrementally)
   - Full (complete all 140 methods, then switch)
   - **Recommendation**: Full (cleaner, less risk)

3. **Data Preservation Strategy**:
   - Keep `test-data.json` as backup
   - Create migration scripts
   - Verify data integrity post-migration

Once decision is made, I can provide detailed step-by-step migration guide.

---

## 11. FILES TO REVIEW

Before migration, review these critical files:

1. ✅ `shared/schema.ts` - Schema definitions
2. ✅ `server/storage.ts` - IStorage interface
3. ✅ `server/database.ts` - DatabaseStorage implementation
4. ✅ `drizzle.config.ts` - Migration configuration
5. ✅ `test-data.json` - Current data (1.3 MB)
6. ✅ `package.json` - Dependencies

---

**Status**: ✅ Documentation Complete  
**Current State**: Stable, using PersistentFileStorage  
**Migration Ready**: Awaiting decision on PostgreSQL vs MySQL
