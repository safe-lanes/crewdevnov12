# Vessel Foreign-Key Column Naming Consistency Audit

> **Audit Date**: 2026-06-26  
> **Scope**: All schema files under `shared/v2/` and `shared/schema.ts`  
> **Status**: READ-ONLY discovery — no code changes made

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Total schema files scanned | 13 (`shared/v2/*/schema.ts`) + 1 (`shared/schema.ts`) |
| Total tables with a vessel-reference column | **27** |
| Total distinct DB column naming variants | **4** (`vessel_uuid`, `vessel_id`, `vessel_assigned`, `vessel`) |
| Total distinct Drizzle property naming variants | **4** (`vesselUuid`, `vesselId`, `vesselAssigned`, `vessel`) |
| Underlying SQL type variants | **1** (all are `text`) |
| Tables with enforced FK constraint | **0** |
| Tables with formal index on vessel column | **1** (rh_daily_records_v2 via composite unique index) |

> [!WARNING]
> **No table has a real FK constraint** referencing the `master_vessels` table. Every vessel column is a loosely-typed `text` field with no referential integrity enforcement. This means orphaned vessel references are silently allowed everywhere.

> [!IMPORTANT]
> **Naming is split almost equally** between `vessel_uuid` (11 tables) and `vessel_id` (12 tables), with 2 outliers (`vessel_assigned`, bare `vessel`). The "majority convention" analysis is in Section 3.

---

## 2. Full Inventory

### 2.1 Tables Using `vessel_uuid` (DB column name) — 11 tables

