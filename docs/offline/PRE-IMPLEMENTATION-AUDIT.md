# Crewing Application: Pre-Implementation Sync Audit

After performing a deep dive into the active Crewing Application codebase (`crewdevnov12`), focusing specifically on the **V2 schemas** (`shared/v2/**/*`) and excluding deprecated V1 legacy tables, here is the Pre-Implementation Audit Report. 

Overall, the V2 schema introduces excellent, sync-ready structures. However, there are still several **critical blockers** that must be resolved before the sync engine can be safely implemented.

---

### 1. Attachment Storage
**Status: ❌ Blocker**

**What the issue is:** 
Attachments in the V2 schema are currently being stored as Base64 encoded strings directly inside the database columns. For example, `fileData: text("file_data")` in tables like `crew_documents_attachments`, `screening_b1_attachments`, and `cand_documents_attachments`.

**Why it matters for sync:** 
Syncing massive Base64 text blobs via the `sync_field_log` table will exponentially bloat the database and consume massive amounts of memory during the JSON HTTP sync payloads. This will quickly lead to `413 Payload Too Large` errors, timeouts, and failed syncs over unstable satellite connections.

**Recommended Fix:**
Remove all Base64 file data from the database. Move files to physical storage (Local Disk or S3) and only store the file reference path. Let the existing chunked `FileSyncProcessor` handle binary transfers.
```sql
-- Example remediation
ALTER TABLE crew_documents_attachments DROP COLUMN file_data;
-- Rely strictly on the existing `filePath` column
```

---

### 2. Change Tracking (`updated_at` column)
**Status: ❌ Blocker**

**What the issue is:** 
While almost all tables have an `updated_at` column, there are **no PostgreSQL triggers** enforcing its update. The application relies entirely on manual ORM-level updates (e.g., `.set({ updatedAt: new Date() })` found scattered across the repository layer).

**Why it matters for sync:** 
The sync engine relies on accurate timestamp checkpoints to know what data changed since the last sync. If a developer forgets to manually append `.set({ updatedAt: new Date() })` to just one `UPDATE` query, those changes will slip past the sync checkpoint and cause permanent, silent data desync between Ship and Shore.

