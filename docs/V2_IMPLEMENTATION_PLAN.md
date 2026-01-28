# V2 Implementation Plan: Admin, Vessel, and Rotation Modules

## Overview

This document provides the complete implementation plan for migrating Admin, Vessel, and Rotation modules to V2 architecture, following the established patterns from Crew Pool V2 and Recruitment V2.

**Key Principles:**
1. Minimal frontend changes - UI files copied to v2/ folders, connected to V2 APIs
2. Compare with legacy queries before building V2 repositories
3. Use multi-table JOINs (avoid N+1 queries)
4. Resolve all FKs in backend queries, not frontend
5. Performance benchmarks required
6. Legacy and V2 must produce identical behavior

---

## PHASE 1: LEGACY ANALYSIS & DOCUMENTATION

### 1.1 Extract V1 Rotation Queries

**Source Files:**
- `server/storage.ts` lines 2658-2800 (MemStorage)
- `server/storage.ts` lines 7150-7300 (PersistentFileStorage)
- `server/routes.ts` lines 4885-4912 (deploy endpoint)

**Key Functions to Document:**
| Function | Location | Purpose |
|----------|----------|---------|
| `deployAssignment()` | storage.ts:2658, 7150 | Deploy crew to vessel_planning |
| `getRotationPlans()` | storage.ts | Get all rotation plans |
| `getRotationArchive()` | storage.ts | Get deployment history |
| `checkAssignmentConflicts()` | storage.ts | Conflict detection |

**Response Format (rotation_plans):**
```typescript
{
  id: number,
  draftId: string,
  planFromDate: string,
  planToDate: string,
  lastEdited: string,
  vessels: string,        // JSON string - need to normalize
  crew: string,           // CSV string - need to normalize
  assignments: string,    // JSON string - need to normalize
  planStatus: string,
  createdBy: string,
  proposedBy: string,
  proposedDate: string,
  createdAt: Date,
  updatedAt: Date
}
```

### 1.2 Extract V1 Vessel Planning Queries

**Key Functions:**
| Function | Purpose |
|----------|---------|
| `getVesselPlanning()` | Get crew assignments per vessel |
| `createVesselPlanning()` | Create new planning record |
| `updateVesselPlanning()` | Update reliever info after deploy |

**Response Format (vessel_planning):**
```typescript
{
  id: number,
  vesselId: string,       // VSL-XXX format
  rankId: string,
  rank: string,
  crewMemberId: string,   // Legacy crew ID
  crewMemberName: string,
  crewStatus: string,
  signOnDate: string,
  reliefDue: string,
  relieverCrewId: string,
  relieverCrewName: string,
  relieverSignOnDate: string,
  joiningPort: string,
  joiningStatus: string,
  contractPeriodMonths: number,
  // ... more fields
}
```

### 1.3 Extract V1 Admin Revision Queries

**Key Functions:**
| Function | Purpose |
|----------|---------|
| `getVesselRevisions()` | Get revision history for vessel |
| `submitRevision()` | Submit new revision |
| `getDrafts()` | Get draft revisions |

**Response Format (vessel_revisions):**
```typescript
{
  id: number,
  vesselId: string,
  revision: string,        // "R0", "R1", etc.
  revisionDate: string,
  revisionData: string,    // JSON - needs normalization!
  createdAt: Date,
  updatedAt: Date
}
```

### 1.4 Column Mapping Document

| V1 Column | V2 Column | Notes |
|-----------|-----------|-------|
| `id` (serial) | `id` (serial) + `*_uuid` (text UK) | Keep serial PK, add UUID |
| `vesselId` (text) | `vessel_uuid` (text FK) | Reference master_vessels |
| `crewMemberId` | `crew_uuid` (text FK) | Reference crew_members_v2 |
| `revisionData` (JSON text) | Normalized to `vessel_revision_ranks_v2` | One row per rank |
| `assignments` (JSON text) | Normalized to `rotation_entries_v2` | One row per assignment |
| `vessels` (JSON text) | Normalized to `rotation_draft_vessels_v2` | One row per vessel |

---

## PHASE 2: V2 SCHEMA & MIGRATIONS

### 2.1 Migration: vessel_revisions_v2 (11 columns)

```sql
CREATE TABLE IF NOT EXISTS vessel_revisions_v2 (
  id SERIAL PRIMARY KEY,
  revision_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,
  revision TEXT NOT NULL,
  revision_date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_vessel_revisions_v2_vessel ON vessel_revisions_v2(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_vessel_revisions_v2_deleted ON vessel_revisions_v2(is_deleted) WHERE is_deleted = false;
```

