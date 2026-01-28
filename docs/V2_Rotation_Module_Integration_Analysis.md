# V2 Rotation Module Integration - Comprehensive Analysis

## Document Purpose
This document provides a complete technical analysis for integrating V2 Crew Pool with the Rotation Module, enabling:
1. V2 Crew Pool members (transferred from Recruitment) to appear in Rotation for deployment
2. Rotation deployments to update V2 `crew_assignments` table
3. Deployed crew to be visible in Vessel Module

**Status**: FOR REVIEW AND VALIDATION ONLY - DO NOT IMPLEMENT

---

## Section 1: Current Architecture Overview

### 1.1 V2 Crew Pool Tables (Source of Truth for V2 Crew)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `crew_members_v2` | Core crew identity | `crewUuid`, `empNo`, `firstName`, `familyName`, `presentRank`, `status`, `availability` |
| `crew_personal_details` | Extended profile | `crewPool`, `manningAgent`, `availability`, `nextAvailability`, `nationalityUuid` |
| `crew_assignments` | Vessel assignments | `crewUuid`, `vesselUuid`, `isCurrent`, `signOnDate`, `signOffDate`, `reliefDue`, `contractPeriod` |

**Schema Location**: `shared/v2/crew-pool/schema.ts`

### 1.2 V1 Tables (Currently Used by Rotation)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `crew_members` | Legacy crew data | `id`, `firstName`, `familyName`, `presentRank`, `crewPool` (rarely populated) |
| `vessel_planning` | Vessel crew assignments | `vesselId`, `crewMemberId`, `relieverCrewId`, `signOnDate`, `reliefDue`, `joiningStatus` |
| `rotation_plans` | Rotation planning | `draftId`, `vessels`, `assignments` (JSON), `planStatus` |
| `rotation_archive` | Deployment history | `originalPlanId`, `vesselId`, `crewId`, `result` |

**Schema Location**: `shared/schema.ts` (lines 495-604)

### 1.3 V1 Structural Issues (Why Migration to V2 is Necessary)

| Issue | V1 Problem | V2 Solution |
|-------|------------|-------------|
| **JSON Fields** | Complex data stored as JSON strings (lines 184-193): `documents`, `visas`, `education`, `licenses`, `trainingCourses`, `currentCompanySeaService`, `externalSeaService`, `preJoiningMedicals`, `doctorVisits`, `children` | Normalized tables with proper columns: `crew_documents`, `crew_visas`, `crew_education`, `crew_licenses`, `crew_training`, `crew_sea_service`, `crew_medicals`, `crew_children` |
| **No UUID Primary Keys** | V1 uses text `id` field (sometimes numeric string) | V2 uses `crewUuid` (UUID) as primary identifier + `empNo` (sequential A000001) |
| **Missing Audit Columns** | V1 `crew_members` has only `createdAt`, no `updatedAt`, no `createdByUuid` | V2 has full audit trail: `createdAt`, `updatedAt`, `createdByUuid`, `isDeleted`, `deletedAt` |
| **No Foreign Keys** | V1 stores vessel/rank as plain text, no referential integrity | V2 uses UUID foreign keys: `nationalityUuid`, `vesselUuid`, `rankUuid` with proper references |
| **No Soft Deletes** | V1 has no delete tracking | V2 has `isDeleted` + `deletedAt` for all tables |
| **Inconsistent Naming** | V1 mixes snake_case and camelCase | V2 uses consistent camelCase in TypeScript, snake_case in DB |

**V1 JSON Fields Evidence** (from `shared/schema.ts` lines 181-193):
```typescript
vesselTypes: text("vessel_types"), // JSON array of vessel types
documents: text("documents"), // JSON array of documents
visas: text("visas"), // JSON array of visas
education: text("education"), // JSON array of education records
licenses: text("licenses"), // JSON array of licenses
trainingCourses: text("training_courses"), // JSON array of training courses
currentCompanySeaService: text("current_company_sea_service"), // JSON array
externalSeaService: text("external_sea_service"), // JSON array
preJoiningMedicals: text("pre_joining_medicals"), // JSON array
doctorVisits: text("doctor_visits"), // JSON array
children: text("children"), // JSON array of children information
```