**Recommended Fix:**
Implement a database-level trigger to guarantee `updated_at` is always accurate.
```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('sync.bypass_trigger', true) = 'true' THEN
        RETURN NEW;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply this to ALL tables, e.g.:
CREATE TRIGGER update_crew_members_v2_updated_at
BEFORE UPDATE ON crew_members_v2 FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### 3. Standard Column Compliance (Identity Columns)
**Status: ✅ Pass**

**What the issue is:** 
Historically, the system relied on auto-incrementing integer `id` columns. 

**Why it matters for sync:** 
Sync requires globally unique identifiers (UUIDs) because an auto-incrementing ID will independently generate on both the Ship and Shore servers, leading to collisions.

**Resolution:**
Since we are exclusively targeting the V2 schema, this is fully resolved. Every V2 table is properly equipped with a UUID identity column (e.g., `crew_uuid`, `plan_uuid`, `doc_uuid`). 
**Implementation Note:** You must ensure `shared/syncConfig.ts` is configured to map `identityColumn` to these specific UUID columns rather than the integer `id`.

---

### 4. Vessel Association (Join Dependency)
**Status: ⚠️ Architecture Requirement**

**What the issue is:** 
Core tables like `crewMembersV2` do not have a direct `vesselId` column. Instead, the V2 architecture intentionally relies on joining with child/relationship tables (like `crewAssignments`) to determine vessel association.

**Why it matters for sync:** 
The standard generic sync engine expects a single `vesselScopeColumn` on the table to figure out "which records belong to Vessel A". Because the data is normalized via relationships, the default automated sync queries will not work.

**Recommended Fix:**
The sync engine's repository layer (`repository.ts` / `service.ts`) must be customized for this module. You will need to write custom `JOIN` logic in the data gathering steps (Push/Pull) to accurately scope records. For example, to sync crew members to a ship, the engine will need to query `crew_members_v2 JOIN crew_assignments WHERE is_current = true AND vessel_uuid = '...'`.

---

### 5. Structural / Schema Issues
**Status: ✅ Pass**

**What the issue is:** 
Previously, the straddling of V1 and V2 schemas posed a risk. By explicitly excluding V1 legacy tables from the sync scope, this risk is mitigated.

**Why it matters for sync:** 
The V2 schema consistently implements the `auditColumns` standard across all tables (`createdAt`, `updatedAt`, `isDeleted`, `isSync`). The `isDeleted` flag is critical for sync to properly replicate record removals via soft-deletes.

**Recommended Fix:**
Ensure that the sync engine exclusively targets V2 tables and handles soft-deletes properly based on the `is_deleted` column.

---

### 6. JSON Columns
**Status: ✅ Pass (Resolved in V2)**

**What the issue is:** 
Historically, complex mutable lists (visas, documents, education) were stored as JSON arrays. 

**Why it matters for sync:** 
Sync tracks changes at the *field level*, not the *JSON property level*. Concurrent edits to a JSON array result in massive merge conflicts where one side's data is completely overwritten.

**Resolution:**
Because we are excluding V1, this is no longer a blocker. The V2 schema brilliantly normalizes these arrays into dedicated tables (e.g., `crew_visas`, `crew_documents`). Sync can now safely operate on these individual rows without risking JSON merge conflicts.

---

### 📋 Prioritized Fix List
*Complete these steps before writing any sync code:*

1. **Purge Base64 Attachments (Blocker):** Drop all `file_data` columns, migrate binary data to physical storage, and update the application logic to read from file paths.
2. **Implement DB Triggers (Blocker):** Apply the `set_updated_at` PostgreSQL trigger to every V2 table to guarantee reliable change tracking.
3. **Customize Sync Repository Queries (Architecture Requirement):** Prepare to write custom SQL JOIN logic within the sync engine to properly scope Crew Profile data to specific vessels, based on your `crewAssignments` structure.

---

### 7. Module-by-Module Breakdown

Here is a detailed sync-readiness assessment for each of the 10 included modules in the V2 schema.

| Module | Active Tables (V2) | Identity Column | Vessel Scoping Method | Base64 Blocker? | Sync Readiness |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Appraisals** | `appraisal_results_v2`<br>`appr_trainings_v2`<br>`appr_targets_v2`<br>`appr_competence_assessments_v2`<br>`appr_behavioural_assessments_v2`<br>`appr_training_needs_v2`<br>`appr_recommendations_v2`<br>`appr_appraiser_comments_v2`<br>`appr_seafarer_comments_v2`<br>`appr_office_reviews_v2`<br>`appr_training_followups_v2` | UUID (`appraisal_uuid`, `training_uuid`, etc.) | **JOIN**: `crew_members_v2` ➔ `crew_assignments` | No | ⚠️ Ready (Needs JOIN scoping) |
| **Crew Pool** | `crew_members_v2`<br>`crew_terminations`<br>`crew_assignments`<br>`crew_vessel_types_applied`<br>+ 6 Profile tables<br>+ 10 Attachment tables | UUID (`crew_uuid`, `term_uuid`, `assign_uuid`, etc.) | **Direct / JOIN**: `crew_assignments.vessel_uuid` (where `is_current = true`) | **Yes (10 tables)** | ❌ Blocker (Attachments & JOIN scoping) |
| **Drugs & Alcohol** | `da_test_records_v2`<br>`da_testing_equipment_v2`<br>`da_personnel_tested_v2`<br>`da_signatures_v2`<br>`da_attachments_v2` | UUID (`da_uuid`, `eq_uuid`, `pt_uuid`, etc.) | **Direct / JOIN**: Parent `da_test_records_v2.vessel_id` | **Yes (`da_attachments_v2`)** | ❌ Blocker (Attachments) |
| **Promotions** | `promo_criteria_master_v2`<br>`promotion_reviews_v2`<br>`promo_criteria_status_v2`<br>`promo_ces_tests_v2`<br>`promo_criteria_comments_v2`<br>`promo_training_comments_v2`<br>`promo_training_needs_v2`<br>`promo_approvals_v2`<br>`promo_suitability_v2`<br>`promo_checklist_progress_v2` | UUID (`criteria_uuid`, `review_uuid`, etc.) | **JOIN**: `crew_members_v2` ➔ `crew_assignments` | **Yes (`attachments_data` JSON)** | ❌ Blocker (Base64 inside JSON) |
| **Rest Hours** | `rh_vessel_records_v2`<br>`rh_crew_records_v2`<br>`rh_daily_records_v2`<br>`rh_vessel_violation_comments_v2`<br>`rh_office_violation_comments_v2`<br>`rh_nc_reports_v2`<br>`rh_fixed_tasks_v2`<br>`rh_variable_tasks_v2`<br>`rh_dateline_adjustments_v2` | UUID (`rh_vessel_uuid`, `rh_crew_record_uuid`, etc.) | **Direct**: `vessel_id` on every table | No | ✅ Fully Ready |
| **Rotation** | `rotation_drafts_v2`<br>`rotation_draft_vessels_v2`<br>`rotation_draft_ranks_v2`<br>`rotation_entries_v2`<br>`rotation_archive_v2` | UUID (`draft_uuid`, `entry_uuid`, etc.) | **Direct / JOIN**: `vessel_uuid` or `rotation_draft_vessels_v2` | No | ⚠️ Ready (Needs JOIN scoping for drafts) |
| **Tenant** | `tenants` | UUID (`tuid`) | None (Global Scope) | No | ✅ Ready (Global sync or exclude) |
| **Test Cases** | `test_cases_v2` | UUID (`tc_uuid`) | None (Global Scope) | No | ✅ Ready (Exclude or global sync) |
| **Training Needs** | `training_needs_other_v2`<br>`training_needs_source_overlay_v2` | UUID (`tno_uuid`, `so_uuid`) | **JOIN**: `crew_members_v2` ➔ `crew_assignments` | No | ⚠️ Ready (Needs JOIN scoping) |
| **Vessel** | `vessel_planning_v2`<br>`vessel_planning_attachments_v2` | UUID (`plan_uuid`, `att_uuid`) | **Direct / JOIN**: Parent `vessel_planning_v2.vessel_uuid` | **Yes (`vessel_planning_attachments_v2`)** | ❌ Blocker (Attachments) |

---

### Detailed Module Review & Action Items

#### 1. Appraisals
- **Sync Status**: ⚠️ Requires Custom Scoping.
- **Identity Compliance**: All tables use UUID identity keys (`appraisal_uuid`, `training_uuid`, etc.).
- **Vessel scoping details**: Appraisal results store the crew member's ID (`crew_member_id`). Since appraisal records are tied to crew profiles, the vessel association is obtained by checking the crew member's active vessel assignment:
  ```sql
  SELECT a.* FROM appraisal_results_v2 a
  JOIN crew_assignments c ON a.crew_member_id = c.crew_uuid
  WHERE c.is_current = true AND c.vessel_uuid = :vessel_uuid;
  ```
- **Action Required**: Build custom scoping queries in the sync repository for all 11 tables in this module.

#### 2. Crew Pool
- **Sync Status**: ❌ Hard Blocker.
- **Identity Compliance**: Fully UUID-compliant.
- **Attachment Storage**: Has 10 tables ending in `_attachments` containing `file_data text` columns storing Base64 file contents.
- **Vessel scoping details**: Crew profile records (personal details, address, family, children, documents, visas, licenses, education, training courses) do not have a direct `vessel_uuid`. Vessel scoping must run through `crew_assignments` where `is_current = true` and `vessel_uuid = :vessel_uuid`.
- **Action Required**: 
  1. Purge the `file_data` columns on all 10 attachment tables. Store file contents to disk/S3, utilizing the `file_path` column instead.
  2. Implement custom JOIN-based scoping rules for all crew profile tables in the sync repository.

#### 3. Drugs & Alcohol
- **Sync Status**: ❌ Hard Blocker.
- **Identity Compliance**: Fully UUID-compliant.
- **Attachment Storage**: `da_attachments_v2` has `file_data text` column storing Base64.
- **Vessel scoping details**: `da_test_records_v2` has a direct `vessel_id` column. Child tables (`da_testing_equipment_v2`, `da_personnel_tested_v2`, `da_signatures_v2`, `da_attachments_v2`) link to the parent via `test_record_uuid`.
- **Action Required**:
  1. Drop the `file_data` column in `da_attachments_v2` and shift to path-based storage.
  2. Scope child tables in the sync processor by joining back to `da_test_records_v2` to filter on `vessel_id`.

#### 4. Promotions
- **Sync Status**: ❌ Hard Blocker.
- **Identity Compliance**: Fully UUID-compliant.
- **Attachment Storage**: `promo_checklist_progress_v2` has `attachments_data text` column. The frontend uses `FileReader.readAsDataURL` to upload files, converting them to Base64 and storing them inside a serialized JSON array in this column.
- **Vessel scoping details**: Promotion reviews store `crew_member_id` (representing `crew_uuid`). Scoping requires joining with active `crew_assignments`. Child tables link via `review_uuid`.
- **Action Required**:
  1. Refactor the promotions checklist attachment mechanism. Avoid embedding Base64 blobs within the `attachments_data` JSON. Extract them to a normalized table (like other attachment schemas) and save files to disk/S3.
  2. Apply JOIN-based vessel scoping queries for all promotions tables.

#### 5. Rest Hours
- **Sync Status**: ✅ Ready.
- **Identity Compliance**: Fully UUID-compliant.
- **Vessel scoping details**: Excellent schema design. Every single rest-hours table has a direct `vessel_id` column, allowing simple scoping without joins.
- **Action Required**: None. Rest Hours is ready for sync integration.

#### 6. Rotation
- **Sync Status**: ⚠️ Requires Custom Scoping.
- **Identity Compliance**: Fully UUID-compliant.
- **Vessel scoping details**: Rotation entries (`rotation_entries_v2`) and archive (`rotation_archive_v2`) have a direct `vessel_uuid`. Rotation drafts (`rotation_drafts_v2`) do not have a direct `vessel_uuid` but are linked to vessels via `rotation_draft_vessels_v2`.
- **Action Required**: Add custom scoping query for drafts to join with `rotation_draft_vessels_v2` to filter by `vessel_uuid`.

#### 7. Tenant
- **Sync Status**: ✅ Ready.
- **Identity Compliance**: Uses `tuid` as its identity column.
- **Audit Columns**: Lacks `is_sync` and creator columns, but implements `is_deleted` and `updated_at`.
- **Vessel scoping details**: Global table. Not scoped to vessels.
- **Action Required**: Typically excluded from vessel-level sync, or synced globally (read-only for vessel installations).

#### 8. Test Cases
- **Sync Status**: ✅ Ready.
- **Identity Compliance**: Fully UUID-compliant.
- **Vessel scoping details**: Global table containing developer-centric test cases.
- **Action Required**: Exclude from production ship sync rules.

#### 9. Training Needs
- **Sync Status**: ⚠️ Requires Custom Scoping.
- **Identity Compliance**: Fully UUID-compliant.
- **Vessel scoping details**: `training_needs_other_v2` uses `crew_member_id` to link to crew members. Overlay table `training_needs_source_overlay_v2` links via `source_ref_uuid` to appraisals or promotions. Scoping is resolved via active `crew_assignments`.
- **Action Required**: Write custom JOIN-based scoping logic in the sync repository.

#### 10. Vessel (Planning)
- **Sync Status**: ❌ Hard Blocker.
- **Identity Compliance**: Fully UUID-compliant.
- **Attachment Storage**: `vessel_planning_attachments_v2` has `file_data text` column storing Base64 file contents.
- **Vessel scoping details**: Parent table `vessel_planning_v2` has a direct `vessel_uuid` column. Attachment table links via `plan_uuid`.
- **Action Required**:
  1. Drop the `file_data` column in `vessel_planning_attachments_v2` and shift to path-based storage.
  2. Scope the attachments table by joining with the parent planning table on `plan_uuid` to filter by `vessel_uuid`.