### 2.2 Migration: vessel_revision_ranks_v2 (37 columns)

```sql
CREATE TABLE IF NOT EXISTS vessel_revision_ranks_v2 (
  id SERIAL PRIMARY KEY,
  rank_uuid TEXT NOT NULL UNIQUE,
  revision_uuid TEXT NOT NULL,
  source_id TEXT,
  rank_name TEXT,
  rank_id TEXT,
  role TEXT,
  original_rank_id TEXT,
  is_role_row BOOLEAN DEFAULT false,
  actual_manning TEXT[],
  actual_manning_flag BOOLEAN DEFAULT false,
  safe_manning BOOLEAN DEFAULT false,
  optimum_manning BOOLEAN DEFAULT false,
  high_workload_manning BOOLEAN DEFAULT false,
  officer BOOLEAN DEFAULT false,
  rating BOOLEAN DEFAULT false,
  senior_officer BOOLEAN DEFAULT false,
  deck_officer BOOLEAN DEFAULT false,
  eng_officer BOOLEAN DEFAULT false,
  petty_officer BOOLEAN DEFAULT false,
  deck_rating BOOLEAN DEFAULT false,
  engine_rating BOOLEAN DEFAULT false,
  general_rating BOOLEAN DEFAULT false,
  catering_rating BOOLEAN DEFAULT false,
  safety_officer BOOLEAN DEFAULT false,
  sso BOOLEAN DEFAULT false,
  medical_officer BOOLEAN DEFAULT false,
  navigating_officer BOOLEAN DEFAULT false,
  emt_officer BOOLEAN DEFAULT false,
  has_multiple BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_revision_ranks_v2_revision ON vessel_revision_ranks_v2(revision_uuid);
CREATE INDEX IF NOT EXISTS idx_revision_ranks_v2_deleted ON vessel_revision_ranks_v2(is_deleted) WHERE is_deleted = false;
```

### 2.3 Migration: vessel_planning_v2 (37 columns)

```sql
CREATE TABLE IF NOT EXISTS vessel_planning_v2 (
  id SERIAL PRIMARY KEY,
  plan_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,
  active_revision_uuid TEXT,
  rank_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  crew_uuid TEXT,
  crew_status TEXT DEFAULT 'primary',
  sign_on_date TEXT,
  relief_due TEXT,
  sign_off_date TEXT,
  sign_off_port_uuid TEXT,
  sign_off_reason TEXT,
  relief_status TEXT,
  take_over_date TEXT,
  take_over_confirmation BOOLEAN DEFAULT false,
  hand_over_date TEXT,
  reliever_crew_uuid TEXT,
  reliever_sign_on_date TEXT,
  joining_port_uuid TEXT,
  joining_status TEXT,
  contract_period_months INTEGER,
  contract_end_range_start_months INTEGER,
  contract_end_range_end_months INTEGER,
  reliever_contract_period_months INTEGER,
  reliever_contract_end_range_start_months INTEGER,
  reliever_contract_end_range_end_months INTEGER,
  deployment_checklist_completed BOOLEAN,
  applicable_docs_checked BOOLEAN,
  is_archived BOOLEAN DEFAULT false,
  archived_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_vessel ON vessel_planning_v2(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_crew ON vessel_planning_v2(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_reliever ON vessel_planning_v2(reliever_crew_uuid);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_archived ON vessel_planning_v2(is_archived) WHERE is_archived = false;
```

### 2.4 Migration: vessel_planning_attachments_v2 (17 columns)

```sql
CREATE TABLE IF NOT EXISTS vessel_planning_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  plan_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  upload_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_planning_attachments_v2_plan ON vessel_planning_attachments_v2(plan_uuid);
```

### 2.5 Migration: rotation_drafts_v2 (15 columns)

```sql
CREATE TABLE IF NOT EXISTS rotation_drafts_v2 (
  id SERIAL PRIMARY KEY,
  draft_uuid TEXT NOT NULL UNIQUE,
  draft_id TEXT NOT NULL,
  last_edited TEXT,
  plan_from_date TEXT NOT NULL,
  plan_to_date TEXT NOT NULL,
  created_by_uuid TEXT NOT NULL,
  plan_status TEXT DEFAULT 'In Draft',
  proposed_by_uuid TEXT,
  proposed_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rotation_drafts_v2_status ON rotation_drafts_v2(plan_status);
CREATE INDEX IF NOT EXISTS idx_rotation_drafts_v2_deleted ON rotation_drafts_v2(is_deleted) WHERE is_deleted = false;
```