### 1.4 Current V2 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/crew-pool/crew` | GET | List all V2 crew |
| `/api/v2/crew-pool/crew/:crewUuid` | GET | Get single crew member |
| `/api/v2/crew-pool/crew/:crewUuid/profile` | GET | Get full profile with JOINs |
| `/api/v2/crew-pool/crew/:crewUuid/assignments` | GET | Get crew's vessel assignments |
| `/api/v2/crew-pool/crew/:crewUuid/assign` | POST | Assign crew to vessel |
| `/api/v2/crew-pool/crew/:crewUuid/sign-off` | POST | Sign off from vessel |
| `/api/v2/crew-pool/vessels/:vesselUuid/crew` | GET | Get crew on a vessel |
| `/api/v2/crew-pool/transfer/recruitment` | POST | Transfer candidate to crew pool |

### 1.5 Missing V2 Endpoints (Required for Rotation Integration)

| Missing Endpoint | Method | Purpose | Priority |
|------------------|--------|---------|----------|
| `/api/v2/crew-pool/crew/by-rank/:rank` | GET | Get crew filtered by rank for rotation selection | **CRITICAL** |
| `/api/v2/crew-pool/crew/available` | GET | Get crew filtered by availability status | Medium |
| `/api/v2/crew-pool/crew/by-pool/:pool` | GET | Get crew filtered by crew pool | Medium |
| `/api/v2/crew-pool/crew/rotation-candidates` | GET | Composite endpoint with rank, pool, availability filters | Optional (can use query params on getAll) |

**Verification**: Search for `by-rank` or `byRank` in V2 routes returns: **"No by-rank endpoint found"**

**Note**: The existing `GET /crew` and `GET /crew/details` endpoints support filtering via query params:
- `status` filter exists in service (line 379: `if (filters?.status)`)
- `presentRank` filter would need to be added to `crewMembersService.getAll()`

---

## Section 2: V1 Rotation Control System (Complete Reference)

This section documents how rotation is controlled in V1 - the tables, endpoints, and workflow that V2 currently lacks entirely.

### 2.1 V1 Rotation Tables

#### Table: `rotation_plans` (lines 556-571 in shared/schema.ts)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial | Primary key |
| `draftId` | text | Unique draft identifier |
| `lastEdited` | text | Last edit timestamp |
| `vessels` | text | **JSON array** of vessel names |
| `crew` | text | Comma-separated crew roles (e.g., "Master, Chief Officer") |
| `planFromDate` | text | Plan start date |
| `planToDate` | text | Plan end date |
| `createdBy` | text | User who created plan |
| `planStatus` | text | Status: "In Draft", "Proposed", "Partially Approved", "Approved", "Rejected", "Archived" |
| `proposedBy` | text | User who proposed |
| `proposedDate` | text | Proposal timestamp |
| `assignments` | text | **JSON array**: `[{vesselName, rank, crewId, crewName, signOnDate, contractPeriod, proposalStatus, deployedDate, deployedBy}]` |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Update timestamp |

**Issues**: Uses JSON for `vessels` and `assignments` - no referential integrity, no audit trail per assignment.

---

#### Table: `rotation_archive` (lines 573-604 in shared/schema.ts)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial | Primary key |
| `originalPlanId` | integer | Reference to original plan (may be null) |
| `originalDraftId` | text | Draft ID for reference |
| `originalAssignmentIndex` | integer | Index in original plan's assignments array |
| `vesselId` | text | Vessel code (VSL-XXX format) |
| `rankId` | text | Rank ID |
| `rank` | text | Rank name |
| `crewId` | text | Crew identifier |
| `crewName` | text | Crew display name |
| `crewMemberId` | text | Database crew member ID |
| `signOnDate` | text | Sign-on date |
| `joiningPort` | text | Joining port |
| `contractPeriod` | integer | Contract period in months |
| `signOffDate` | text | Planned sign-off |
| `proposedBy` | text | Proposer |
| `proposedDate` | text | Proposal date |
| `result` | text | "Deployed" or "Rejected" |
| `archivedDate` | text | Archive timestamp |
| `archivedBy` | text | User who archived |
| `vesselPlanningId` | integer | ID of vessel_planning record |
| `currentCrewInfo` | text | **JSON**: `{id, name, contractStartDate, contractEndDate, rangeStartDate, rangeEndDate}` |
| `fullAssignmentSnapshot` | text | Complete **JSON snapshot** of original assignment |
| `createdAt` | timestamp | Creation timestamp |

