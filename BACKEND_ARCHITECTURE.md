# Backend Architecture Documentation
## Seafarer Performance Management System

### VERIFIED: November 13, 2025

---

## 1. DATA MODELS & SCHEMAS

### Core Entities: **31 Tables** (Updated from 28)

The system uses **31 core database tables** defined in `shared/schema.ts`:

#### Authentication & Users (1 table)
- `users`

#### Forms & Rankings (5 tables)
- `forms`
- `rankGroups`
- `availableRanks`
- `companyRanks`
- `promotionHierarchies`

#### Crew Management (3 tables)
- `crewMembers`
- `appraisalResults`
- `recruitmentCandidates`

#### Vessels & Infrastructure (7 tables)
- `vessels`
- `vesselGroups`
- `vesselDrafts`
- `vesselRevisions`
- `seafarers` (legacy)
- `revisions` (legacy)
- `vesselRanks`

#### Planning & Rotation (3 tables)
- `vesselPlanning`
- `rotationPlans`
- `idCounters`

#### Rest Hours Compliance (3 tables)
- `restHoursVesselRecords` (vessel-level monthly summaries)
- `restHoursCrewRecords` (crew-level monthly records)
- `restHoursDailyRecords` (daily detailed records)

#### Tasks & Work Planning (3 tables)
- `fixedTasks`
- `variableTasks`
- `drugAlcoholTestRecords`

#### Violations & Compliance (4 tables)
- `vesselViolationComments`
- `officeViolationComments`
- `ncReports`
- `vesselDateLineAdjustments`

#### Master Data (2 tables)
- `dataMasters`
- `masterDataEntries`

---

## 2. IStorage INTERFACE

### Total Methods: **140** (Updated from 92)

The complete `IStorage` interface is defined in `server/storage.ts` (lines 6-173) with the following breakdown:

#### Users & Authentication (3 methods)
- `getUser`, `getUserByUsername`, `createUser`

#### Forms Management (9 methods)
- `getForms`, `getForm`, `createForm`, `updateForm`, `deleteForm`
- `getRankGroups`, `createRankGroup`, `updateRankGroup`, `deleteRankGroup`
- `getFormForRank`

#### Available Ranks (6 methods)
- `getAvailableRanks`, `createAvailableRank`, `updateAvailableRank`
- `deleteAvailableRank`, `clearAllAvailableRanks`, `updateRankOrders`

#### Company Ranks (7 methods)
- `getCompanyRanks`, `getCompanyRank`, `createCompanyRank`
- `updateCompanyRank`, `deleteCompanyRank`, `clearAllCompanyRanks`, `saveAllCompanyRanks`

#### Promotion Hierarchies (5 methods)
- `getPromotionHierarchies`, `getPromotionHierarchy`, `createPromotionHierarchy`
- `updatePromotionHierarchy`, `deletePromotionHierarchy`

#### Crew Members (6 methods)
- `getCrewMembers`, `getCrewMember`, `createCrewMember`
- `updateCrewMember`, `deleteCrewMember`, `getNextCrewId`

#### Appraisal Results (7 methods)
- `getAppraisalResults`, `getAppraisalResult`, `getAppraisalResultsByCrewMember`
- `createAppraisalResult`, `updateAppraisalResult`, `deleteAppraisalResult`, `submitAppraisalStage`

#### Recruitment Candidates (7 methods)
- `getRecruitmentCandidates`, `getRecruitmentCandidate`, `getRecruitmentCandidatesByStatus`
- `createRecruitmentCandidate`, `updateRecruitmentCandidate`, `deleteRecruitmentCandidate`
- `transferRecruitedCandidate`

#### Master Data (10 methods)
- **Data Masters**: `getDataMasters`, `getDataMaster`, `createDataMaster`, `updateDataMaster`, `deleteDataMaster`
- **Master Entries**: `getMasterDataEntries`, `getMasterDataEntry`, `createMasterDataEntry`, `updateMasterDataEntry`, `deleteMasterDataEntry`

#### Vessel Groups (5 methods)
- `getVesselGroups`, `getVesselGroup`, `createVesselGroup`
- `updateVesselGroup`, `deleteVesselGroup`