### 2.6 Migration: rotation_draft_vessels_v2 (11 columns)

```sql
CREATE TABLE IF NOT EXISTS rotation_draft_vessels_v2 (
  id SERIAL PRIMARY KEY,
  rv_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,
  vessel_uuid TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_draft_vessels_v2_draft ON rotation_draft_vessels_v2(draft_uuid);
CREATE INDEX IF NOT EXISTS idx_draft_vessels_v2_vessel ON rotation_draft_vessels_v2(vessel_uuid);
```

### 2.7 Migration: rotation_draft_ranks_v2 (11 columns)

```sql
CREATE TABLE IF NOT EXISTS rotation_draft_ranks_v2 (
  id SERIAL PRIMARY KEY,
  rr_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,
  rank_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_draft_ranks_v2_draft ON rotation_draft_ranks_v2(draft_uuid);
```

### 2.8 Migration: rotation_entries_v2 (30 columns)

```sql
CREATE TABLE IF NOT EXISTS rotation_entries_v2 (
  id SERIAL PRIMARY KEY,
  entry_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,
  vessel_uuid TEXT NOT NULL,
  active_revision_uuid TEXT,
  rank_id TEXT,
  rank TEXT NOT NULL,
  crew_uuid TEXT,
  sign_on_date TEXT,
  joining_port_uuid TEXT,
  contract_period INTEGER,
  sign_off_date TEXT,
  proposal_status TEXT DEFAULT 'Pending',
  proposed_by_uuid TEXT,
  proposed_date TEXT,
  deployed_date TEXT,
  deployed_by_uuid TEXT,
  rejection_reason TEXT,
  deployed_to_plan_uuid TEXT,
  current_crew_uuid TEXT,
  current_crew_sign_on_date TEXT,
  current_crew_contract_end TEXT,
  current_crew_range_start TEXT,
  current_crew_range_end TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_draft ON rotation_entries_v2(draft_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_vessel ON rotation_entries_v2(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_crew ON rotation_entries_v2(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_status ON rotation_entries_v2(proposal_status);
```

### 2.9 Migration: rotation_archive_v2 (30 columns)

```sql
CREATE TABLE IF NOT EXISTS rotation_archive_v2 (
  id SERIAL PRIMARY KEY,
  archive_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,
  entry_uuid TEXT,
  vessel_uuid TEXT NOT NULL,
  rank TEXT NOT NULL,
  crew_uuid TEXT NOT NULL,
  crew_name TEXT,
  sign_on_date TEXT,
  joining_port_uuid TEXT,
  contract_period INTEGER,
  result TEXT NOT NULL,
  archived_by_uuid TEXT,
  archived_date TEXT,
  current_crew_uuid TEXT,
  current_crew_name TEXT,
  current_crew_sign_on_date TEXT,
  current_crew_contract_end TEXT,
  current_crew_range_start TEXT,
  current_crew_range_end TEXT,
  deployed_to_plan_uuid TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false,
  snapshot_data JSONB,
  source_plan_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_draft ON rotation_archive_v2(draft_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_vessel ON rotation_archive_v2(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_crew ON rotation_archive_v2(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_result ON rotation_archive_v2(result);
```

---

## PHASE 3: ADMIN V2 MODULE

### 3.1 Backend Folder Structure

```
server/v2/admin/
├── controllers/
│   ├── vesselRevisionsController.ts
│   ├── revisionRanksController.ts
│   └── index.ts
├── repositories/
│   ├── vesselRevisionsRepository.ts
│   ├── revisionRanksRepository.ts
│   └── index.ts
├── services/
│   ├── vesselRevisionsService.ts
│   └── index.ts
├── routes.ts
└── index.ts
```

### 3.2 Repository Pattern with JOINs

**vesselRevisionsRepository.ts:**
```typescript
// Multi-table JOIN example - resolve vessel name in single query
async getByVesselUuid(vesselUuid: string) {
  return db
    .select({
      revision: vesselRevisionsV2,
      vesselName: masterVessels.vesselName,
      vesselCode: masterVessels.vesselCode,
    })
    .from(vesselRevisionsV2)
    .leftJoin(masterVessels, eq(vesselRevisionsV2.vesselUuid, masterVessels.vesselUuid))
    .where(and(
      eq(vesselRevisionsV2.vesselUuid, vesselUuid),
      eq(vesselRevisionsV2.isDeleted, false)
    ))
    .orderBy(desc(vesselRevisionsV2.createdAt));
}
```