**Issues**: No UUID, uses JSON for crew info snapshot, no FK to crew_members.

---

#### Table: `vessel_planning` (lines 495-554 in shared/schema.ts)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial | Primary key |
| `vesselId` | text | Vessel code (VSL-XXX) |
| `rankId` | text | Rank identifier |
| `rank` | text | Rank name |
| `crewMemberId` | text | FK to crew_members.id |
| `crewStatus` | text | "primary" or "secondary" |
| `onBoardCrewId` | text | DEPRECATED |
| `onBoardCrewName` | text | DEPRECATED |
| `signOnDate` | text | Actual sign-on date |
| `reliefDue` | text | Relief due date |
| `signOffDate` | text | Sign-off date |
| `signOffPort` | text | Sign-off port |
| `signOffReason` | text | Reason for sign-off |
| `relieverCrewId` | text | Reliever crew ID |
| `relieverCrewName` | text | DEPRECATED |
| `relieverSignOnDate` | text | Reliever's planned sign-on |
| `joiningPort` | text | Joining port |
| `joiningStatus` | text | "Proposed", "Planned", "Confirmed", "In Transit", "Signed On" |
| `contractPeriodMonths` | integer | Contract period |
| `handoverAttachments` | text | **JSON array**: `[{filename, fileType, uploadDate, ...}]` |
| `isArchived` | boolean | Archive status |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Update timestamp |

**Issues**: Multiple deprecated columns, JSON for attachments, text FKs (no referential integrity).

---

### 2.2 V1 Rotation API Endpoints

#### Rotation Plan CRUD

| Endpoint | Method | Purpose | File:Line |
|----------|--------|---------|-----------|
| `/api/rotation-plans` | GET | List all rotation plans | routes.ts:4561 |
| `/api/rotation-plans/:id` | GET | Get single plan | routes.ts:4571 |
| `/api/rotation-plans` | POST | Create new plan | routes.ts:4588 |
| `/api/rotation-plans/:id` | PATCH | Update plan | routes.ts:4602 |
| `/api/rotation-plans/:id` | DELETE | Delete plan | routes.ts:4630 |

#### Rotation Workflow

| Endpoint | Method | Purpose | File:Line |
|----------|--------|---------|-----------|
| `/api/rotation-plans/:id/propose` | POST | Propose plan for approval | routes.ts:4648 |
| `/api/rotation/proposals` | GET | Get pending proposals | routes.ts:4669 |
| `/api/rotation/proposals/deploy` | POST | Deploy approved assignment | routes.ts:4885 |
| `/api/rotation/proposals/reject` | POST | Reject assignment | routes.ts:4916 |
| `/api/rotation/proposals/conflicts` | GET | Check for conflicts | routes.ts:4934 |

#### Crew Selection for Rotation

| Endpoint | Method | Purpose | File:Line |
|----------|--------|---------|-----------|
| `/api/rotation/due-crew` | GET | Get crew due for rotation | routes.ts:7738 |
| `/api/crew-members/by-rank/:rank` | GET | Get crew by rank (V1 only) | routes.ts:6878 |

#### Vessel Planning

| Endpoint | Method | Purpose | File:Line |
|----------|--------|---------|-----------|
| `/api/vessel-planning` | GET | List all vessel planning | routes.ts:3778 |
| `/api/vessel-planning/vessel/:vesselId` | GET | Get planning for vessel | routes.ts:3840 |
| `/api/vessel-planning/:id` | GET | Get single record | routes.ts:3996 |
| `/api/vessel-planning` | POST | Create planning record | routes.ts:4013 |
| `/api/vessel-planning/:id` | PUT | Replace record | routes.ts:4038 |
| `/api/vessel-planning/:id` | PATCH | Update record | routes.ts:4074 |
| `/api/vessel-planning/:id` | DELETE | Delete record | routes.ts:4415 |
| `/api/vessel-planning/:id/handover-attachments` | GET/POST/DELETE | Manage attachments | routes.ts:4433-4516 |

