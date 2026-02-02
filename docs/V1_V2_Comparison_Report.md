# V1 vs V2 Comparison Report
## Rotation and Vessel Module Migration

**Generated:** February 2026

---

## Executive Summary

Both the Rotation and Vessel modules have been fully migrated to V2 architecture with complete API coverage. V2 provides better separation of concerns, UUID-based identifiers, normalized data with proper foreign key relationships, and dedicated V2 tables to avoid V1 data contamination.

---

## Rotation Module

### Architecture Comparison

| Feature | V1 | V2 | Status |
|---------|----|----|--------|
| **Architecture** | Mixed storage (in-memory + DB) | Repository + Service + Controller pattern | ✅ V2 Complete |
| **Identifiers** | Integer IDs | UUIDs | ✅ V2 Complete |
| **Database Tables** | `rotation_plans` | `rotation_drafts_v2`, `rotation_draft_vessels_v2`, `rotation_draft_ranks_v2`, `rotation_entries_v2`, `rotation_archive_v2` | ✅ V2 Complete |
| **Crew Data Source** | V1 crew_members | crew_members_v2 via crew_assignments | ✅ V2 Complete |

### Frontend Components

| Component | V1 File | V2 File | Status |
|-----------|---------|---------|--------|
| Main Module | `RotationModule.tsx` | `RotationModule_v2.tsx` | ✅ Implemented |
| Sidebar | `RotationSideBar.tsx` | `RotationSideBar_v2.tsx` | ✅ Implemented |
| Plan Table | `RotationPlanTable.tsx` | `RotationPlanTable_v2.tsx` | ✅ Implemented |
| New Plan Dialog | `NewPlanDialog.tsx` | `NewPlanDialog_v2.tsx` | ✅ Implemented |
| Approval Table | `ApprovalTable.tsx` | `ApprovalTable_v2.tsx` | ✅ Implemented |
| Due Crew Table | `DueCrewTable.tsx` | `DueCrewTable_v2.tsx` | ✅ Implemented |

### API Endpoints

| Operation | V1 Endpoint | V2 Endpoint | Status |
|-----------|-------------|-------------|--------|
| Get crew by rank | `/api/crew-pool?rank=X` | `/api/v2/rotation/crew/by-rank/:rank` | ✅ V2 Complete |
| List drafts | `/api/rotation-plans` | `/api/v2/rotation/drafts` | ✅ V2 Complete |
| Get single draft | `/api/rotation-plans/:id` | `/api/v2/rotation/drafts/:draftUuid` | ✅ V2 Complete |
| Create draft | `POST /api/rotation-plans` | `POST /api/v2/rotation/drafts` | ✅ V2 Complete |
| Update draft | `PATCH /api/rotation-plans/:id` | `PATCH /api/v2/rotation/drafts/:draftUuid` | ✅ V2 Complete |
| Delete draft | `DELETE /api/rotation-plans/:id` | `DELETE /api/v2/rotation/drafts/:draftUuid` | ✅ V2 Complete |
| Propose draft | `POST /api/rotation-plans/:id/propose` | `POST /api/v2/rotation/drafts/:draftUuid/propose` | ✅ V2 Complete |
| Get proposals | `/api/rotation/proposals` | `/api/v2/rotation/proposals` | ✅ V2 Complete |
| Deploy assignment | `POST /api/rotation/proposals/deploy` | `POST /api/v2/rotation/entries/:entryUuid/deploy` | ✅ V2 Complete |
| Reject assignment | `POST /api/rotation/proposals/reject` | `POST /api/v2/rotation/entries/:entryUuid/reject` | ✅ V2 Complete |
| Add vessel to draft | N/A (embedded in plan) | `POST /api/v2/rotation/drafts/:draftUuid/vessels` | ✅ V2 Complete |
| Remove vessel from draft | N/A (embedded in plan) | `DELETE /api/v2/rotation/draft-vessels/:rvUuid` | ✅ V2 Complete |
| Add rank to draft | N/A (embedded in plan) | `POST /api/v2/rotation/drafts/:draftUuid/ranks` | ✅ V2 Complete |
| Remove rank from draft | N/A (embedded in plan) | `DELETE /api/v2/rotation/draft-ranks/:rrUuid` | ✅ V2 Complete |
| Get archive | N/A | `/api/v2/rotation/archive` | ✅ V2 Complete |

---

## Vessel Module

### Architecture Comparison