### 3.3 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v2/admin/vessels/:vesselUuid/revisions` | Get all revisions |
| GET | `/api/v2/admin/revisions/:revisionUuid` | Get single revision with ranks |
| POST | `/api/v2/admin/vessels/:vesselUuid/revisions` | Create new revision |
| PATCH | `/api/v2/admin/revisions/:revisionUuid` | Update revision |
| DELETE | `/api/v2/admin/revisions/:revisionUuid` | Soft delete |

### 3.4 Frontend Structure

```
client/src/modules/admin/
├── v2/
│   ├── AdminModule_v2.tsx        # Copy of AdminModule.tsx
│   ├── api/
│   │   └── adminApi.ts           # V2 API calls
│   └── index.ts
├── hooks/
│   └── useAdminVersion.ts        # Version toggle hook
├── AdminModule.tsx               # UNCHANGED
└── index.tsx                     # Router with version switch
```

---

## PHASE 4: VESSEL V2 MODULE

### 4.1 Backend Folder Structure

```
server/v2/vessel/
├── controllers/
│   ├── vesselPlanningController.ts
│   ├── planningAttachmentsController.ts
│   └── index.ts
├── repositories/
│   ├── vesselPlanningRepository.ts
│   ├── planningAttachmentsRepository.ts
│   └── index.ts
├── services/
│   ├── vesselPlanningService.ts
│   └── index.ts
├── routes.ts
└── index.ts
```

### 4.2 Multi-Table JOIN Example

**vesselPlanningRepository.ts:**
```typescript
// Single query resolves ALL FKs - no N+1
async getByVesselUuid(vesselUuid: string) {
  return db
    .select({
      planning: vesselPlanningV2,
      vesselName: masterVessels.vesselName,
      crewFirstName: crewMembersV2.firstName,
      crewFamilyName: crewMembersV2.familyName,
      relieverFirstName: relieverCrew.firstName,
      relieverFamilyName: relieverCrew.familyName,
      signOffPortName: signOffPort.portName,
      joiningPortName: joiningPort.portName,
    })
    .from(vesselPlanningV2)
    .leftJoin(masterVessels, eq(vesselPlanningV2.vesselUuid, masterVessels.vesselUuid))
    .leftJoin(crewMembersV2, eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid))
    .leftJoin(crewMembersV2.as('relieverCrew'), eq(vesselPlanningV2.relieverCrewUuid, relieverCrew.crewUuid))
    .leftJoin(masterPorts.as('signOffPort'), eq(vesselPlanningV2.signOffPortUuid, signOffPort.portUuid))
    .leftJoin(masterPorts.as('joiningPort'), eq(vesselPlanningV2.joiningPortUuid, joiningPort.portUuid))
    .where(and(
      eq(vesselPlanningV2.vesselUuid, vesselUuid),
      eq(vesselPlanningV2.isDeleted, false),
      eq(vesselPlanningV2.isArchived, false)
    ));
}
```

### 4.3 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v2/vessel/:vesselUuid/planning` | Get all planning records |
| GET | `/api/v2/vessel/planning/:planUuid` | Get single planning with attachments |
| POST | `/api/v2/vessel/:vesselUuid/planning` | Create planning record |
| PATCH | `/api/v2/vessel/planning/:planUuid` | Update planning |
| POST | `/api/v2/vessel/planning/:planUuid/archive` | Archive planning |

### 4.4 Frontend Structure

```
client/src/modules/vessel/
├── v2/
│   ├── VesselModule_v2.tsx
│   ├── VesselSideBar_v2.tsx
│   ├── ComplianceMatrixDialog_v2.tsx
│   ├── api/
│   │   └── vesselApi.ts
│   └── index.ts
├── hooks/
│   └── useVesselVersion.ts
├── VesselModule.tsx              # UNCHANGED
├── VesselSideBar.tsx             # UNCHANGED
├── ComplianceMatrixDialog.tsx    # UNCHANGED
└── index.tsx                     # Router with version switch
```

---

## PHASE 5: ROTATION V2 MODULE

### 5.1 Backend Folder Structure