---

### 2.3 V1 Rotation Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                   V1 ROTATION WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. CREATE PLAN
   └─► POST /api/rotation-plans
       └─► Creates rotation_plans record (status: "In Draft")

2. ADD ASSIGNMENTS
   └─► PATCH /api/rotation-plans/:id
       └─► Updates assignments JSON array in rotation_plans

3. PROPOSE PLAN
   └─► POST /api/rotation-plans/:id/propose
       └─► Sets planStatus: "Proposed"
       └─► Sets proposedBy, proposedDate

4. REVIEW PROPOSALS
   └─► GET /api/rotation/proposals
       └─► Returns plans with status: "Proposed"

5. CHECK CONFLICTS
   └─► GET /api/rotation/proposals/conflicts
       └─► Validates crew availability, overlapping assignments

6. DEPLOY ASSIGNMENT
   └─► POST /api/rotation/proposals/deploy
       └─► Calls database.deployAssignment()
           ├─► Updates/Creates vessel_planning record
           ├─► Updates rotation_plans assignments JSON (status: "Deployed")
           └─► Creates rotation_archive entry

7. OR REJECT ASSIGNMENT
   └─► POST /api/rotation/proposals/reject
       └─► Updates assignment status in JSON
       └─► Creates rotation_archive entry (result: "Rejected")
```

---

### 2.4 What V2 is Missing (Rotation Infrastructure)

**Search for "rotation" in V2 directories returns: NOTHING**

| Component | V1 Has | V2 Has | Gap |
|-----------|--------|--------|-----|
| `rotation_plans` table | Yes | **NO** | Need V2 equivalent with proper UUIDs |
| `rotation_archive` table | Yes | **NO** | Need V2 equivalent with FKs |
| `vessel_planning` table | Yes | `crew_assignments` (partial) | V2 has assignments but no reliever workflow |
| Rotation plan CRUD endpoints | 5 endpoints | **NONE** | Need all 5 |
| Rotation workflow endpoints | 4 endpoints | **NONE** | Need propose/deploy/reject |
| Crew by-rank endpoint | Yes (V1 only) | **NO** | Need V2 version |
| Due-crew endpoint | Yes (V1 only) | **NO** | Need V2 version |
| Conflict checking | Yes | **NO** | Need for V2 crew |

---

### 2.5 Integration Strategy Options

#### Option A: Extend Existing V1 Rotation (Recommended Short-Term)
- Keep V1 rotation tables and endpoints
- Add V2 crew query to by-rank endpoint
- Add V2 crew_assignments sync on deployment
- **Effort**: Low (4 tasks in analysis document)
- **Risk**: Low - no V1 breaking changes

#### Option B: Create Full V2 Rotation System (Future)
- New tables: `rotation_plans_v2`, `rotation_archive_v2`
- New endpoints under `/api/v2/rotation/`
- Migrate existing data
- **Effort**: High (new module development)
- **Risk**: Medium - parallel systems during migration

#### Recommendation
Proceed with **Option A** for immediate needs. Option B should be considered as a separate project when full V2 migration is planned.

---

## Section 3: Gap Analysis

### 2.1 Critical Gaps (Must Fix)

#### 🔴 GAP #1: Rotation Queries V1 Tables Only

**Current Behavior**:
- File: `server/routes.ts` line 6878
- Rotation fetches crew via: `storage.getCrewMembers()` (V1 only)
- V2 crew in `crew_members_v2` are NEVER queried

```typescript
// Line 6878 - PROBLEM: Only queries V1 table
const crewMembers = await storage.getCrewMembers();
```

**Impact**: Crew transferred from Recruitment to V2 Crew Pool are invisible in Rotation module.

---

#### 🔴 GAP #2: Random Data Generation (4 Fields)

**Current Behavior**:
- File: `server/routes.ts` lines 6974-6988

```typescript
// Line 6975 - Random pool
const pools = ['Pool A', 'Pool B', 'Pool C'];
const pool = pools[Math.floor(Math.random() * pools.length)];