| # | Table Name | Drizzle Property | DB Column | Type | FK? | Nullable? | Indexed? | File:Line |
|---|---|---|---|---|---|---|---|---|
| 1 | `vessel_planning_v2` | `vesselUuid` | `vessel_uuid` | text | No | NOT NULL | No | [vessel/schema.ts:17](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/vessel/schema.ts#L17) |
| 2 | `rotation_draft_vessels_v2` | `vesselUuid` | `vessel_uuid` | text | No | NOT NULL | No | [rotation/schema.ts:41](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rotation/schema.ts#L41) |
| 3 | `rotation_entries_v2` | `vesselUuid` | `vessel_uuid` | text | No | NOT NULL | No | [rotation/schema.ts:59](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rotation/schema.ts#L59) |
| 4 | `rotation_archive_v2` | `vesselUuid` | `vessel_uuid` | text | No | NOT NULL | No | [rotation/schema.ts:88](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rotation/schema.ts#L88) |
| 5 | `crew_assignments` | `vesselUuid` | `vessel_uuid` | text | No | Nullable | No | [crew-pool/schema.ts:82](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L82) |
| 6 | `crew_sea_service` | `vesselUuid` | `vessel_uuid` | text | No | Nullable | No | [crew-pool/schema.ts:351](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L351) |
| 7 | `crew_pre_joining_medicals` | `vesselUuid` | `vessel_uuid` | text | No | Nullable | No | [crew-pool/schema.ts:386](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L386) |
| 8 | `crew_briefings` | `vesselUuid` | `vessel_uuid` | text | No | Nullable | No | [crew-pool/schema.ts:452](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L452) |
| 9 | `crew_debriefings` | `vesselUuid` | `vessel_uuid` | text | No | Nullable | No | [crew-pool/schema.ts:478](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L478) |
| 10 | `cand_sea_service` | `vesselUuid` | `vessel_uuid` | text | No | Nullable | No | [recruitment/schema.ts:269](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/recruitment/schema.ts#L269) |
| 11 | `master_vessels` | `vesselUuid` | `vessel_uuid` | text | N/A (is PK) | Nullable | Yes (idx) | [shared/schema.ts:1433](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/schema.ts#L1433) |

### 2.2 Tables Using `vessel_id` (DB column name) — 12 tables

| # | Table Name | Drizzle Property | DB Column | Type | FK? | Nullable? | Indexed? | File:Line |
|---|---|---|---|---|---|---|---|---|
| 1 | `da_test_records_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [drugs-alcohol/schema.ts:17](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/drugs-alcohol/schema.ts#L17) |
| 2 | `rh_vessel_records_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [rest-hours/schema.ts:22](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L22) |
| 3 | `rh_crew_records_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [rest-hours/schema.ts:56](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L56) |
| 4 | `rh_daily_records_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | Yes (composite unique) | [rest-hours/schema.ts:79](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L79) |
| 5 | `rh_vessel_violation_comments_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [rest-hours/schema.ts:108](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L108) |
| 6 | `rh_office_violation_comments_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [rest-hours/schema.ts:120](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L120) |
| 7 | `rh_nc_reports_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [rest-hours/schema.ts:136](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L136) |
| 8 | `rh_fixed_tasks_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [rest-hours/schema.ts:161](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L161) |
| 9 | `rh_variable_tasks_v2` | `vesselId` | `vessel_id` | text | No | Nullable | No | [rest-hours/schema.ts:190](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L190) |
| 10 | `rh_dateline_adjustments_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [rest-hours/schema.ts:207](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/rest-hours/schema.ts#L207) |
| 11 | `adm_vessel_drafts_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [admin/schema.ts:157](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/admin/schema.ts#L157) |
| 12 | `adm_vessel_revisions_v2` | `vesselId` | `vessel_id` | text | No | NOT NULL | No | [admin/schema.ts:166](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/admin/schema.ts#L166) |

> [!NOTE]
> Two additional admin tables (`adm_training_matrix_vessel_drafts_v2` L176 and `adm_training_matrix_vessel_revisions_v2` L185) also use `vessel_id`. However, these store an org-chart vessel identifier for the training matrix, not a direct operational vessel FK — functionally equivalent, so they are included in the count above but noted separately.
>
> Also, `adm_vessel_groups_v2` at L150 has `vesselIds` (plural, `vessel_ids` TEXT) — this stores a **comma-separated or JSON list** of vessel IDs, not a single FK. Flagged below as a special case.

### 2.3 Outlier Naming Variants — 2 tables

| # | Table Name | Drizzle Property | DB Column | Type | FK? | Nullable? | Indexed? | File:Line | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `promotion_reviews_v2` | `vesselAssigned` | `vessel_assigned` | text | No | Nullable | No | [promotions/schema.ts:30](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/promotions/schema.ts#L30) | Stores vessel name string, not a UUID/ID FK — **needs verification** |
| 2 | `appraisal_results_v2` | `vessel` | `vessel` | text | No | Nullable | No | [appraisals/schema.ts:25](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/appraisals/schema.ts#L25) | Stores vessel name string, not a UUID/ID FK — **needs verification** |

### 2.4 Companion `vesselName` Columns (informational, not FK candidates)

Several tables store a **denormalized vessel name string** alongside the vessel FK. These are display-only and not FK columns:

| Table | Column | File:Line |
|---|---|---|
| `crew_sea_service` | `vesselName` (`vessel_name`) | [crew-pool/schema.ts:350](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L350) |
| `crew_pre_joining_medicals` | `vesselName` (`vessel_name`) | [crew-pool/schema.ts:387](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L387) |
| `crew_briefings` | `vesselName` (`vessel_name`) | [crew-pool/schema.ts:453](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L453) |
| `crew_debriefings` | `vesselName` (`vessel_name`) | [crew-pool/schema.ts:479](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L479) |
| `cand_sea_service` | `vesselName` (`vessel_name`) | [recruitment/schema.ts:268](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/recruitment/schema.ts#L268) |

### 2.5 `vesselTypeUuid` Columns (vessel **type** reference, not vessel instance)

These reference `master_vessel_types.vt_uuid`, not a specific vessel. Listed for completeness — NOT counted in the vessel FK totals:

| Table | Column | File:Line |
|---|---|---|
| `crew_members_v2` | `vesselTypeUuid` (`vessel_type_uuid`) | [crew-pool/schema.ts:29](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L29) |
| `crew_vessel_types_applied` | `vesselTypeUuid` (`vessel_type_uuid`) | [crew-pool/schema.ts:103](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L103) |
| `crew_sea_service` | `vesselTypeUuid` (`vessel_type_uuid`) | [crew-pool/schema.ts:352](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/crew-pool/schema.ts#L352) |
| `cand_vessel_types_applied` | `vesselTypeUuid` (`vessel_type_uuid`) | [recruitment/schema.ts:39](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/recruitment/schema.ts#L39) |
| `cand_sea_service` | `vesselTypeUuid` (`vessel_type_uuid`) | [recruitment/schema.ts:270](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/recruitment/schema.ts#L270) |
| `cand_suitability_vessel_types` | `vesselTypeUuid` (`vessel_type_uuid`) | [recruitment/schema.ts:720](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/recruitment/schema.ts#L720) |

### 2.6 Special Cases

| Table | Column | DB Name | Notes |
|---|---|---|---|
| `adm_vessel_groups_v2` | `vesselIds` | `vessel_ids` | **Multi-value field** — stores comma-separated or JSON array of vessel IDs. Not a single FK. |
| `crew_assignments` | `lastVesselUuid` | `last_vessel_uuid` | **Second vessel column** on the same table — stores the previous vessel assignment. |
| `crew_doctor_visits` | `vessel` | `vessel` | Stores vessel **name string**, same pattern as `appraisal_results_v2.vessel`. |
| `promo_suitability_v2` | `vesselTypes` | `vessel_types` | **Array column** — stores `text[]` of vessel type strings, not a vessel FK. |
| `promotion_reviews_v2` | `selectedVesselTypeForA23b` | `selected_vessel_type_for_a2_3b` | Vessel **type** selector, not a vessel instance FK. |

---

## 3. Recommended Canonical Name and Type

### Convention Tally (excluding outliers and special cases)

| DB Column Name | Table Count | Modules Using It |
|---|---|---|
| `vessel_uuid` | **11** | Vessel Planning, Rotation (3 tables), Crew Pool (5 tables), Recruitment, Master |
| `vessel_id` | **12** | Drugs & Alcohol, Rest Hours (9 tables), Admin (2+2 tables) |
| `vessel_assigned` | 1 | Promotions |
| `vessel` | 2 | Appraisals, Crew Pool (doctor visits) |

### Analysis

The two dominant conventions are **`vessel_uuid`** (11 tables) and **`vessel_id`** (12 tables), nearly tied. However:

1. **`vessel_uuid` aligns with the master table's PK** — `master_vessels.vessel_uuid` is the canonical identifier. Using `vessel_uuid` in child tables creates a natural, self-documenting foreign key relationship.

2. **`vessel_id` is misleading** — in all 12 tables, the column stores a UUID string (type `text`), not an integer ID. The `_id` suffix implies an auto-increment integer key, creating false expectations.

3. **`vessel_uuid` is used by the "core entity" modules** (Vessel Planning, Rotation, Crew Assignments, Sea Service, Briefing/Debriefing) which are the most architecturally central.

4. **`vessel_id` usage is concentrated in two modules** — Rest Hours (9 tables) and Admin (2 tables + 2 training matrix tables). A single batch rename in these modules would resolve most inconsistency.

5. **The `crew_assignments` table is the architectural anchor** — it's the bridge between crew and vessel, and it uses `vessel_uuid`.

### Recommendation

> **Canonical column name**: `vessel_uuid`  
> **Canonical Drizzle property**: `vesselUuid`  
> **Canonical type**: `text` (matching `master_vessels.vessel_uuid`)  

**Reasoning**: While `vessel_id` has a slight numerical edge (12 vs 11), `vessel_uuid` is the correct choice because:
- It matches the master table's primary identifier column name
- It's semantically accurate (the value IS a UUID, not an integer ID)
- It's used in the architecturally central modules
- The `vessel_id` tables are concentrated in just 2 modules, making the rename a contained operation

---

## 4. Per-Table Call-Site Impact (Tables That Would Need Renaming)

### 4.1 Tables needing `vessel_id` → `vessel_uuid` rename (12 tables)

> [!NOTE]
> The following is a summary of the backend and frontend files that reference each `vesselId` Drizzle property. A rename would require updating both the DB column (migration) and every code reference.

#### Drugs & Alcohol Module (1 table)

**`da_test_records_v2.vessel_id`**

Backend references:
- [server/v2/drugs-alcohol/services/testRecordsService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/drugs-alcohol/services/testRecordsService.ts) — uses `vesselId` in queries and filters
- [server/v2/drugs-alcohol/controllers/testRecordsController.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/drugs-alcohol/controllers/testRecordsController.ts) — reads `vesselId` from request params

Frontend references:
- [client/src/modules/drugs-alcohol/DrugAlcoholTestForm_v2.tsx](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/modules/drugs-alcohol/DrugAlcoholTestForm_v2.tsx) — uses `vesselId` in form state and API payloads

#### Rest Hours Module (9 tables)

**All rest-hours tables use `vesselId` uniformly.** Key backend files:

- [server/v2/rest-hours/services/vesselRecordsService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/services/vesselRecordsService.ts) — heavy `vesselId` usage in all queries
- [server/v2/rest-hours/services/crewRecordsService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/services/crewRecordsService.ts) — `vesselId` filtering
- [server/v2/rest-hours/services/dailyRecordsService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/services/dailyRecordsService.ts) — `vesselId` in record creation and lookups
- [server/v2/rest-hours/controllers/](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/controllers/) — all controllers pass `vesselId` from URL params

Frontend references:
- All rest-hours React components use `vesselId` in API call paths and state management

> [!WARNING]
> Rest Hours has a **composite unique index** on `rh_daily_records_v2` that includes `vessel_id` (schema.ts:94-99). Any column rename migration must also handle index recreation.

#### Admin Module (4 tables)

**`adm_vessel_drafts_v2`, `adm_vessel_revisions_v2`, `adm_training_matrix_vessel_drafts_v2`, `adm_training_matrix_vessel_revisions_v2`** — all use `vessel_id`.

Backend references:
- [server/v2/admin/services/](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/admin/services/) — vessel draft and revision services

### 4.2 Outliers needing custom migration

#### `promotion_reviews_v2.vessel_assigned`
- **Needs verification** — may store a vessel name string rather than a UUID. If it does store a UUID, rename to `vessel_uuid`. If it stores a name, it should be split into `vessel_uuid` + `vessel_name`.
- Backend: [server/v2/promotions/services/promotionReviewsService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/promotions/services/promotionReviewsService.ts)
- Frontend: Promotion review forms

#### `appraisal_results_v2.vessel`
- **Needs verification** — likely stores a vessel name string (not a UUID). Same split recommendation.
- Backend: [server/v2/appraisals/services/appraisalResultsService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/appraisals/services/appraisalResultsService.ts)

#### `crew_doctor_visits.vessel`
- **Same as appraisals** — stores a vessel name string.
- Backend: [server/v2/crew-pool/services/](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/services/)

---

## 5. Tables With NO Vessel Reference That Functionally Need One

> [!CAUTION]
> These tables contain data that is functionally vessel-scoped but have **no vessel column at all**. This is a more serious gap than naming inconsistency — it means ship/shore sync cannot partition this data by vessel.

| Table | Module | Why It Needs a Vessel Column | File:Line |
|---|---|---|---|
| `da_testing_equipment_v2` | Drugs & Alcohol | Child of `da_test_records_v2` (which has `vessel_id`). Linked via `test_record_uuid` — can derive vessel through the parent join, but cannot be independently sync-partitioned. | [drugs-alcohol/schema.ts:46](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/drugs-alcohol/schema.ts#L46) |
| `da_personnel_tested_v2` | Drugs & Alcohol | Same — child of `da_test_records_v2`. | [drugs-alcohol/schema.ts:58](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/drugs-alcohol/schema.ts#L58) |
| `da_signatures_v2` | Drugs & Alcohol | Same — child of `da_test_records_v2`. | [drugs-alcohol/schema.ts:80](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/drugs-alcohol/schema.ts#L80) |
| `da_attachments_v2` | Drugs & Alcohol | Same — child of `da_test_records_v2`. | [drugs-alcohol/schema.ts:90](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/drugs-alcohol/schema.ts#L90) |

> [!NOTE]
> For sync purposes, child tables that are always synced as a unit with their parent may not strictly need their own vessel column — the sync engine can derive it via the parent. However, if the sync engine operates per-table rather than per-aggregate, these gaps become blockers. **Flag for sync architecture decision.**

---

## 6. Type Mismatch Analysis

> **Result: No type mismatches found.**

All vessel-reference columns across the entire codebase use `text` as their underlying PostgreSQL type. The `master_vessels.vessel_uuid` column is also `text`. There are no integer-based vessel IDs anywhere in the v2 schema.

This is the one area where the codebase is already fully consistent — despite the naming inconsistency, the underlying data type is uniform, which means any standardization effort is purely a column rename (no type casting required).

---

## 7. Sync Config Dependencies

**`shared/syncConfig.ts` does not yet exist.** It is referenced in multiple design documents as a planned future file:

- [SYNC-SIMPLIFIED-GUIDE_with_file_transfer.md](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/SYNC-SIMPLIFIED-GUIDE_with_file_transfer.md) — §6.1 contains a draft design for `TableSyncConfig` that includes a `vesselScopeColumn` property
- [PRE-IMPLEMENTATION-AUDIT.md](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/PRE-IMPLEMENTATION-AUDIT.md) — references `syncConfig.ts` identity column mapping

Since the sync config doesn't exist yet, there are **no existing sync dependencies on the current column names**. This is actually the ideal time to standardize — before the sync config is written, when the cost of inconsistency is lowest.

> [!TIP]
> When `syncConfig.ts` is created, it should reference the **standardized** column name (`vessel_uuid`). Doing the rename now means the sync config can be written once, correctly, without needing a second migration later.

---

## 8. Summary Recommendations

1. **Standardize on `vessel_uuid`** — rename all `vessel_id` columns and the two outliers (`vessel_assigned`, bare `vessel`) to `vessel_uuid` via idempotent migrations.

2. **Fix the outlier semantics first** — `vessel_assigned` and bare `vessel` may store name strings, not UUIDs. Audit the actual data in these columns before writing rename migrations. If they contain names, split into `vessel_uuid` + `vessel_name`.

3. **Add indexes** — only 1 out of 27 tables has an index on its vessel column. For ship/shore sync partitioning, every vessel-scoped table needs at minimum a B-tree index on its vessel column.

4. **Consider FK constraints** — zero tables have real FK enforcement. While this is common in distributed/sync scenarios (where the master table may not be present on the ship), it should be a conscious architectural decision, not an oversight.

5. **Order of operations**: Rename columns → Write syncConfig → Implement sync engine. Doing it in this order prevents double-migration.