```
server/v2/rotation/
├── controllers/
│   ├── rotationDraftsController.ts
│   ├── draftVesselsController.ts
│   ├── draftRanksController.ts
│   ├── rotationEntriesController.ts
│   ├── rotationArchiveController.ts
│   └── index.ts
├── repositories/
│   ├── rotationDraftsRepository.ts
│   ├── draftVesselsRepository.ts
│   ├── draftRanksRepository.ts
│   ├── rotationEntriesRepository.ts
│   ├── rotationArchiveRepository.ts
│   └── index.ts
├── services/
│   ├── rotationDraftsService.ts
│   ├── rotationDeployService.ts      # CRITICAL: syncs to vessel_planning_v2
│   ├── crewAvailabilityService.ts    # Queries crew_members_v2 by rank
│   └── index.ts
├── routes.ts
└── index.ts
```

### 5.2 Critical Endpoint: Crew by Rank (V2)

**routes.ts:**
```typescript
// This is the FIX for V2 crew visibility in rotation
router.get("/crew/by-rank/:rank", rotationCrewController.getByRank);
```

**crewAvailabilityService.ts:**
```typescript
async getCrewByRank(rank: string) {
  // Query V2 crew pool - this was the missing link!
  return db
    .select({
      crew: crewMembersV2,
      currentAssignment: crewAssignments,
    })
    .from(crewMembersV2)
    .leftJoin(crewAssignments, and(
      eq(crewAssignments.crewUuid, crewMembersV2.crewUuid),
      eq(crewAssignments.isCurrent, true)
    ))
    .where(and(
      eq(crewMembersV2.presentRank, rank),
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
      eq(crewMembersV2.status, 'Active')
    ));
}
```

### 5.3 Deploy Service (vessel_planning_v2 sync)

**rotationDeployService.ts:**
```typescript
async deployEntry(entryUuid: string, deployedByUuid: string) {
  return db.transaction(async (tx) => {
    // 1. Get entry with JOINs
    const entry = await tx.select(...)
      .from(rotationEntriesV2)
      .leftJoin(...)
      .where(eq(rotationEntriesV2.entryUuid, entryUuid));
    
    // 2. Update entry status
    await tx.update(rotationEntriesV2)
      .set({
        proposalStatus: 'Deployed',
        deployedByUuid,
        deployedDate: new Date().toISOString().split('T')[0],
      })
      .where(eq(rotationEntriesV2.entryUuid, entryUuid));
    
    // 3. Create/Update vessel_planning_v2 record
    const existingPlan = await tx.select()
      .from(vesselPlanningV2)
      .where(and(
        eq(vesselPlanningV2.vesselUuid, entry.vesselUuid),
        eq(vesselPlanningV2.rankId, entry.rankId),
        eq(vesselPlanningV2.isArchived, false)
      ));
    
    if (existingPlan.length > 0) {
      // Update with reliever info
      await tx.update(vesselPlanningV2)
        .set({
          relieverCrewUuid: entry.crewUuid,
          relieverSignOnDate: entry.signOnDate,
          joiningPortUuid: entry.joiningPortUuid,
          joiningStatus: 'Planned',
        })
        .where(eq(vesselPlanningV2.planUuid, existingPlan[0].planUuid));
    } else {
      // Create new planning record
      await tx.insert(vesselPlanningV2).values({
        planUuid: generateUuid(),
        vesselUuid: entry.vesselUuid,
        rankId: entry.rankId,
        rank: entry.rank,
        relieverCrewUuid: entry.crewUuid,
        relieverSignOnDate: entry.signOnDate,
        joiningPortUuid: entry.joiningPortUuid,
        joiningStatus: 'Planned',
      });
    }
    
    // 4. Archive the entry
    await tx.insert(rotationArchiveV2).values({...});
    
    return { success: true };
  });
}
```

### 5.4 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v2/rotation/drafts` | Get all drafts |
| GET | `/api/v2/rotation/drafts/:draftUuid` | Get draft with vessels, ranks, entries |
| POST | `/api/v2/rotation/drafts` | Create new draft |
| PATCH | `/api/v2/rotation/drafts/:draftUuid` | Update draft |
| POST | `/api/v2/rotation/drafts/:draftUuid/propose` | Propose draft |
| GET | `/api/v2/rotation/entries/:entryUuid` | Get single entry |
| POST | `/api/v2/rotation/entries` | Create entry |
| POST | `/api/v2/rotation/entries/:entryUuid/deploy` | **Deploy to vessel_planning_v2** |
| POST | `/api/v2/rotation/entries/:entryUuid/reject` | Reject entry |
| GET | `/api/v2/rotation/crew/by-rank/:rank` | **Get V2 crew for selection** |
| GET | `/api/v2/rotation/archive` | Get deployment history |