#### Vessel Drafts (6 methods)
- `getVesselDrafts`, `getVesselDraft`, `getVesselDraftsByVessel`
- `createVesselDraft`, `updateVesselDraft`, `deleteVesselDraft`

#### Vessel Revisions (4 methods)
- `getVesselRevisions`, `getVesselRevision`, `getVesselRevisionsByVessel`, `createVesselRevision`

#### Vessel Planning (5 methods)
- `getVesselPlanningByVessel`, `getVesselPlanningById`, `createVesselPlanning`
- `updateVesselPlanning`, `deleteVesselPlanning`

#### Dashboard & Summary (1 method)
- `getCrewDashboardSummary`

#### Rotation Plans (5 methods)
- `getRotationPlans`, `getRotationPlan`, `createRotationPlan`
- `updateRotationPlan`, `deleteRotationPlan`

#### Rotation Workflow (5 methods)
- `proposeRotationPlan`, `getProposedAssignments`, `deployAssignment`
- `rejectAssignment`, `checkAssignmentConflicts`

#### Drug & Alcohol Tests (6 methods)
- `getDrugAlcoholTestRecords`, `getDrugAlcoholTestRecord`, `getDrugAlcoholTestRecordsByVessel`
- `createDrugAlcoholTestRecord`, `updateDrugAlcoholTestRecord`, `deleteDrugAlcoholTestRecord`

#### Rest Hours - Vessel Records (6 methods)
- `getRestHoursVesselRecords`, `getRestHoursVesselRecord`, `getRestHoursVesselRecordsByFilters`
- `createRestHoursVesselRecord`, `updateRestHoursVesselRecord`, `deleteRestHoursVesselRecord`

#### Rest Hours - Crew Records (6 methods)
- `getRestHoursCrewRecords`, `getRestHoursCrewRecord`, `getRestHoursCrewRecordsByFilters`
- `createRestHoursCrewRecord`, `updateRestHoursCrewRecord`, `deleteRestHoursCrewRecord`

#### Rest Hours - Daily Records (6 methods)
- `getRestHoursDailyRecords`, `getRestHoursDailyRecord`, `getRestHoursDailyRecordByKey`
- `createRestHoursDailyRecord`, `updateRestHoursDailyRecord`, `deleteRestHoursDailyRecord`

#### Variable Tasks (6 methods)
- `getVariableTasks`, `getVariableTask`, `getVariableTasksByFilters`
- `createVariableTask`, `updateVariableTask`, `deleteVariableTask`

#### Fixed Tasks (7 methods)
- `getFixedTasks`, `getFixedTask`, `getFixedTasksByVesselAndMonth`, `getFixedTaskByKey`
- `createFixedTask`, `updateFixedTask`, `deleteFixedTask`

#### Vessel Violation Comments (2 methods)
- `getVesselViolationComment`, `saveVesselViolationComment`

#### Office Violation Comments (2 methods)
- `getOfficeViolationComment`, `saveOfficeViolationComment`

#### NC Reports (3 methods)
- `getAllNCReports`, `getNCReport`, `saveNCReport`

#### Date Line Adjustments (4 methods)
- `getVesselDateLineAdjustment`, `saveVesselDateLineAdjustment`
- `deleteVesselDateLineAdjustment`, `clearAdvancedDaysData`

---

## 3. STORAGE IMPLEMENTATIONS

### Current Active Implementation: ✅ **PersistentFileStorage**

```typescript
// server/storage.ts (line 5551)
storage = new PersistentFileStorage();
```

### Implementation Details

#### PersistentFileStorage (ACTIVE - Fully Functional)
- **Location**: `server/storage.ts` lines 2574-5032
- **Status**: ✅ **100% Complete** - implements all 140 IStorage methods
- **Persistence**: JSON file (`test-data.json`)
- **Architecture**:
  - Extends in-memory Map-based storage pattern
  - Automatic `saveToFile()` after every CREATE/UPDATE/DELETE operation
  - Automatic `loadFromFile()` in constructor
  - Atomic write operations with error handling
  - 31 Map collections for all entities

**Key Methods**:
```typescript
private async saveToFile(): Promise<void>
private async loadFromFile(): Promise<void>
```