| Feature | V1 | V2 | Status |
|---------|----|----|--------|
| **Architecture** | Monolithic component | Repository + Service + Controller pattern | ✅ V2 Complete |
| **Identifiers** | Integer IDs | UUIDs (planUuid) | ✅ V2 Complete |
| **Database Tables** | `vessel_planning` | `vessel_planning_v2`, `vessel_planning_attachments_v2` | ✅ V2 Complete |
| **Crew Data Source** | V1 crew_members | crew_members_v2, crew_assignments, crew_personal_details | ✅ V2 Complete |

### Frontend Components

| Component | V1 File | V2 File | Status |
|-----------|---------|---------|--------|
| Main Module | `VesselModule.tsx` | `VesselModule_v2.tsx` | ✅ Implemented |
| Sidebar | `VesselSideBar.tsx` | `VesselSideBar_v2.tsx` | ✅ Implemented |
| Compliance Matrix | Embedded in VesselModule | `ComplianceMatrixDialog_v2.tsx` | ✅ Implemented |
| On-Board Edit Dialog | Embedded | `OnBoardStatusEditDialog_v2.tsx` | ✅ Implemented |
| Relief Edit Dialog | Embedded | `ReliefStatusEditDialog_v2.tsx` | ✅ Implemented |

### API Endpoints

| Operation | V1 Endpoint | V2 Endpoint | Status |
|-----------|-------------|-------------|--------|
| Get vessel list | `/api/vessels` | `/api/v2/vessel/list` | ✅ V2 Complete |
| Get crew counts | N/A | `/api/v2/vessel/crew-counts` | ✅ V2 Complete |
| Get all planning (conflicts) | N/A | `/api/v2/vessel/planning` | ✅ V2 Complete |
| Get vessel planning | `/api/vessel-planning/vessel/:vesselId` | `/api/v2/vessel/:vesselUuid/planning` | ✅ V2 Complete |
| Get single plan | `/api/vessel-planning/:id` | `/api/v2/vessel/planning/:planUuid` | ✅ V2 Complete |
| Create plan | `POST /api/vessel-planning` | `POST /api/v2/vessel/:vesselUuid/planning` | ✅ V2 Complete |
| Update plan | `PATCH /api/vessel-planning/:id` | `PATCH /api/v2/vessel/planning/:planUuid` | ✅ V2 Complete |
| Archive plan | N/A | `POST /api/v2/vessel/planning/:planUuid/archive` | ✅ V2 Complete |
| Sign-on reliever | Embedded in PATCH | `POST /api/v2/vessel/planning/:planUuid/sign-on` | ✅ V2 Complete |
| Update reliever status | Embedded | `PATCH /api/v2/vessel/planning/:planUuid/reliever-status` | ✅ V2 Complete |
| Sign-off crew | Embedded in PATCH | `POST /api/v2/vessel/planning/:planUuid/sign-off` | ✅ V2 Complete |
| Get attachments | `/api/vessel-planning/:id/handover-attachments` | `/api/v2/vessel/planning/:planUuid/attachments` | ✅ V2 Complete |
| Add attachment | `POST /api/vessel-planning/:id/handover-attachments` | `POST /api/v2/vessel/planning/:planUuid/attachments` | ✅ V2 Complete |
| Delete attachment | `DELETE /api/vessel-planning/:id/handover-attachments/:id` | `DELETE /api/v2/vessel/planning/:planUuid/attachments/:attUuid` | ✅ V2 Complete |
| Officer Matrix data | N/A (frontend only) | `/api/v2/vessel/officer-matrix/:crewUuid` | ✅ V2 Complete |
| Compliance Matrix | N/A (frontend calculation) | `/api/v2/vessel/compliance/matrix/:vesselUuid` | ✅ V2 Complete |
| Simulated Compliance | N/A | `POST /api/v2/vessel/compliance/matrix/:vesselUuid/simulated` | ✅ V2 Complete |
| Training Matrix | N/A (frontend only) | `/api/v2/vessel/training/:vesselUuid` | ✅ V2 Complete |

---

## Key Architectural Differences

| Aspect | V1 | V2 |
|--------|----|----|
| **Data Isolation** | Shares tables with other modules | Uses dedicated V2 tables only |
| **Delete Strategy** | Hard delete all records | Hard delete for drafts, soft delete for proposed/completed (audit trail) |
| **Port Storage** | Stored port names directly | Stores validated port UUIDs via `resolvePortToUuid()` |
| **Conflict Detection** | Frontend calculation | Backend endpoint with pre-computed fields |
| **Crew Deployment** | Single step | Two-stage workflow (Deploy → Sign On) |
| **Assignment Tracking** | Via vessel_planning only | Via crew_assignments with `isCurrent` flag |
| **Code Organization** | Single large component file | Separated controllers, services, repositories |