// Line 6982 - Random travel status
const travelStatuses = ['Available', 'On Leave', 'Traveling'];
const travelStatus = travelStatuses[Math.floor(Math.random() * travelStatuses.length)];

// Line 6985 - Random higher cert
const higherCert = higherCerts[Math.floor(Math.random() * higherCerts.length)];

// Line 6988 - Random performance
const performance = performances[Math.floor(Math.random() * performances.length)];
```

**Impact**: Pool, availability, higher cert, and performance filters work on fake data - filtering is meaningless.

---

#### 🔴 GAP #3: Deployment Doesn't Update V2 crew_assignments

**Current Behavior**:
- File: `server/database.ts` lines 2057-2348
- `deployAssignment()` only writes to `vessel_planning` (V1 table)
- V2 `crew_assignments` table is NEVER updated

```typescript
// Lines 2196-2207 - Only updates vessel_planning
await this.db.update(vesselPlanning).set({
  relieverCrewId: crewMemberId,
  relieverSignOnDate: signOnDate,
  joiningStatus: 'Planned',
  // ...
});
```

**Impact**: V2 crew assignments don't reflect rotation deployments; dual source of truth.

---

#### 🔴 GAP #4: Vessel Module Queries V1 Only

**Current Behavior**:
- File: `client/src/modules/vessel/VesselModule.tsx` line 324
- Queries `/api/vessel-planning/vessel/:vesselId` (V1 table)
- V2 `crew_assignments` are not queried

**Impact**: V2 crew assigned via rotation won't appear in Vessel Module unless also written to `vessel_planning`.

---

### 2.2 Medium Gaps (Should Fix)

#### 🟡 GAP #5: No V2 "by-rank" Endpoint

**Current State**:
- V2 has `/api/v2/crew-pool/crew` (list all) and `/api/v2/crew-pool/crew/:crewUuid` (single)
- V2 does NOT have a by-rank endpoint for rotation crew selection

**Required**: New endpoint `/api/v2/crew-pool/crew/by-rank/:rank` that:
- Joins `crew_members_v2` with `crew_personal_details`
- Filters by `presentRank`
- Returns `crewPool`, `availability`, `manningAgent`

---

#### 🟡 GAP #6: empNo vs id Mismatch

**Current State**:
- V1 `crew_members` uses `id` (text, sometimes numeric)
- V2 `crew_members_v2` uses `empNo` (format: A000001)
- V1 `vessel_planning.crewMemberId` references V1 `id`

**Impact**: When deploying V2 crew, need to use `empNo` as identifier or create mapping.

---

### 2.3 Low Priority Gaps

#### 🟢 GAP #7: Master Data Dependency

**Current State**:
- Deployment requires vessel lookup in Master 014
- Crew Pool uses Master 022 values
- Already implemented and working

---

## Section 4: Data Flow Diagrams

### 3.1 Current Flow (Broken for V2)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT V2 CREW FLOW                        │
└─────────────────────────────────────────────────────────────────┘

Recruitment ──(Transfer)──► crew_members_v2 + crew_personal_details
                                      │
                                      │ [NOT CONNECTED]
                                      ▼
                            Rotation Module
                                      │
                              ┌───────┴───────┐
                              │               │
                              ▼               │
          /api/crew-members/by-rank/:rank     │
          (queries crew_members ONLY)         │
                              │               │
                              ▼               │
                    Returns RANDOM pool,      │
                    availability, etc.        │
                              │               │
                              ▼               │
                    NewPlanDialog.tsx         │
                    (filters on fake data)    │
                              │               │
                              ▼               │
                    deployAssignment()        │
                              │               │
                              ▼               │
                    vessel_planning           │
                    (V1 table only)           │
                              │               │
                              ▼               │
                    Vessel Module displays    │
                    from vessel_planning      │
                                              │
          crew_assignments ◄────── [NOT UPDATED]
          (V2 table - orphaned)
```