**Data File**: `test-data.json` (auto-created if missing)

#### DatabaseStorage (DISABLED)
- **Location**: `server/database.ts` lines 35-1511
- **Status**: ⚠️ **DISABLED** - marked as "incomplete legacy code"
- **Database**: MySQL via Drizzle ORM
- **Configuration**: Requires `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **Current State**: 
  ```typescript
  // Line 5451: DatabaseStorage is disabled
  throw new Error("DatabaseStorage is disabled - incomplete legacy code");
  ```

---

## 4. CRITICAL DATA RELATIONSHIPS

### Foreign Key Relationships

```
CrewMember (id: "A0001")
  ├── AppraisalResults (crewMemberId FK → crewMembers.id)
  ├── VesselPlanning (crewMemberId FK → crewMembers.id)  ← SINGLE SOURCE OF TRUTH
  ├── RestHoursCrewRecords (crewMemberId FK → crewMembers.id)
  ├── RestHoursDailyRecords (crewMemberId FK → crewMembers.id)
  ├── FixedTasks (crewMemberId FK → crewMembers.id)
  └── NCReports (crewMemberId FK → crewMembers.id)

Form (id: number)
  ├── RankGroups (formId FK → forms.id)
  └── AppraisalResults (formId FK → forms.id)

Vessel (vesselId: string)
  ├── VesselPlanning
  ├── VesselRevisions
  ├── RestHoursVesselRecords
  ├── VesselViolationComments
  └── OfficeViolationComments

DataMaster (id: string)
  └── MasterDataEntries (masterId FK → dataMasters.id)
```

---

## 5. API ENDPOINTS → STORAGE MAPPING

### Top 25 Most Used Endpoints

```
GET  /api/crew-members              → getCrewMembers()
POST /api/crew-members              → createCrewMember()
GET  /api/crew-members/:id          → getCrewMember(id)
PUT  /api/crew-members/:id          → updateCrewMember(id, data)
DELETE /api/crew-members/:id        → deleteCrewMember(id)

GET  /api/forms                     → getForms()
POST /api/forms                     → createForm(form)
GET  /api/forms/for-rank/:rank      → getFormForRank(rankLabel, category)

GET  /api/appraisals                → getAppraisalResults()
GET  /api/appraisals/crew/:id       → getAppraisalResultsByCrewMember(id)
POST /api/appraisals                → createAppraisalResult(result)
POST /api/appraisals/:id/submit/:stage → submitAppraisalStage(id, stage, data, by)

GET  /api/company-ranks             → getCompanyRanks()
POST /api/company-ranks/save-all    → saveAllCompanyRanks(ranks)

GET  /api/vessel-planning/vessel/:id → getVesselPlanningByVessel(id)
POST /api/vessel-planning           → createVesselPlanning(planning)
PUT  /api/vessel-planning/:id       → updateVesselPlanning(id, planning)

GET  /api/rotation-plans            → getRotationPlans()
POST /api/rotation-plans            → createRotationPlan(plan)
POST /api/rotation/proposals/deploy → deployAssignment(planId, index, by)

GET  /api/rest-hours-vessel-records → getRestHoursVesselRecords()
GET  /api/rest-hours-crew-records   → getRestHoursCrewRecords()
POST /api/rest-hours-daily-records  → createRestHoursDailyRecord(record)

GET  /api/nc-reports/all            → getAllNCReports()
POST /api/nc-reports                → saveNCReport(report)

