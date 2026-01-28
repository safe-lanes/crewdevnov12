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

### 1.3 Current V2 API Endpoints

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

---

## Section 2: Gap Analysis

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

## Section 3: Data Flow Diagrams

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

## Section 4: Implementation Tasks

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

## Section 5: Database Schema Considerations

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

## Section 6: Acceptance Criteria

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

## Section 7: Testing Checklist

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

## Section 8: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking V1 crew rotation | Low | High | Test V1 crew thoroughly; don't modify V1 query |
| Duplicate crew in selection | Medium | Low | Deduplicate by empNo/id in merge logic |
| Transaction failure on deployment | Low | High | Wrap all inserts in single transaction |
| Performance impact from dual queries | Low | Low | Parallel queries; consider caching |
| Master Data inconsistency | Medium | Medium | Validate against Master 022/014 before operations |

---

## Section 9: Implementation Order

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

## Section 10: Key File References

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