### 3.2 Required Flow (V2 Integration)

```
┌─────────────────────────────────────────────────────────────────┐
│                   REQUIRED V2 INTEGRATION FLOW                  │
└─────────────────────────────────────────────────────────────────┘

Recruitment ──(Transfer)──► crew_members_v2 + crew_personal_details
                                      │
                                      │ [NEW CONNECTION]
                                      ▼
                            Rotation Module
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
    /api/v2/crew-pool/crew/by-rank/:rank     /api/crew-members/by-rank/:rank
    (NEW - queries V2 with JOINs)            (UPDATED - real pool data)
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                           Merge V1 + V2 crew
                           (deduplicate by empNo/id)
                                      │
                                      ▼
                           NewPlanDialog.tsx
                           (filters on REAL data)
                                      │
                                      ▼
                           deployAssignment()
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
             vessel_planning                    crew_assignments
             (V1 - for vessel module)           (V2 - for V2 tracking)
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                           Vessel Module displays
                           (unified view from both)
```

---

## Section 5: Implementation Tasks

### Task 1: Create V2 Crew By-Rank Endpoint

**File**: `server/v2/crew-pool/routes.ts`
**New Endpoint**: `GET /api/v2/crew-pool/crew/by-rank/:rank`

**Requirements**:
1. Join `crew_members_v2` with `crew_personal_details`
2. Filter by `presentRank` matching parameter
3. Filter by `status = 'Active'` and `isDeleted = false`
4. Return fields for rotation:
   - `empNo` (as `id` for compatibility)
   - `crewUuid`
   - `firstName`, `middleName`, `familyName` (combined as `name`)
   - `presentRank` (as `rank`)
   - `crewPool` (as `pool`)
   - `manningAgent`
   - `availability` (as `travelStatus`)
   - `nextAvailability`
   - `nationalityUuid` (resolved to name)
   - `isV2: true` (flag for frontend)

**Controller**: Create `crewMembersController.getByRank()`
**Service**: Add `crewMembersService.getByRank(rank: string)`

---

### Task 2: Update V1 By-Rank Endpoint (Remove Random Data)

**File**: `server/routes.ts` lines 6974-6988

**Changes**:
1. Remove random pool generation - use actual `crew_members.crewPool` (may be null)
2. Remove random travelStatus - use actual data or null
3. Remove random higherCert - derive from actual endorsements
4. Remove random performance - use actual data or null

**Before (current)**:
```typescript
const pools = ['Pool A', 'Pool B', 'Pool C'];
const pool = pools[Math.floor(Math.random() * pools.length)];
```

**After (fixed)**:
```typescript
const pool = crew.crewPool || null;
```

---

### Task 3: Update Frontend to Query Both V1 and V2

**File**: `client/src/modules/rotation/NewPlanDialog.tsx` lines 405-407

**Changes**:
1. Add query for V2 crew: `/api/v2/crew-pool/crew/by-rank/:rank`
2. Merge V2 and V1 results
3. Deduplicate by `empNo`/`id`
4. Prefer V2 data when available

**Implementation**:
```typescript
// Query V2 crew (primary source)
const { data: v2CrewData } = useQuery({
  queryKey: ['/api/v2/crew-pool/crew/by-rank', normalizedRank],
  enabled: !!normalizedRank,
});

// Query V1 crew (legacy fallback)
const { data: v1CrewData } = useQuery<CrewMember[]>({
  queryKey: [`/api/crew-members/by-rank/${normalizedRank}`],
  enabled: !!normalizedRank,
});

// Merge: V2 crew + V1 crew not in V2
const crewMembers = useMemo(() => {
  const v2Crew = v2CrewData?.data || [];
  const v1Crew = v1CrewData || [];
  const v2Ids = new Set(v2Crew.map(c => c.empNo || c.id));
  return [...v2Crew, ...v1Crew.filter(c => !v2Ids.has(c.id))];
}, [v2CrewData, v1CrewData]);
```

---

### Task 4: Update Deployment to Sync V2 crew_assignments

**File**: `server/database.ts` in `deployAssignment()` method (after line 2245)