---

## V2 Database Tables

### Rotation V2 Tables
- `rotation_drafts_v2` - Main draft records with UUID primary key
- `rotation_draft_vessels_v2` - Vessels associated with a draft
- `rotation_draft_ranks_v2` - Ranks associated with a draft
- `rotation_entries_v2` - Individual crew rotation entries
- `rotation_archive_v2` - Archived rotation records

### Vessel V2 Tables
- `vessel_planning_v2` - Vessel planning records with UUID primary key
- `vessel_planning_attachments_v2` - Attachments linked to planning records

### Shared V2 Tables (Crew Pool V2)
- `crew_members_v2` - Core crew data
- `crew_assignments` - Crew-to-vessel assignments with `isCurrent` tracking
- `crew_personal_details` - Personal information
- `crew_sea_service` - Sea service history
- `crew_licenses` - License records
- `crew_training_courses` - Training certifications
- `crew_documents` - Document records
- `crew_visas` - Visa records

---

## Version Toggle System

Both modules support runtime switching between V1 and V2 via localStorage:

- **Rotation**: `localStorage.getItem('rotation_module_version')` → 'v1' or 'v2'
- **Vessel**: `localStorage.getItem('vessel_module_version')` → 'v1' or 'v2'

Toggle components:
- `RotationVersionToggle` - UI switch for Rotation module
- `VesselVersionToggle` - UI switch for Vessel module

Version hooks:
- `useRotationVersion()` - Returns `{ isV2, toggleVersion }`
- `useVesselVersion()` - Returns `{ isV2, toggleVersion }`

---

## Benefits of V2 Architecture

1. **Better Separation of Concerns** - Repository + Service + Controller pattern
2. **UUID-based Identifiers** - Better for distributed systems and uniqueness
3. **Normalized Data** - Proper foreign key relationships
4. **Dedicated V2 Tables** - No V1 data contamination
5. **Improved Workflows** - Two-stage crew deployment (Deploy → Sign On)
6. **Server-side Calculations** - Compliance and conflict detection on backend
7. **Soft Delete Support** - Audit trail for proposed/completed records
8. **Data Integrity** - Port UUIDs validated and resolved at storage time

---

## Migration Notes

### Port UUID Resolution
The `resolvePortToUuid()` function handles legacy data migration:
- If input matches UUID pattern → returns immediately (optimized)
- If input is port name → looks up in `master_ports` table
- Returns `null` if unmatched to prevent invalid data

### Delete Behavior
- **Draft/In Draft status**: Hard delete (no audit trail needed)
- **Proposed/Completed status**: Soft delete (`is_deleted = true`)

### Query Invalidation Keys
- Rotation: `['/api/v2/rotation', 'drafts']`
- Vessel Planning: `['/api/v2/vessel', vesselId, 'planning']` with `refetchType: 'all'`

---

## File Structure Reference

### V2 Rotation Backend
```
server/v2/rotation/
├── index.ts
├── routes.ts
├── controllers/
│   ├── index.ts
│   └── rotationController.ts
├── services/
│   ├── index.ts
│   ├── rotationDraftsService.ts
│   ├── rotationDeployService.ts
│   └── crewAvailabilityService.ts
└── repositories/
    ├── index.ts
    ├── rotationDraftsRepository.ts
    └── rotationEntriesRepository.ts
```

### V2 Vessel Backend
```
server/v2/vessel/
├── index.ts
├── routes.ts
├── controllers/
│   ├── index.ts
│   ├── vesselPlanningController.ts
│   ├── vesselCrewCountController.ts
│   ├── vesselListController.ts
│   ├── complianceController.ts
│   └── trainingController.ts
├── services/
│   ├── index.ts
│   └── vesselPlanningService.ts
└── repositories/
    ├── index.ts
    └── vesselPlanningRepository.ts
```

### V2 Frontend Components
```
client/src/modules/rotation/v2/
├── RotationModule_v2.tsx
├── RotationSideBar_v2.tsx
├── RotationPlanTable_v2.tsx
├── NewPlanDialog_v2.tsx
├── ApprovalTable_v2.tsx
└── DueCrewTable_v2.tsx

client/src/modules/vessel/v2/
├── VesselModule_v2.tsx
├── VesselSideBar_v2.tsx
├── ComplianceMatrixDialog_v2.tsx
└── components/
    ├── OnBoardStatusEditDialog_v2.tsx
    └── ReliefStatusEditDialog_v2.tsx
```