### 5.5 Frontend Structure

```
client/src/modules/rotation/
├── v2/
│   ├── RotationModule_v2.tsx
│   ├── RotationSideBar_v2.tsx
│   ├── RotationPlanTable_v2.tsx
│   ├── NewPlanDialog_v2.tsx
│   ├── ApprovalTable_v2.tsx
│   ├── DueCrewTable_v2.tsx
│   ├── api/
│   │   └── rotationApi.ts
│   └── index.ts
├── hooks/
│   └── useRotationVersion.ts
├── RotationModule.tsx            # UNCHANGED
├── RotationSideBar.tsx           # UNCHANGED
├── RotationPlanTable.tsx         # UNCHANGED
├── NewPlanDialog.tsx             # UNCHANGED
├── ApprovalTable.tsx             # UNCHANGED
├── DueCrewTable.tsx              # UNCHANGED
└── index.tsx                     # Router with version switch
```

---

## PHASE 6: INTEGRATION & TESTING

### 6.1 V2 Crew Visibility Fix

The critical fix for V2 crew visibility in rotation:

**Before (V1 only):**
```typescript
// server/routes.ts line 6878
app.get("/api/rotation/crew/by-rank/:rank", async (req, res) => {
  const crew = await storage.getCrewMembers();  // V1 only!
  // ...
});
```

**After (V2 endpoint):**
```typescript
// server/v2/rotation/routes.ts
router.get("/crew/by-rank/:rank", async (req, res) => {
  const crew = await crewAvailabilityService.getCrewByRank(req.params.rank);
  // Returns V2 crew_members_v2 data!
});
```

### 6.2 Performance Logging

Add timing to all repositories:
```typescript
async getByVesselUuid(vesselUuid: string) {
  const start = performance.now();
  const result = await db.select(...);
  console.log(`[PERF] vesselPlanningRepository.getByVesselUuid: ${performance.now() - start}ms`);
  return result;
}
```

### 6.3 Parity Tests

| Test | V1 Input | Expected V2 Output |
|------|----------|-------------------|
| Get revisions | vesselId: "VSL-001" | Same revision list |
| Get planning | vesselId: "VSL-001" | Same crew assignments |
| Deploy crew | entryUuid + crewUuid | vessel_planning_v2 updated |
| Crew by rank | rank: "Master" | V2 crew list (not empty!) |

### 6.4 Version Toggle Testing

1. Admin: Switch between Legacy and V2, verify same data displayed
2. Vessel: Switch between Legacy and V2, verify same planning data
3. Rotation: Switch between Legacy and V2, verify crew selection works in both

### 6.5 Integration Verification

1. Transfer candidate from Recruitment V2 to Crew Pool V2
2. Verify crew visible in Rotation V2 by-rank endpoint
3. Create rotation draft in V2
4. Deploy crew in V2
5. Verify crew appears in Vessel V2 planning

---

## Effort Estimates

| Phase | Backend Hours | Frontend Hours | Total |
|-------|---------------|----------------|-------|
| Phase 1 | 4 | 0 | 4 |
| Phase 2 | 4 | 0 | 4 |
| Phase 3 | 6 | 4 | 10 |
| Phase 4 | 8 | 4 | 12 |
| Phase 5 | 12 | 6 | 18 |
| Phase 6 | 4 | 2 | 6 |
| **Total** | **38** | **16** | **54** |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| V1/V2 data drift | High | Feature flag to run both in parallel |
| Performance regression | Medium | Benchmark queries, add indexes |
| Missing FK data | Medium | LEFT JOINs, graceful null handling |
| Breaking existing V1 | High | Don't modify V1 code, separate V2 endpoints |

---

## Definition of Done

Each phase is complete when:
1. ✅ All migrations run without error
2. ✅ All V2 endpoints return data matching V1 format
3. ✅ Performance within 20% of V1
4. ✅ Version toggle switch works in UI
5. ✅ Legacy UI unchanged
6. ✅ Integration tests pass

---

## Next Steps

1. Review this plan
2. Confirm column counts match attached schema documents
3. Begin Phase 1: Legacy Analysis
4. Create migration files one by one with approval
