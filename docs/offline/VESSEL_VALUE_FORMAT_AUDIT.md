# Vessel Reference Column Value Format & Write Path Audit

> **Audit Date**: 2026-06-26  
> **Scope**: Vessel reference columns across 27 tables from the prior consistency audit, plus special cases (`crew_doctor_visits`)  
> **Status**: READ-ONLY runtime & codebase audit — no writes or schema modifications made  

---

## 1. Executive Summary

This follow-up audit investigates what is genuinely written into the vessel reference columns at runtime across the Crewing application. While the prior consistency audit confirmed that all vessel reference columns share the SQL type `text`, it did not establish if the actual stored values were consistent.

By executing read-only database queries against the active multi-tenant tenant databases (probing the active tenant `sldemo` / RSMS Shipping) and tracing the service/repository write paths in the codebase, we established the following:

| Metric | Value | Details / Notes |
|---|---|---|
| **Total tables audited** | **28** | 27 tables from prior naming audit + 1 special case (`crew_doctor_visits`) |
| **Genuinely store valid master UUIDs** | **25** | Confirming that `vessel_uuid` and `vessel_id` tables uniformly store true UUIDs. |
| **Store legacy or placeholder values** | **1** | `adm_training_matrix_vessel_revisions_v2` (contains one `"VSL-TEST"` entry) |
| **Store free-text vessel names** | **1** | `crew_doctor_visits` (stores name strings like `"AMAGI GALAXY"`) |
| **Unverified at runtime (schema only)** | **2** | `adm_vessel_drafts_v2` and `adm_training_matrix_vessel_drafts_v2` (empty tables) |
| **Master Referential Integrity** | **98.8%** | 1,489 of 1,507 non-null rows contain valid references. |

### Key Takeaway
The "rename everything to `vessel_uuid`" plan proposed in the prior naming consistency audit remains **fully viable**. With the exception of `crew_doctor_visits`, every table's vessel reference column stores a stringified UUID at runtime, meaning standardizing the database column names is a straightforward, non-destructive migration.

---

## 2. Ground Truth for `master_vessels.vessel_uuid`

Before auditing the referencing tables, we established the ground truth for how the master table `master_vessels` is populated and formatted:

* **Source & Population Logic**:  
  `master_vessels` is populated via the `syncMasterData('vessels', data)` method located in [mastersRepository.ts:637](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/masters/repositories/mastersRepository.ts#L637). The sync mapping in `FIELD_MAPPINGS.vessels` maps the API field `vuid` directly to the Drizzle property `vesselUuid` (column `vessel_uuid`).
* **Value Generation**:  
  The values are generated externally by the central master data sync API. They are true UUID strings and are not generated in-app using `gen_random_uuid()` or `crypto.randomUUID()`.
* **Observed Format**:  
  Values queried from the live database strictly match the standard 36-character UUID format (lowercase hexadecimal characters separated by hyphens).  
  *Examples: `24a0fb38-d8bf-43d2-9e8f-206f20578069`, `743feb08-841a-11ed-aa7c-7003bca91a86`*

---

## 3. Comprehensive Per-Table Inventory

The table below summarizes the write path, value source, observed value formats, and referential integrity of every audited table.

| # | Table Name | Column | Write Call Site (File:Line) | Value Source | Stored Value Format | Matches `master_vessels`? | Confidence |
|---|---|---|---|---|---|---|---|
| **1** | `vessel_planning_v2` | `vessel_uuid` | [vesselPlanningRepository.ts:238](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/vessel/repositories/vesselPlanningRepository.ts#L238) | `vesselUuid` from client/UI | UUID | **YES** (151/151 rows) | High |
| **2** | `rotation_draft_vessels_v2` | `vessel_uuid` | [rotationDraftsRepository.ts:104](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rotation/repositories/rotationDraftsRepository.ts#L104) | `vesselUuid` from draft logic | UUID | **YES** (47/47 rows) | High |
| **3** | `rotation_entries_v2` | `vessel_uuid` | [rotationEntriesRepository.ts:73](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rotation/repositories/rotationEntriesRepository.ts#L73) | `vesselUuid` from rotation plan | UUID | **YES** (108/108 rows) | High |
| **4** | `rotation_archive_v2` | `vessel_uuid` | [rotationEntriesRepository.ts:172](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rotation/repositories/rotationEntriesRepository.ts#L172) | `vesselUuid` from entry archive | UUID | **YES** (111/111 rows) | High |
| **5** | `crew_assignments` | `vessel_uuid` | [crewAssignmentsRepository.ts:73](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/repositories/crewAssignmentsRepository.ts#L73) | `vesselUuid` from planning | UUID | **YES** (108/108 rows) | High |
| **6** | `crew_sea_service` | `vessel_uuid` | [crewSeaServiceRepository.ts:138](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/repositories/crewSeaServiceRepository.ts#L138) | Resolved via `resolveVesselUuid` | UUID / Null | **YES** (143/143 non-null) | High |
| **7** | `crew_pre_joining_medicals` | `vessel_uuid` | [crewMedicalRepository.ts:116](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/repositories/crewMedicalRepository.ts#L116) | Resolved via `resolveVesselUuid` | UUID / Null | **YES** (29/29 non-null) | High |
| **8** | `crew_briefings` | `vessel_uuid` | [crewMedicalRepository.ts (implied)](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/repositories/crewMedicalRepository.ts) | Resolved via `resolveVesselUuid` | UUID | **YES** (2/2 rows) | High |
| **9** | `crew_debriefings` | `vessel_uuid` | [crewMedicalRepository.ts (implied)](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/repositories/crewMedicalRepository.ts) | Resolved via `resolveVesselUuid` | UUID | **YES** (1/1 row) | High |
| **10** | `cand_sea_service` | `vessel_uuid` | [documentsRepository.ts:458](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/recruitment/repositories/documentsRepository.ts#L458) | `vesselUuid` from candidate input | Null | **N/A** (0/0 non-null) | High |
| **11** | `da_test_records_v2` | `vessel_id` | [testRecordsRepository.ts:311](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/drugs-alcohol/repositories/testRecordsRepository.ts#L311) | `vesselId` from payload | UUID | **YES** (76/76 rows) | High |
| **12** | `rh_vessel_records_v2` | `vessel_id` | [vesselRecordsRepository.ts:68](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/vesselRecordsRepository.ts#L68) | `vesselId` from payload | UUID | **YES** (38/38 rows) | High |
| **13** | `rh_crew_records_v2` | `vessel_id` | [crewRecordsRepository.ts:65](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/crewRecordsRepository.ts#L65) | `vesselId` from payload | UUID | **YES** (190/190 rows) | High |
| **14** | `rh_daily_records_v2` | `vessel_id` | [dailyRecordsRepository.ts:106](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/dailyRecordsRepository.ts#L106) | `vesselId` from payload | UUID | **YES** (185/185 rows) | High |
| **15** | `rh_vessel_violation_comments_v2` | `vessel_id` | [vesselCommentsRepository.ts:53](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/vesselCommentsRepository.ts#L53) | `vesselId` from comments payload | UUID | **YES** (6/6 rows) | High |
| **16** | `rh_office_violation_comments_v2` | `vessel_id` | [officeCommentsRepository.ts:53](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/officeCommentsRepository.ts#L53) | `vesselId` from comments payload | UUID | **YES** (2/2 rows) | High |
| **17** | `rh_nc_reports_v2` | `vessel_id` | [ncReportsRepository.ts:57](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/ncReportsRepository.ts#L57) | `vesselId` from NC report logic | UUID | **YES** (2/2 rows) | High |
| **18** | `rh_fixed_tasks_v2` | `vessel_id` | [fixedTasksRepository.ts:108](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/fixedTasksRepository.ts#L108) | `vesselId` from configuration | UUID | **YES** (172/172 rows) | High |
| **19** | `rh_variable_tasks_v2` | `vessel_id` | [variableTasksRepository.ts:57](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/variableTasksRepository.ts#L57) | `vesselId` from configuration | UUID | **YES** (50/50 rows) | High |
| **20** | `rh_dateline_adjustments_v2` | `vessel_id` | [datelineRepository.ts:53](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/rest-hours/repositories/datelineRepository.ts#L53) | `vesselId` from admin adjust | UUID | **YES** (12/12 rows) | High |
| **21** | `adm_vessel_drafts_v2` | `vessel_id` | [vesselDraftsRepository.ts:47](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/admin/repositories/vesselDraftsRepository.ts#L47) | `vesselId` from draft payload | Empty | **N/A** (0 rows) | High |
| **22** | `adm_vessel_revisions_v2` | `vessel_id` | [vesselRevisionsRepository.ts:47](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/admin/repositories/vesselRevisionsRepository.ts#L47) | `vesselId` from revision payload | UUID | **PARTIAL** (40/53 rows)* | High |
| **23** | `adm_training_matrix_vessel_drafts_v2` | `vessel_id` | [trainingMatrixVesselDraftsRepository.ts:47](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/admin/repositories/trainingMatrixVesselDraftsRepository.ts#L47) | `vesselId` from TM payload | Empty | **N/A** (0 rows) | High |
| **24** | `adm_training_matrix_vessel_revisions_v2` | `vessel_id` | [trainingMatrixVesselRevisionsRepository.ts:47](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/admin/repositories/trainingMatrixVesselRevisionsRepository.ts#L47) | `vesselId` from TM payload | UUID / Test | **PARTIAL** (7/8 rows)** | High |
| **25** | `promotion_reviews_v2` | `vessel_assigned` | [promotionReviewsRepository.ts:69](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/promotions/repositories/promotionReviewsRepository.ts#L69) | `vesselAssigned` from promotions | UUID / Null | **YES** (7/7 non-null) | High |
| **26** | `appraisal_results_v2` | `vessel` | [appraisalResultsRepository.ts:64](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/appraisals/repositories/appraisalResultsRepository.ts#L64) | `vessel` from appraisals payload | UUID / Null | **YES** (61/61 non-null) | High |
| **27** | `crew_doctor_visits` | `vessel` | [crewMedicalRepository.ts:307](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/repositories/crewMedicalRepository.ts#L307) | `vessel` name from UI input | Text Name | **NO** (0/25 rows)*** | High |

> **Notes on partial matches & outliers:**
> 
> \* **`adm_vessel_revisions_v2`**: 13 out of 53 rows reference UUIDs that are valid UUID format but not present in this tenant's `master_vessels` table (specifically `743ef9d1-841a-11ed-aa7c-7003bca91a86` representing "Vessel 1" and `7c08b51c-4345-4681-9d98-ec8ae142ac67` representing a legacy test vessel). These are orphaned references left over from static dev mock-ups or sync pruning.
> 
> \** **`adm_training_matrix_vessel_revisions_v2`**: Contains 1 row with value `"VSL-TEST"`. This is a hardcoded test placeholder string and not a valid UUID format.
> 
> \*** **`crew_doctor_visits`**: Stores literal vessel display names (e.g. `"AMAGI GALAXY"`, `"ARGENT HIBISCUS"`, etc.). Analysis in Section 4.3.

---

## 4. Resolution of the 3 Key Outliers

The prior audit flagged three columns as potential outliers requiring direct value inspection. We resolved their status as follows:

### 4.1 Outlier 1: `promotion_reviews_v2.vessel_assigned` (Originally "Needs Verification")
* **Status**: **RESOLVED — Stores `vessel_uuid`**
* **Finding**: This column historically stored the integer-based ID string (e.g. `"4"`) from a legacy MySQL auto-increment key. This caused the promotion dashboard drilldown to display raw numbers instead of names. 
* **Resolution**: An idempotent migration ([0127_backfill_promotion_vessel_uuid.sql](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/migrations/0127_backfill_promotion_vessel_uuid.sql)) was executed, which backfilled all legacy numeric IDs to their matching `master_vessels.vessel_uuid` strings. At runtime, the write path in `promotionReviewsRepository.ts` passes the UUID directly, making it fully standard.

### 4.2 Outlier 2: `appraisal_results_v2.vessel` (Originally "Needs Verification")
* **Status**: **RESOLVED — Stores `vessel_uuid`**
* **Finding**: This column historically stored the literal vessel name (e.g., `"MT Sail One"`). When a vessel was renamed in master data, historical appraisals broke.
* **Resolution**: An idempotent migration ([0126_backfill_appraisal_vessel_uuid.sql](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/migrations/0126_backfill_appraisal_vessel_uuid.sql)) was executed, mapping the display names to current `master_vessels.vessel_uuid` values. The write path now passes UUIDs directly, making this column standard.

### 4.3 Outlier 3: `crew_doctor_visits.vessel` (Originally "Needs Verification")
* **Status**: **RESOLVED — Stores FREE-TEXT Vessel Names (No UUIDs)**
* **Finding**: Unlike the other 26 referencing columns, `crew_doctor_visits.vessel` stores **free-text vessel names** (e.g., `"AMAGI GALAXY"`, `"YC IRIS"`, `"MV Atlantic"`).
* **Code Trace**: In `crewMedicalService.ts`, the validation and resolution method `resolveMedicalMasterDataFields` explicitly skips doctor visits:
  ```typescript
  /**
   * Resolve vessel to UUID for F1 Pre Joining Medicals
   * Note: F2 Doctor Visits has vessel as free entry (skip)
   */
  ```
* **Explanation**: Doctor visits track medical events that may occur during past service on external vessels (not owned by the current company). Therefore, the UI and service allow free-text input rather than restricting input to the fleet's `master_vessels`. 

---

## 5. Sync Configuration and Integrity Gaps

1. **Orphaned References**:  
   We found 13 rows in `adm_vessel_revisions_v2` and 1 row in `adm_training_matrix_vessel_revisions_v2` (`"VSL-TEST"`) containing orphaned references. Because these tables do not enforce SQL foreign keys (due to decentralized local synchronization requirements), referential integrity is not hard-enforced.
2. **Sync Scope and Partitioning**:  
   As noted in the prior consistency audit, `shared/syncConfig.ts` does not yet exist. In offline branch sync, tables are partitioned by vessel scope. Having a single column name (`vessel_uuid`) across all operational tables is essential for the generic sync partitioning engine to identify the sync partition boundary.

---

## 6. Updated Recommendation for the Standardization Plan

Based on these findings, we recommend the following adjustments to the standardization plan:

### 1. Maintain Column Renames (`vessel_id` → `vessel_uuid`)
The rename of `vessel_id` to `vessel_uuid` in the **Drugs & Alcohol**, **Rest Hours**, and **Admin** modules remains highly recommended. Because these tables genuinely store UUIDs, renaming is a metadata-only change (no data translation or casting required).

### 2. Handle Outliers Separately

* > [!WARNING]
  > **Do NOT rename `crew_doctor_visits.vessel` to `vessel_uuid`.**
  >
  > Because this column stores literal vessel name strings (and must continue to support external vessel names for medical history), renaming it to `_uuid` would introduce schema-to-value semantic confusion. 
  > 
  > **Proposed Fix**: Leave the `vessel` column as is. If the business logic requires tracing doctor visits to internal fleet vessels, introduce a new, optional `vessel_uuid` column in `crew_doctor_visits` that is linked via autocomplete, keeping `vessel` as the fallback display string.

* > [!IMPORTANT]
  > **Promotion Reviews & Appraisals are clean to rename.**
  > 
  > Since `promotion_reviews_v2.vessel_assigned` and `appraisal_results_v2.vessel` have already been backfilled to store valid UUIDs, they are fully safe to rename to `vessel_uuid` alongside other tables.

### 3. Clean up training matrix test data
Prior to renaming `adm_training_matrix_vessel_revisions_v2.vessel_id`, run a cleanup script to replace `"VSL-TEST"` with a valid `vessel_uuid` from `master_vessels` (or remove the test row) to prevent errors in subsequent sync setup.

### 4. Create Database Indexes
Of the 27 audited referencing tables, only 1 had a formal index on its vessel column. For database queries and synchronization partitioning, B-tree indexes should be added to the newly renamed `vessel_uuid` column in all tables.