GET  /api/recruitment-candidates    → getRecruitmentCandidates()
POST /api/recruitment-candidates/:id/transfer → transferRecruitedCandidate(id)
```

---

## 6. SYSTEM ARCHITECTURE FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React + Vite)                    │
│           TanStack Query v5 + Wouter Routing                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTP/REST API
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Express.js)                      │
│                     server/routes.ts                        │
│                     (5574 lines)                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ IStorage Interface (140 methods)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              PersistentFileStorage (ACTIVE)                 │
│               server/storage.ts (5558 lines)                │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │   31 In-Memory Maps                                   │ │
│  │   - users, forms, rankGroups, availableRanks...       │ │
│  │   - crewMembers, appraisalResults, recruitmentCandidates  
│  │   - vessels, vesselPlanning, rotationPlans...         │ │
│  │   - restHours*, fixedTasks, variableTasks...          │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                  │
│                          │ saveToFile() after every write   │
│                          │ loadFromFile() on startup        │
│                          ▼                                  │
│                  test-data.json                            │
│              (Persisted JSON Storage)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. PERSISTENCE MECHANISM

### How PersistentFileStorage Works

1. **Initialization** (`constructor`):
   ```typescript
   - Creates 31 empty Map objects for each entity
   - Calls loadFromFile() to restore state from test-data.json
   - If file doesn't exist, starts with empty maps
   ```

2. **Data Operations**:
   ```typescript
   CREATE → map.set(id, entity) → saveToFile()
   UPDATE → map.set(id, updatedEntity) → saveToFile()
   DELETE → map.delete(id) → saveToFile()
   READ   → map.get(id)  // No file I/O
   ```

3. **File Format** (`test-data.json`):
   ```json
   {
     "users": [...],
     "forms": [...],
     "crewMembers": [...],
     "appraisalResults": [...],
     // ... 31 entity collections
   }
   ```

4. **Atomicity**:
   - All writes are serialized
   - File is completely rewritten on each save
   - Error handling prevents data corruption

---

## 8. PRODUCTION CONSIDERATIONS

### Current Status: Development-Ready ✅

**Pros**:
- ✅ Zero database setup required
- ✅ All 140 IStorage methods fully implemented
- ✅ Data persists across server restarts
- ✅ Perfect for development and prototyping
- ✅ Easy debugging (human-readable JSON)

**Cons for Production**:
- ⚠️ Single file bottleneck (no concurrent writes)
- ⚠️ Full file rewrite on every change (inefficient for large datasets)
- ⚠️ No transactions or ACID guarantees
- ⚠️ Limited query performance (in-memory filtering only)
- ⚠️ No built-in backup/recovery

### Upgrade Path to Production

**Option A: Complete DatabaseStorage Implementation**
- Uncomment and fix DatabaseStorage (currently disabled)
- Implement all 140 IStorage methods for MySQL/PostgreSQL
- Add Drizzle migrations
- Test thoroughly

**Option B: Enhance PersistentFileStorage**
- Add incremental writes (append-only log)
- Implement snapshotting + compaction
- Add automatic backups
- Add index support for faster queries

**Option C: Hybrid Approach**
- Keep PersistentFileStorage for development
- Use DatabaseStorage for production
- Same IStorage interface = zero code changes

---

## 9. RECOMMENDATION

### ✅ **USE EXISTING PersistentFileStorage** 

The current implementation is **100% functional** and ready for immediate use:

1. **Already Active**: `storage = new PersistentFileStorage()`
2. **Fully Implemented**: All 140 IStorage methods work correctly
3. **Persistent**: Data survives server restarts via test-data.json
4. **Zero Setup**: No database configuration required
5. **Production Path Clear**: Can migrate to DatabaseStorage later without code changes

**Next Steps**:
- ✅ Continue using PersistentFileStorage for development
- ✅ Build and test all features
- ⏭️ When ready for production, implement/fix DatabaseStorage
- ⏭️ Switch storage implementation with a single line change

---

## 10. KEY TECHNICAL NOTES

### Verified Implementation Details

1. **Current Storage**: `PersistentFileStorage` (line 5551 in server/storage.ts)
2. **Data File**: `test-data.json` (auto-managed)
3. **Total Methods**: 140 IStorage interface methods
4. **Total Entities**: 31 database tables in shared/schema.ts
5. **Database Status**: DatabaseStorage disabled as "incomplete legacy code"
6. **Architecture**: Module-first, separation of concerns, scalable design

### Performance Characteristics

- **Read Operations**: O(1) - direct Map lookups
- **Write Operations**: O(n) - full file serialization
- **Query Operations**: O(n) - in-memory filtering
- **Startup Time**: O(n) - full JSON parse on load

---

**Documentation Generated**: November 13, 2025  
**System**: Seafarer Performance Management System  
**Version**: Development (JSON Persistence)  
**Status**: ✅ Fully Functional