**Requirements**:
1. Check if deployed crew is V2 (exists in `crew_members_v2`)
2. If V2: Create/update `crew_assignments` record
3. Set `isCurrent: true` for new assignment
4. Archive previous current assignment (`isCurrent: false`)

**Implementation**:
```typescript
// After vessel_planning insert/update (around line 2245)

// Check if crew is V2
const v2Crew = await this.db.select()
  .from(crewMembersV2)
  .where(eq(crewMembersV2.empNo, crewMemberId))
  .limit(1);

if (v2Crew.length > 0) {
  const crewUuid = v2Crew[0].crewUuid;
  
  // Archive existing current assignment
  await this.db.update(crewAssignments)
    .set({ isCurrent: false, signOffDate: signOnDate })
    .where(and(
      eq(crewAssignments.crewUuid, crewUuid),
      eq(crewAssignments.isCurrent, true)
    ));
  
  // Create new current assignment
  await this.db.insert(crewAssignments).values({
    assignUuid: uuidv4(),
    crewUuid: crewUuid,
    vesselUuid: vesselCode,
    isCurrent: true,
    signOnDate: signOnDate,
    reliefDue: reliefDue,
    contractPeriod: String(contractPeriodMonths),
    assignmentType: 'rotation_deployment',
    createdByUuid: deployedBy,
  });
}
```

---

### Task 5: Update Vessel Module to Display V2 Crew (Optional)

**File**: `client/src/modules/vessel/VesselModule.tsx`

**Options**:
1. **Option A (Recommended)**: Continue using `vessel_planning` as source of truth for Vessel Module. Task 4 ensures both tables are updated.
2. **Option B**: Create unified query that merges `vessel_planning` and `crew_assignments`.

**Rationale for Option A**:
- Vessel Module already works with `vessel_planning`
- Less code changes required
- Single source of truth for vessel display
- V2 `crew_assignments` serves as audit trail for V2 crew

---

### Task 6: Add V2 Crew Pool Values to Master 022

**Migration**: `migrations/00XX_ensure_crew_pool_master_data.sql`

**Requirement**: Ensure Master 022 (Crew Pool) has entries matching pools used in V2:
- Values from transfer service (e.g., "Recruitment Transfer")
- Any existing pool categorizations used in the company

---

## Section 6: Database Schema Considerations

### 5.1 No Schema Changes Required

All required tables and columns already exist:
- `crew_members_v2` - has `presentRank`, `status`, `empNo`
- `crew_personal_details` - has `crewPool`, `manningAgent`, `availability`
- `crew_assignments` - has `vesselUuid`, `isCurrent`, `signOnDate`, `reliefDue`
- `vessel_planning` - has all deployment fields

### 5.2 ID Mapping Strategy

| V2 Field | V1 Equivalent | Mapping |
|----------|---------------|---------|
| `crewUuid` | N/A | V2 only |
| `empNo` | `crew_members.id` | Use empNo for compatibility |
| `vesselUuid` | `vessel_planning.vesselId` | Both use Master 014 entry_id |

---

## Section 7: Acceptance Criteria

### 6.1 Crew Visibility in Rotation

- [ ] V2 crew (transferred from Recruitment) appear in NewPlanDialog crew selection
- [ ] V2 crew show REAL `crewPool` from `crew_personal_details.crew_pool`
- [ ] V2 crew show REAL `availability` from `crew_personal_details.availability`
- [ ] V2 crew show REAL `manningAgent` from `crew_personal_details.manning_agent`
- [ ] Pool filter works on real data (not random)
- [ ] Availability filter works on real data

### 6.2 Rotation Deployment

- [ ] Deploying V2 crew creates `vessel_planning` record (for Vessel Module)
- [ ] Deploying V2 crew creates `crew_assignments` record (for V2 tracking)
- [ ] Previous current assignment is archived (`isCurrent: false`)
- [ ] Deployment archive entry is created in `rotation_archive`
- [ ] Transaction atomicity maintained (all or nothing)

### 6.3 Vessel Module Display

