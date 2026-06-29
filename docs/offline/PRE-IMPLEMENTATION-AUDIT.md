# Crewing Application: Implementation Sync Audit (Updated)

> **Original Audit Date**: Pre-implementation  
> **Updated**: 29-Jun-2026  
> **Scope**: All V2 schemas (`shared/v2/**/*`), excluding deprecated V1 legacy tables  
> **Method**: Static analysis of the full schema tree, cross-referenced with prior audits ([VESSEL_KEY_CONSISTENCY_AUDIT.md](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/VESSEL_KEY_CONSISTENCY_AUDIT.md), [UPDATED_AT_RELIABILITY_AUDIT.md](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/UPDATED_AT_RELIABILITY_AUDIT.md))

---

## Change Log Since Original Audit

| Change | Status | Details |
| :--- | :--- | :--- |
| `$onUpdate()` ORM auto-stamp added to `updatedAt` | ✅ Implemented | All 12 V2 schema files now carry `.$onUpdate(() => new Date())` on `auditColumns.updatedAt` |
| Promotions `attachments_data` column deprecated | ✅ Implemented | Column renamed to `deprecated_attachments_data`; new normalized `promo_checklist_attachments_v2` table created with `filePath`-based storage |
| New module: **Admin** (16 tables) | ⚠️ New | Forms, ranks, training matrix, vessel org chart, RBAC — all global/master-data scope |
| New module: **Recruitment** (56 tables) | ⚠️ New | Full candidate lifecycle with 15 attachment tables — `file_data` columns are legacy fallback only |
| New module: **Alerts** (3 tables) | ⚠️ New | Alert policies, events, deliveries — global scope |
| New module: **Reports** (types only, no tables) | ℹ️ New | Runtime query engine only; no schema tables to sync |
| `promoExecutionLedgerV2` table added | ℹ️ New | Durable promotion execution record |
| DB-level `BEFORE UPDATE` trigger | ❌ Still Missing | No PostgreSQL trigger exists; `$onUpdate` covers Drizzle writes only |
| Vessel key naming variance | ℹ️ Cosmetic Only | Split between `vessel_uuid` (11 tables) and `vessel_id` (12 tables) — all store actual vessel UUID values |
| `syncConfig.ts` | ❌ Not Created | No sync configuration file exists yet |

---

### 1. Attachment Storage (Base64)
**Status: ✅ Not a Sync Blocker — Legacy Fallback Only**

> **Stakeholder Clarification (29-Jun-2026):** The `file_data` column is **not actively used** by the application. It exists only as an old fallback column. All active attachment writes use `filePath`-based storage (disk/S3). The sync engine will sync the `filePath` column and binary files separately via the chunked `FileSyncProcessor` — the `file_data` column will be excluded from sync payloads.

**What changed:**
- **Promotions**: The `attachments_data` column was renamed to `deprecated_attachments_data` in `promo_checklist_progress_v2`. A new normalized `promo_checklist_attachments_v2` table uses `filePath`-based storage. ✅ **Resolved**.
- **All other modules**: The `fileData: text("file_data")` column is still present in 27 attachment tables but is **not written to** by current application code.

**Current `file_data` column inventory (legacy, not in active use):**

| Module | Tables with `file_data` | Status |
| :--- | :--- | :--- |
| **Crew Pool** | 10 tables | ℹ️ Legacy fallback — `filePath` is the active column |
| **Recruitment** | 15 tables | ℹ️ Legacy fallback — `filePath` is the active column |
| **Drugs & Alcohol** | 1 table | ℹ️ Legacy fallback — `filePath` is the active column |
| **Vessel** | 1 table | ℹ️ Legacy fallback — `filePath` is the active column |
| **Promotions** | 0 tables | ✅ Resolved — normalized `promo_checklist_attachments_v2` |

**Recommended Action**: Exclude `file_data` from sync payloads. Optionally drop the column in a future cleanup migration to reduce DB footprint, but this is **not a sync blocker**.

---

### 2. Change Tracking (`updated_at` column)
**Status: ⚠️ Partially Resolved — ORM-level fix in place, DB trigger still missing**

**What changed:**
- **`$onUpdate(() => new Date())`** has been added to the `auditColumns.updatedAt` definition in every V2 schema file (12 files confirmed). This means all Drizzle `.update()` calls now automatically stamp `updated_at`.
- Per the [UPDATED_AT_RELIABILITY_AUDIT.md](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/UPDATED_AT_RELIABILITY_AUDIT.md), 10 previously identified VERIFIED-MISSING sites are now covered by this ORM change.