- [ ] Deployed crew (V1 or V2) appear in Vessel Module
- [ ] Crew data displays correctly (name, rank, sign-on date)
- [ ] Reliever information displays correctly

### 6.4 Backward Compatibility

- [ ] V1 crew still work in rotation (no breaking changes)
- [ ] Existing rotation plans still function
- [ ] Existing vessel_planning data unaffected
- [ ] No API contract changes (only additions)

---

## Section 8: Testing Checklist

### 7.1 Manual Tests

1. **Create V2 crew via transfer**:
   - Transfer candidate from Recruitment with `crewPool: "Deck Pool"`
   - Verify crew appears in Crew Pool module

2. **Verify rotation crew selection**:
   - Open Rotation → New Plan
   - Select rank matching transferred crew
   - Verify V2 crew appears in crew list
   - Verify pool shows "Deck Pool" (not random)

3. **Test pool filter**:
   - Filter by "Deck Pool"
   - Verify only matching crew shown

4. **Deploy rotation**:
   - Add V2 crew to rotation plan
   - Propose → Approve → Deploy
   - Verify `vessel_planning` record created
   - Verify `crew_assignments` record created

5. **Vessel Module display**:
   - Navigate to Vessel Module
   - Select deployed vessel
   - Verify crew appears in crew list

### 7.2 Database Verification Queries

```sql
-- Check V2 crew with pool data
SELECT cm.emp_no, cm.first_name, cm.family_name, cm.present_rank,
       cpd.crew_pool, cpd.availability, cpd.manning_agent
FROM crew_members_v2 cm
LEFT JOIN crew_personal_details cpd ON cm.crew_uuid = cpd.crew_uuid
WHERE cm.status = 'Active' AND cm.is_deleted = false;

-- Check crew_assignments after deployment
SELECT ca.crew_uuid, ca.vessel_uuid, ca.is_current, ca.sign_on_date, ca.relief_due
FROM crew_assignments ca
WHERE ca.is_current = true;

-- Verify vessel_planning record
SELECT vp.vessel_id, vp.rank, vp.crew_member_id, vp.reliever_crew_id, vp.joining_status
FROM vessel_planning vp
WHERE vp.vessel_id = '<deployed-vessel-id>';
```

---

## Section 9: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking V1 crew rotation | Low | High | Test V1 crew thoroughly; don't modify V1 query |
| Duplicate crew in selection | Medium | Low | Deduplicate by empNo/id in merge logic |
| Transaction failure on deployment | Low | High | Wrap all inserts in single transaction |
| Performance impact from dual queries | Low | Low | Parallel queries; consider caching |
| Master Data inconsistency | Medium | Medium | Validate against Master 022/014 before operations |

---

## Section 10: Implementation Order

**Phase 1: Foundation (Backend)**
1. Task 1: Create V2 by-rank endpoint
2. Task 2: Remove random data from V1 endpoint

**Phase 2: Frontend Integration**
3. Task 3: Update NewPlanDialog to merge V1+V2 crew

**Phase 3: Deployment Sync**
4. Task 4: Update deployAssignment for V2 crew_assignments

**Phase 4: Data & Testing**
5. Task 6: Ensure Master Data populated
6. Execute manual test checklist
7. Verify acceptance criteria

---

## Section 11: Key File References

| Component | File | Lines |
|-----------|------|-------|
| V1 crew by-rank endpoint | `server/routes.ts` | 6875-7011 |
| Random data generation | `server/routes.ts` | 6974-6988 |
| Deploy function | `server/database.ts` | 2057-2348 |
| V2 crew schema | `shared/v2/crew-pool/schema.ts` | 18-61, 75-93 |
| V2 routes | `server/v2/crew-pool/routes.ts` | 1-176 |
| V2 assignment service | `server/v2/crew-pool/services/crewAssignmentsService.ts` | 1-262 |
| Rotation UI crew selection | `client/src/modules/rotation/NewPlanDialog.tsx` | 405-474 |
| Vessel Module | `client/src/modules/vessel/VesselModule.tsx` | 322-327 |

---

**Document Version**: 1.0
**Created**: January 28, 2026
**Status**: PENDING VALIDATION

---

**End of Document**