**What remains:**
- **No PostgreSQL `BEFORE UPDATE` trigger** exists. The `$onUpdate` handler only covers writes through Drizzle's query builder. It does **not** cover:
  - Raw SQL writes (`sql` template tag bypassing Drizzle's column stamping)
  - External writes (psql, migration scripts, third-party tools)
  - Future inbound sync writes (the sync engine itself)
- **Tenant table** still uses a bare `timestamp("updated_at").defaultNow()` **without** `$onUpdate`. This is a minor gap since tenants are global-scope and rarely sync vessel-level.

**Recommended Fix**: Implement the `set_updated_at()` PostgreSQL trigger as defense-in-depth (with `sync.bypass_trigger` escape hatch for the sync engine):
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
-- Apply to ALL V2 tables
```

---

### 3. Standard Column Compliance (Identity Columns)
**Status: ✅ Pass**

No change from original audit. Every V2 table is equipped with a UUID identity column. The new modules (Admin, Recruitment, Alerts) all follow this convention:
- Admin: `form_uuid`, `rg_uuid`, `ar_uuid`, `ph_uuid`, `tm_uuid`, `ctg_uuid`, `ct_uuid`, `ctr_uuid`, `cr_uuid`, `vg_uuid`, `vd_uuid`, `vr_uuid`, `tmvd_uuid`, `tmvr_uuid`, `muid`, `ruid`, `oc_uuid`, `rauid`
- Recruitment: `rec_can_uuid`, `cvta_uuid`, `cpd_uuid`, `addr_uuid`, `fam_uuid`, `child_uuid`, `nok_uuid`, `doc_uuid`, `att_uuid`, `visa_uuid`, `edu_uuid`, `lic_uuid`, `train_uuid`, `sea_uuid`, `info_uuid`, `b1_uuid` through `b8_uuid`, `approval_uuid`, `suit_uuid`, `decision_uuid`, etc.
- Alerts: `apuuid`, `aeuuid` (event UUID)

---

### 4. Vessel Association (Join Dependency)
**Status: ⚠️ Architecture Requirement**

No change in the core issue. The sync engine must implement custom JOIN scoping for tables without a direct vessel column.

> **Stakeholder Clarification (29-Jun-2026):** Although vessel-reference columns use different naming conventions (`vessel_uuid`, `vessel_id`, `vessel_assigned`, `vessel`), **all columns store the actual UUID value** of the vessel. The naming difference is cosmetic only — the underlying data type and format is consistent (`text` storing a UUID string). The sync configuration needs to map the correct column name per-table, but no data transformation or normalization is required.

**Key facts from [VESSEL_KEY_CONSISTENCY_AUDIT.md](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/VESSEL_KEY_CONSISTENCY_AUDIT.md):**
- 4 distinct column name variants exist, but all store the same UUID format
- No FK constraints referencing `master_vessels` (loose coupling by design)
- No dedicated indexes on vessel columns (except `rh_daily_records_v2` composite unique)

**Impact on Sync**: Minimal. The sync configuration maps each table's vessel column name individually, but since all values are the same UUID format, no data conversion is needed.

---

### 5. Structural / Schema Issues
**Status: ✅ Pass**

No change. The V2 schema consistently implements `auditColumns` (`createdAt`, `updatedAt`, `isDeleted`, `isSync`) across all in-scope tables. Exceptions (both out of scope):
- `tenants` table: Has `isDeleted` and `updatedAt` but lacks `isSync` and `createdByUuid`/`updatedByUuid`. **Out of sync scope.**
- `rotation_drafts_v2`: Uses a custom `rotationDraftsAuditColumns` that includes `isDeleted`, `isSync`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid` (defined inline, not via spread).

---

### 6. JSON Columns
**Status: ✅ Pass (No regression)**

No change. The V2 schema normalizes complex data into dedicated tables. Two notable JSON-like columns remain but are acceptable:
- `alerts.thresholds`, `alerts.scopeFilters`, `alerts.recipients`: Serialized JSON config strings — configuration data, not mutable user data.
- `rotation_archive_v2.snapshotData`: JSONB archive snapshot — immutable historical data, not subject to concurrent edits.

---

### 📋 Updated Prioritized Fix List

*Ordered by sync-impact severity:*

| Priority | Item | Original Status | Current Status | Action |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | Implement DB trigger for `updated_at` | ❌ Blocker | ⚠️ Partial (ORM only) | Add PostgreSQL `BEFORE UPDATE` trigger to all V2 tables |
| **P1** | Create `syncConfig.ts` | ❌ Missing | ❌ Still Missing | Define identity columns, vessel scope mappings, excluded tables |
| **P2** | Customize sync repository JOIN queries | ⚠️ Architecture | ⚠️ Still Required | Write custom scoping for Crew Pool, Appraisals, Promotions, Rotation |
| ~~P0~~ | ~~Promotions attachments Base64~~ | ~~❌ Blocker~~ | ✅ **Resolved** | `deprecated_attachments_data` + normalized `promo_checklist_attachments_v2` |
| ~~P0~~ | ~~`$onUpdate` for `updatedAt`~~ | ~~❌ Blocker~~ | ✅ **Resolved** | All 12 V2 schema files now carry `.$onUpdate(() => new Date())` |
| ~~P0~~ | ~~Base64 `file_data` columns~~ | ~~❌ Blocker~~ | ✅ **Not a Blocker** | Column is legacy fallback only, not actively used; exclude from sync payloads |
| ~~P2~~ | ~~Vessel column naming~~ | ~~⚠️ Finding~~ | ✅ **Not an Issue** | All columns store actual vessel UUID values regardless of name |
| ~~P2~~ | ~~Training Needs scoping~~ | ~~⚠️ Required~~ | ⛔ **Out of Scope** | Module excluded from sync scope |
| ~~N/A~~ | ~~Tenant sync~~ | ~~✅ Ready~~ | ⛔ **Out of Scope** | Module excluded from sync scope |

---

### 7. Module-by-Module Breakdown (Updated)

The application now has **14 V2 modules** (up from 10). Here is the complete sync-readiness assessment.

| Module | Active Tables (V2) | Identity Column | Vessel Scoping Method | Base64 Blocker? | Sync Readiness |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | `adm_forms_v2`<br>`adm_form_versions_v2`<br>`adm_rank_groups_v2`<br>`adm_available_ranks_v2`<br>`adm_promotion_hierarchies_v2`<br>`adm_training_master_v2`<br>`adm_company_training_groups_v2`<br>`adm_company_trainings_v2`<br>`adm_company_training_requirements_v2`<br>`adm_company_ranks_v2`<br>`adm_vessel_groups_v2`<br>`adm_vessel_drafts_v2`<br>`adm_vessel_revisions_v2`<br>`adm_training_matrix_vessel_drafts_v2`<br>`adm_training_matrix_vessel_revisions_v2`<br>`adm_menumaster_ac`<br>`adm_rolemaster_ac`<br>`adm_vessel_org_chart_v2`<br>`adm_roleaccess_ac` | UUID (`form_uuid`, `rg_uuid`, etc.) | **Global** (master data); some have `vessel_id` for vessel-specific drafts/revisions | No | ✅ Ready (Global sync, read-only on vessel) |
| **Alerts** | `alert_policies_v2`<br>`alert_events_v2`<br>`alert_deliveries_v2` | UUID (`apuuid`, `aeuuid`) | **Global** or policy-scoped | No | ✅ Ready (Global sync or exclude) |
| **Appraisals** | `appraisal_results_v2`<br>`appr_trainings_v2`<br>`appr_targets_v2`<br>`appr_competence_assessments_v2`<br>`appr_behavioural_assessments_v2`<br>`appr_training_needs_v2`<br>`appr_recommendations_v2`<br>`appr_appraiser_comments_v2`<br>`appr_seafarer_comments_v2`<br>`appr_office_reviews_v2`<br>`appr_training_followups_v2` | UUID (`appraisal_uuid`, `training_uuid`, etc.) | **JOIN**: `crew_members_v2` ➔ `crew_assignments` | No | ⚠️ Ready (Needs JOIN scoping) |
| **Crew Pool** | `crew_members_v2`<br>`crew_terminations`<br>`crew_assignments`<br>`crew_vessel_types_applied`<br>+ 6 Profile tables<br>+ 10 Attachment tables | UUID (`crew_uuid`, `term_uuid`, `assign_uuid`, etc.) | **Direct / JOIN**: `crew_assignments.vessel_uuid` (where `is_current = true`) | No (`file_data` is legacy fallback) | ⚠️ Ready (Needs JOIN scoping) |
| **Drugs & Alcohol** | `da_test_records_v2`<br>`da_testing_equipment_v2`<br>`da_personnel_tested_v2`<br>`da_signatures_v2`<br>`da_attachments_v2` | UUID (`da_uuid`, `eq_uuid`, `pt_uuid`, etc.) | **Direct / JOIN**: Parent `da_test_records_v2.vessel_id` | No (`file_data` is legacy fallback) | ✅ Ready (Direct scoping via `vessel_id`) |
| **Promotions** | `promo_criteria_master_v2`<br>`promotion_reviews_v2`<br>`promo_criteria_status_v2`<br>`promo_ces_tests_v2`<br>`promo_criteria_comments_v2`<br>`promo_training_comments_v2`<br>`promo_training_needs_v2`<br>`promo_approvals_v2`<br>`promo_suitability_v2`<br>`promo_execution_ledger_v2`<br>`promo_checklist_progress_v2`<br>`promo_checklist_attachments_v2` | UUID (`criteria_uuid`, `review_uuid`, `ledger_uuid`, `cp_uuid`, `att_uuid`, etc.) | **JOIN**: `crew_members_v2` ➔ `crew_assignments` | **No** ✅ (Resolved) | ⚠️ Ready (Needs JOIN scoping) |
| **Recruitment** | `recruitment_candidates_v2`<br>`cand_vessel_types_applied`<br>`cand_personal_details`<br>`cand_addresses`<br>`cand_family_info`<br>`cand_children`<br>`cand_next_of_kin`<br>+ 14 Documents/Attachment tables<br>+ 24 Screening B1-B8 tables<br>+ 6 Approvals/Decision tables | UUID (`rec_can_uuid`, `b1_uuid`–`b8_uuid`, `approval_uuid`, etc.) | **Shore-Only** — recruitment is an office function, not vessel-scoped | No (`file_data` is legacy fallback) | ✅ Ready (Shore-only; exclude from vessel sync) |
| **Reports** | No schema tables (types only) | N/A | N/A | No | ✅ N/A — runtime query engine only |
| **Rest Hours** | `rh_vessel_records_v2`<br>`rh_crew_records_v2`<br>`rh_daily_records_v2`<br>`rh_vessel_violation_comments_v2`<br>`rh_office_violation_comments_v2`<br>`rh_nc_reports_v2`<br>`rh_fixed_tasks_v2`<br>`rh_variable_tasks_v2`<br>`rh_dateline_adjustments_v2` | UUID (`rh_vessel_uuid`, `rh_crew_record_uuid`, etc.) | **Direct**: `vessel_id` on every table | No | ✅ Fully Ready |
| **Rotation** | `rotation_drafts_v2`<br>`rotation_draft_vessels_v2`<br>`rotation_draft_ranks_v2`<br>`rotation_entries_v2`<br>`rotation_archive_v2` | UUID (`draft_uuid`, `entry_uuid`, etc.) | **Direct / JOIN**: `vessel_uuid` or `rotation_draft_vessels_v2` | No | ⚠️ Ready (Needs JOIN scoping for drafts) |
| **Tenant** | `tenants` | UUID (`tuid`) | None (Global Scope) | No | ⛔ **Out of Scope** |
| **Test Cases** | `test_cases_v2` | UUID (`tc_uuid`) | None (Global Scope) | No | ✅ Ready (Exclude or global sync) |
| **Training Needs** | `training_needs_other_v2`<br>`training_needs_source_overlay_v2` | UUID (`tno_uuid`, `so_uuid`) | **JOIN**: `crew_members_v2` ➔ `crew_assignments` | No | ⛔ **Out of Scope** |
| **Vessel** | `vessel_planning_v2`<br>`vessel_planning_attachments_v2` | UUID (`plan_uuid`, `att_uuid`) | **Direct / JOIN**: Parent `vessel_planning_v2.vessel_uuid` | No (`file_data` is legacy fallback) | ✅ Ready (Direct scoping via `vessel_uuid`) |

---

### Detailed Module Review & Action Items (Updated)

#### 1. Admin (NEW MODULE)
- **Sync Status**: ✅ Ready (Global/Master Data).
- **Identity Compliance**: All 19 tables use UUID identity keys.
- **Audit Columns**: Full `auditColumns` compliance with `$onUpdate`.
- **Vessel scoping details**: Master data tables (forms, ranks, training matrix, RBAC) are **global** — they don't belong to any vessel. Some tables (`adm_vessel_drafts_v2`, `adm_vessel_revisions_v2`, `adm_training_matrix_vessel_drafts_v2`, `adm_training_matrix_vessel_revisions_v2`) have a `vessel_id` column for vessel-specific configuration.
- **Action Required**: Sync as read-only global data to vessels. Vessel-specific draft/revision tables can be scoped by `vessel_id`.

#### 2. Alerts (NEW MODULE)
- **Sync Status**: ✅ Ready (with caveats).
- **Identity Compliance**: UUID-compliant (`apuuid`, `aeuuid`).
- **Audit Columns**: Full compliance with `$onUpdate`.
- **Vessel scoping details**: Policies and events are global. Alert events reference `object_id` and `object_type` which could indirectly link to vessel-scoped entities.
- **Action Required**: Typically exclude from vessel-level sync or sync policies as read-only. Alert events generated on-vessel would need custom handling if vessel-originated alerts are required.

#### 3. Appraisals
- **Sync Status**: ⚠️ Requires Custom Scoping.
- **Identity Compliance**: All tables use UUID identity keys.
- **Change Tracking**: ✅ `$onUpdate` now implemented.
- **Vessel scoping details**: Unchanged — join through `crew_members_v2` ➔ `crew_assignments`.
- **Action Required**: Build custom scoping queries in the sync repository for all 11 tables.

#### 4. Crew Pool
- **Sync Status**: ⚠️ Requires Custom Scoping (Upgraded from ❌ Blocker).
- **Identity Compliance**: Fully UUID-compliant.
- **Change Tracking**: ✅ `$onUpdate` now implemented.
- **Attachment Storage**: 10 tables still have `file_data` column, but it is **legacy fallback only** — not actively written to. The active column is `filePath`. Exclude `file_data` from sync payloads.
- **Vessel scoping details**: Unchanged — join through `crew_assignments`.
- **Action Required**: Implement custom JOIN-based scoping for all crew profile tables.

#### 5. Drugs & Alcohol
- **Sync Status**: ✅ Ready.
- **Identity Compliance**: Fully UUID-compliant.
- **Change Tracking**: ✅ `$onUpdate` now implemented.
- **Attachment Storage**: `da_attachments_v2` has `file_data` column but it is **legacy fallback only**. Exclude from sync payloads.
- **Vessel scoping details**: Direct `vessel_id` on parent table. Child tables scope via JOIN to parent's `vessel_id`.
- **Action Required**: Scope child tables via JOIN to parent's `vessel_id`.

#### 6. Promotions
- **Sync Status**: ⚠️ Requires Custom Scoping (Upgraded from ❌ Blocker).
- **Identity Compliance**: Fully UUID-compliant. New tables: `promo_execution_ledger_v2`, `promo_checklist_attachments_v2`.
- **Change Tracking**: ✅ `$onUpdate` now implemented.
- **Attachment Storage**: ✅ **Resolved**. The `attachments_data` column was renamed to `deprecated_attachments_data`. A new normalized `promo_checklist_attachments_v2` table uses `filePath`-based storage with no `fileData` column.
- **Vessel scoping details**: Unchanged — join through `crew_members_v2` ➔ `crew_assignments`.
- **Action Required**: Apply JOIN-based vessel scoping queries for all 12 promotions tables (including the 2 new ones).

#### 7. Recruitment (NEW MODULE)
- **Sync Status**: ✅ Ready (Shore-only; excluded from vessel sync).
- **Identity Compliance**: Fully UUID-compliant across all 56 tables.
- **Audit Columns**: Full compliance with `$onUpdate`.
- **Attachment Storage**: 15 attachment tables have `file_data` column but it is **legacy fallback only** — not actively written to.
- **Vessel scoping details**: Recruitment is a **shore-side office function**. Candidates are not assigned to vessels during the recruitment pipeline. There is no `vessel_uuid`/`vessel_id` on any recruitment table.
- **Action Required**: Exclude from vessel sync. No sync action required.

#### 8. Rest Hours
- **Sync Status**: ✅ Ready.
- **Change Tracking**: ✅ `$onUpdate` now implemented.
- **Vessel scoping details**: Excellent — direct `vessel_id` on every table.
- **Action Required**: None. Rest Hours is ready for sync integration.

#### 9. Rotation
- **Sync Status**: ⚠️ Requires Custom Scoping.
- **Change Tracking**: ✅ `$onUpdate` now implemented. Note: `rotation_drafts_v2` uses a separate `rotationDraftsAuditColumns` definition but it also includes `$onUpdate`.
- **Vessel scoping details**: Unchanged.
- **Action Required**: Add custom scoping query for drafts to join with `rotation_draft_vessels_v2`.

#### 10. Tenant
- **Sync Status**: ⛔ **Out of Scope** — excluded from sync.
- **Identity Compliance**: Uses `tuid`.
- **Audit Columns**: Partial — has `is_deleted` and `updated_at` but lacks `is_sync`, `created_by_uuid`, `updated_by_uuid`. `updated_at` does NOT have `$onUpdate`.
- **Action Required**: None — module is out of sync scope.

#### 11. Test Cases
- **Sync Status**: ✅ Ready.
- **Change Tracking**: ✅ `$onUpdate` now implemented.
- **Action Required**: Exclude from production ship sync rules.

#### 12. Training Needs
- **Sync Status**: ⛔ **Out of Scope** — excluded from sync.
- **Change Tracking**: `training_needs_other_v2` and `training_needs_source_overlay_v2` define audit columns inline and their `updatedAt` lacks `$onUpdate`. Not a concern since module is out of scope.
- **Action Required**: None — module is out of sync scope.

#### 13. Vessel (Planning)
- **Sync Status**: ✅ Ready.
- **Change Tracking**: ✅ `$onUpdate` now implemented.
- **Attachment Storage**: `vessel_planning_attachments_v2` has `file_data` column but it is **legacy fallback only**. Exclude from sync payloads.
- **Action Required**: Scope attachments via JOIN on `plan_uuid` → `vessel_planning_v2.vessel_uuid`.

---

### 8. Overall Sync Readiness Summary

| Category | Modules | Count |
| :--- | :--- | :--- |
| ✅ **Fully Ready** | Rest Hours, Drugs & Alcohol, Vessel, Admin, Alerts, Recruitment, Reports, Test Cases | 8 |
| ⚠️ **Ready (Needs Custom Scoping)** | Crew Pool, Appraisals, Promotions, Rotation | 4 |
| ⛔ **Out of Scope** | Tenant, Training Needs | 2 |
| ❌ **Blocked** | None | 0 |

**Total V2 Tables**: ~192 (across 14 modules)  
**In-scope modules**: 12 (all sync-ready, 4 need custom JOIN scoping)  
**Out-of-scope modules**: 2 (Tenant, Training Needs)  
**Zero sync blockers remain** — all original blockers resolved or clarified  

---

### 9. Remaining Open Items

#### 9.1 DB-Level `updated_at` Trigger (Defense-in-Depth)
The `$onUpdate` ORM handler covers all Drizzle writes, but a PostgreSQL `BEFORE UPDATE` trigger would provide defense-in-depth for raw SQL, external tools, and the sync engine itself. **Recommended but not blocking.**

#### 9.2 `syncConfig.ts` Creation
No sync configuration file exists yet. This needs to define:
- Identity column mapping per table
- Vessel scope column mapping per table (handling the `vessel_uuid`/`vessel_id` naming variance)
- Excluded tables (Tenant, Training Needs, Test Cases)
- Custom JOIN scoping rules for Crew Pool, Appraisals, Promotions, Rotation

#### 9.3 Legacy `file_data` Column Cleanup (Optional)
While not a sync blocker (columns are legacy fallback, not actively used), dropping the `file_data` columns in a future migration would:
- Reduce database size and backup footprint
- Improve query performance on attachment tables
- Remove any ambiguity for future developers

#### 9.4 Recruitment Screening Soft-Delete `updated_at` Gap (ORM-Closed)
Per the [UPDATED_AT_RELIABILITY_AUDIT.md](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/UPDATED_AT_RELIABILITY_AUDIT.md), 7 screening attachment soft-delete sites in `screeningRepository.ts` were missing `updatedAt` stamps. These are now covered by the `$onUpdate` ORM handler.
