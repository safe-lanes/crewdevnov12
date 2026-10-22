# Frozen snapshot integrity — read-only findings

Investigation: 22-Oct-2026. Source HEAD at investigation:
`bedabbbfa370ae1af70f3779905ede9712b9d906`.

## 1. Conclusion: the earlier reports did not identify an orphaned acceptance

The single **unallocatable on-board check** is for the registered attachment
security fixture **TEST ONLY ATTACHMENT OTHER**, on **TEST ONLY attachment other
vessel**. That vessel has no saved training matrix. The report calculated a live
on-board result; it did not read a checklist acceptance or its frozen evidence.

There is **no persisted compliance-check ID, no associated checklist acceptance,
and no snapshot creation/modification timestamp for that check**. Giving it a
snapshot ID would invent a record. Its exact assignment and timestamps are below.

The database contains **two historical acceptance snapshots, both with a frozen
matrix**, for one different plan/assignment pair. There are **zero currently
accepted checklists**, and **zero currently accepted checklists missing a snapshot**.
It is **not** the case that exactly one checklist acceptance lacks a snapshot.

### Identification

| Fact | Observed value |
| --- | --- |
| Seafarer | TEST ONLY ATTACHMENT OTHER |
| Crew ID | TEST-ATTACHMENT-OTHER |
| Crew UUID | `a4200000-0000-4000-8000-000000000001` |
| Vessel | TEST ONLY attachment other vessel |
| Vessel UUID | `a4200000-0000-4000-8000-000000000002` |
| Assignment numeric ID | 5411 |
| Assignment UUID / live-check identity | `a4200000-0000-4000-8000-000000000003` |
| Assignment state | OnBoard |
| Assignment created_at, raw database value | `2026-10-20 15:25:05.9414` |
| Assignment updated_at, raw database value | `2026-10-20 15:25:05.9414` |
| Planning links, incumbent or reliever, including deleted/archived | 0 |
| Acceptance snapshots for this assignment | 0 |
| Captured contract rank UUID | NULL |
| Saved matrix revisions for this vessel, including soft-deleted | 0 |

## 2. Why the gap exists, and what can and cannot be proved

The fixture writer at
`scripts/prepare-attachment-display-fixtures.mjs:73–85` creates the vessel, crew
member and an already-on-board assignment directly. It does not perform Deploy,
create planning, accept a checklist, capture a contract rank or publish a training
matrix. Its registration is in
`docs/company-form-regression-fixtures.md:74–82`.

The earlier impact report's actual calculation path is
`generated-artifacts/certificate-expires-impact/report.ts:111–128`:
`readOnboardAssignments` → `readOnboardCompliance`; an incomplete result with no
allocatable courses is counted separately. That path does **not** query
`training_checklist_snapshots`.

The current application-source reader is
`server/v2/shared/training-compliance/onboard.ts:17–35,74–89`.
It reads the assignment and calls `readSavedTrainingMatrix`.
`server/v2/shared/training-compliance/reader.ts:34–51` selects the latest
non-deleted revision by that exact vessel UUID. No revision means `matrix: null`.
This is a **missing saved vessel configuration**, not a missing frozen acceptance
snapshot, wrong snapshot key, broken foreign key or a version lookup failure.

Re-running that existing reader for this exact fixture and 22-Oct-2026, with the
same database-enforced read-only transaction, returned:

```json
{"assignmentUuid":"a4200000-0000-4000-8000-000000000003",
 "crewName":"TEST ONLY ATTACHMENT OTHER","status":"incomplete",
 "issues":[
   {"code":"MISSING_RANK",
    "message":"Contract rank was not recorded at Deploy. Record the contract rank and retry the check."},
   {"code":"MISSING_MATRIX",
    "message":"No saved training matrix is available for this vessel. Ask the office to publish one, then retry."},
   {"code":"CONTRACT_END_NOT_SET","blocking":false,
    "message":"Contract end not set: enter Contract End Range to check validity for the whole contract"}
 ],"matrix":null,"courses":[]}
```

The current database has no revision under that vessel, even soft-deleted, and
no acceptance/planning linkage for the assignment. The fixture's creation path
explains why none was supplied. However, absence from today's tables is not proof
that no privileged hard-delete ever happened. There is no complete historical
matrix-deletion ledger establishing that stronger claim; **whether any matrix
was ever written and subsequently hard-deleted is NOT VERIFIED**. There is no
evidence of such a deletion, and none is needed to explain the live report.

No claim is made that the assignment's unchanged timestamps prove the complete
history of every related table.

## 3. Database-wide inventory and the acceptance-history limitation

All relevant base tables are in `public`; no additional tenant schema contains
another copy of these tables. No deleted or archived planning row was excluded
from the checklist inventory.

| Inventory | Count |
| --- | ---: |
| Planning rows, all states | 109 |
| Currently `deployment_checklist_completed = true` | 0 |
| Currently accepted, with exact plan + current reliever snapshot | 0 |
| Currently accepted, without exact plan + current reliever snapshot | 0 |
| Historical acceptance snapshot rows | 2 |
| Distinct historical plan + assignment pairs | 1 |
| Historical snapshots with frozen matrix object | 2 |
| Historical snapshots with absent/null matrix | 0 |
| Snapshots referencing a missing plan or assignment | 0 |

**Every current acceptance without a snapshot: none (`[]`).**
**Exactly one live on-board assignment has no retrievable saved vessel matrix.**
These are different counts and must not be conflated.

The two historical acceptance events are:

| Snapshot UUID | Recorded at (UTC) | Frozen matrix revision UUID |
| --- | --- | --- |
| `1990876f-12dd-4e5a-8404-6e474a4d0572` | 21-Oct-2026 09:26:52.463277 | `9f2ae8cd-fcd2-4569-a2b1-b3b8632bd95c` |
| `2bc5a570-3abd-4f50-ae4e-830e7236c145` | 21-Oct-2026 09:26:56.578984 | `9f2ae8cd-fcd2-4569-a2b1-b3b8632bd95c` |

Both belong to planning row **3440**,
`068511d9-9c64-4125-9e55-f3e4b41beac0`, assignment
`dc2528aa-45d1-4507-95a3-5128b9501065`, seafarer
**TEST ONLY PDF Layout Seafarer**, vessel **TEST ONLY PDF layout review**.
Each embeds two requirements and three certificates; the referenced revision also
exists. The current planning checklist is false; its updated_at is
`2026-10-21 14:13:25.872917+00`. Historical evidence remains despite that current
false value. A snapshot has `recorded_at`, not `updated_at`; its UPDATE/DELETE
trigger prohibits modification.

There is no independent all-time checklist-acceptance ledger against which to
prove the completeness of the snapshot table. The two rows are the two
**identifiable recorded historical acceptance events**, not proof that no
pre-guard/privileged historic Yes transition ever occurred without one.
Reconstructing every historic Yes transition from the current boolean alone is
**NOT VERIFIED**. This limitation is not evidence of a particular missing event.

## 4. Write path and direct transactional answer

1. `server/v2/vessel/services/vesselPlanningService.ts:1206–1225` opens the
   transaction and locks the planning/assignment linkage.
2. If the proposed checklist value is true, lines 1214–1219 write proposed
   non-checklist facts and call `verifyChecklistYes` on the **same transaction**.
3. `server/v2/company-forms/checklistGate.ts:83–110` calculates training evidence,
   checks the separate training-override authority/reason and refuses unauthorized
   blockers. Lines 129–139 call `recordTrainingAcceptance`.
4. `server/v2/shared/training-compliance/checklistEvidence.ts:54–63` inserts the
   frozen JSON, server actor, timestamp and fingerprint into
   `training_checklist_snapshots`; only then does it set the transaction-local
   `sail.training_verified_plan` marker.
5. The planning service updates the checklist at line 1221 and commits by
   returning from the transaction. A later failure rolls back both writes.
6. `migrations/0262_training_checklist_write_guard.sql:1–12` installs the
   dual-marker guard on the existing planning trigger;
   `migrations/0261_training_checklist_evidence.sql:12–28` defines the snapshot
   foreign keys and immutability. Actual installed definitions were queried too.

**Can an acceptance succeed while the snapshot INSERT fails? NO, on this
application acceptance path.** The exception propagates out of the shared
transaction; the Yes update cannot commit independently. This is not a claim that
a privileged SQL operator cannot disable triggers or set markers deliberately.

The history reader at
`server/v2/vessel/controllers/trainingChecklistHistoryController.ts:21–25` reads
the same snapshot table, scoped to the plan's exact current reliever assignment.
It returns the embedded evidence; it does not need to reconstruct the frozen
matrix from today's revision/master tables.

## 5. Comparison with nullable Deploy rank capture

**Is the snapshot writer always called for a successful acceptance through this
path? YES.** The call at `checklistGate.ts:130–139` is unconditional after the
gates pass. Earlier refusal does not constitute a successful acceptance.

**Can acceptance finish without storing a usable frozen matrix? YES, with an
authorized, reasoned training override of an incomplete check.** It still stores
an actual snapshot row, but that row may record `matrix: null` and an incomplete
check. This is different from a failed INSERT or a missing snapshot row.

Specifically, `checklistEvidence.ts:13–46` initializes `matrix` to null, uses a
savepoint for evidence calculation and converts calculation exceptions to an
incomplete check. A missing matrix is also an incomplete check without requiring
an exception. `checklistPolicy.ts:27–34` makes those global incomplete issues
blockers. `checklistGate.ts:83–110` permits proceeding only with the separate
training override permission and a valid written reason, then saves that state.
There is no database CHECK requiring `evidence.matrix` to be an object; the JSON
column is NOT NULL, but nested values can be null.

Thus, as with Deploy's unconditional
`captureDeployRank` call at
`server/v2/rotation/services/rotationDeployService.ts:189`, an unconditional call
alone does not guarantee non-null underlying facts. The snapshot path **does**
guarantee a row on this acceptance transaction, but not a successful matrix
calculation when the user explicitly overrides its failure.

**Observed instances of accepted evidence with null/absent matrix: ZERO.**
Neither historical acceptance here is such a case.

## 6. Raw SQL and returned evidence

The following SQL ran on the development database in
`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, followed by `ROLLBACK`.
Database identity was checked against the registered test identity and was not
the registered test database. Only SELECT and transaction-control statements
were issued on the diagnostic connections.

### Transaction and schema scope

```sql
SELECT current_database() AS database, clock_timestamp() AS observed_at,
       current_setting('transaction_read_only') AS read_only,
       current_setting('transaction_isolation') AS isolation;
```

```json
[{"database":"heliumdb","observed_at":"2026-10-22T11:36:31.830Z",
  "read_only":"on","isolation":"repeatable read"}]
```

```sql
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_type='BASE TABLE' AND table_name IN
 ('training_checklist_snapshots','vessel_planning_v2',
  'adm_training_matrix_vessel_revisions_v2')
ORDER BY table_schema, table_name;
```

```json
[{"table_schema":"public","table_name":"adm_training_matrix_vessel_revisions_v2"},
 {"table_schema":"public","table_name":"training_checklist_snapshots"},
 {"table_schema":"public","table_name":"vessel_planning_v2"}]
```

### All live on-board assignments without an active saved matrix

```sql
SELECT a.id,a.assign_uuid,c.crew_uuid,c.emp_no,
       btrim(concat_ws(' ',c.first_name,c.middle_name,c.family_name)) AS seafarer,
       v.vessel_uuid,v.vessel,a.assignment_type,
       a.created_at::text,a.updated_at::text,x.contract_rank_uuid,
       (SELECT count(*) FROM vessel_planning_v2 p
        WHERE p.crew_assign_uuid=a.assign_uuid
           OR p.reliever_assign_uuid=a.assign_uuid) AS planning_links,
       (SELECT count(*) FROM training_checklist_snapshots s
        WHERE s.assignment_uuid=a.assign_uuid) AS acceptance_snapshots
FROM crew_assignments a
JOIN crew_members_v2 c USING(crew_uuid)
JOIN master_vessels v USING(vessel_uuid)
LEFT JOIN crew_assignment_rule_context x USING(assign_uuid)
WHERE a.assignment_type='OnBoard' AND NOT a.is_deleted
  AND NOT c.is_deleted AND NOT v.is_deleted
  AND NOT EXISTS (
    SELECT 1 FROM adm_training_matrix_vessel_revisions_v2 r
    WHERE r.vessel_id=a.vessel_uuid AND NOT r.is_deleted);
```

```json
[{"id":5411,"assign_uuid":"a4200000-0000-4000-8000-000000000003",
  "crew_uuid":"a4200000-0000-4000-8000-000000000001",
  "emp_no":"TEST-ATTACHMENT-OTHER","seafarer":"TEST ONLY ATTACHMENT OTHER",
  "vessel_uuid":"a4200000-0000-4000-8000-000000000002",
  "vessel":"TEST ONLY attachment other vessel","assignment_type":"OnBoard",
  "created_at":"2026-10-20 15:25:05.9414",
  "updated_at":"2026-10-20 15:25:05.9414","contract_rank_uuid":null,
  "planning_links":"0","acceptance_snapshots":"0"}]
```

```sql
SELECT count(*) AS all_revisions,
       count(*) FILTER(WHERE is_deleted) AS soft_deleted_revisions
FROM adm_training_matrix_vessel_revisions_v2
WHERE vessel_id='a4200000-0000-4000-8000-000000000002';
```

```json
[{"all_revisions":"0","soft_deleted_revisions":"0"}]
```

### Every current checklist acceptance, including deleted/archived planning

```sql
SELECT count(*) AS all_planning_rows,
 count(*) FILTER(WHERE deployment_checklist_completed IS TRUE) AS accepted_now,
 count(*) FILTER(WHERE deployment_checklist_completed IS TRUE AND EXISTS(
   SELECT 1 FROM training_checklist_snapshots s
   WHERE s.plan_uuid=p.plan_uuid
     AND s.assignment_uuid=p.reliever_assign_uuid)) AS accepted_now_with_snapshot,
 count(*) FILTER(WHERE deployment_checklist_completed IS TRUE AND NOT EXISTS(
   SELECT 1 FROM training_checklist_snapshots s
   WHERE s.plan_uuid=p.plan_uuid
     AND s.assignment_uuid=p.reliever_assign_uuid)) AS accepted_now_without_snapshot
FROM vessel_planning_v2 p;
```

```json
[{"all_planning_rows":"109","accepted_now":"0",
  "accepted_now_with_snapshot":"0","accepted_now_without_snapshot":"0"}]
```

```sql
SELECT p.id,p.plan_uuid,p.reliever_assign_uuid,p.created_at,p.updated_at
FROM vessel_planning_v2 p
WHERE deployment_checklist_completed IS TRUE AND NOT EXISTS(
 SELECT 1 FROM training_checklist_snapshots s
 WHERE s.plan_uuid=p.plan_uuid AND s.assignment_uuid=p.reliever_assign_uuid)
ORDER BY p.id;
```

```json
[]
```

### Every historical snapshot

```sql
SELECT count(*) AS historical_acceptance_snapshots,
 count(DISTINCT (plan_uuid,assignment_uuid)) AS distinct_plan_assignment_pairs,
 count(*) FILTER(WHERE jsonb_typeof(evidence->'matrix')='object')
   AS with_frozen_matrix,
 count(*) FILTER(WHERE evidence->'matrix' IS NULL
   OR evidence->'matrix'='null'::jsonb) AS without_frozen_matrix
FROM training_checklist_snapshots;
```

```json
[{"historical_acceptance_snapshots":"2","distinct_plan_assignment_pairs":"1",
  "with_frozen_matrix":"2","without_frozen_matrix":"0"}]
```

```sql
SELECT s.snapshot_uuid,s.plan_uuid,s.assignment_uuid,s.recorded_at::text,
 jsonb_typeof(s.evidence->'matrix') AS matrix_type,
 s.evidence#>>'{matrix,revisionUuid}' AS frozen_revision_uuid,
 s.evidence#>>'{check,status}' AS check_status,
 jsonb_array_length(s.evidence#>'{matrix,requirements}') AS requirements,
 jsonb_array_length(s.evidence->'certificates') AS certificates,
 EXISTS(SELECT 1 FROM adm_training_matrix_vessel_revisions_v2 r
   WHERE r.tmvr_uuid=s.evidence#>>'{matrix,revisionUuid}') AS revision_exists,
 s.evidence_sha256
FROM training_checklist_snapshots s ORDER BY recorded_at;
```

```json
[{"snapshot_uuid":"1990876f-12dd-4e5a-8404-6e474a4d0572",
  "plan_uuid":"068511d9-9c64-4125-9e55-f3e4b41beac0",
  "assignment_uuid":"dc2528aa-45d1-4507-95a3-5128b9501065",
  "recorded_at":"2026-10-21 09:26:52.463277+00","matrix_type":"object",
  "frozen_revision_uuid":"9f2ae8cd-fcd2-4569-a2b1-b3b8632bd95c",
  "check_status":"complete","requirements":2,"certificates":3,
  "revision_exists":true,
  "evidence_sha256":"11a19dbe8e68a8bd14585427774396a14a926c62ca8524689d069475a9e492ce"},
 {"snapshot_uuid":"2bc5a570-3abd-4f50-ae4e-830e7236c145",
  "plan_uuid":"068511d9-9c64-4125-9e55-f3e4b41beac0",
  "assignment_uuid":"dc2528aa-45d1-4507-95a3-5128b9501065",
  "recorded_at":"2026-10-21 09:26:56.578984+00","matrix_type":"object",
  "frozen_revision_uuid":"9f2ae8cd-fcd2-4569-a2b1-b3b8632bd95c",
  "check_status":"complete","requirements":2,"certificates":3,
  "revision_exists":true,
  "evidence_sha256":"7fe4a30720acdb47c6eb09bb90bbd8f487e03648ed20d4ca1020306bbf2f1428"}]
```

```sql
SELECT count(*) AS missing_plan_or_assignment
FROM training_checklist_snapshots s
LEFT JOIN vessel_planning_v2 p USING(plan_uuid)
LEFT JOIN crew_assignments a ON a.assign_uuid=s.assignment_uuid
WHERE p.plan_uuid IS NULL OR a.assign_uuid IS NULL;
```

```json
[{"missing_plan_or_assignment":"0"}]
```

### Actual database constraints and triggers

```sql
SELECT conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid='training_checklist_snapshots'::regclass
ORDER BY conname;
```

```json
[{"conname":"training_checklist_snapshots_assignment_uuid_fkey",
  "definition":"FOREIGN KEY (assignment_uuid) REFERENCES crew_assignments(assign_uuid) ON DELETE RESTRICT"},
 {"conname":"training_checklist_snapshots_evidence_sha256_check",
  "definition":"CHECK ((evidence_sha256 ~ '^[a-f0-9]{64}$'::text))"},
 {"conname":"training_checklist_snapshots_pkey",
  "definition":"PRIMARY KEY (snapshot_uuid)"},
 {"conname":"training_checklist_snapshots_plan_uuid_fkey",
  "definition":"FOREIGN KEY (plan_uuid) REFERENCES vessel_planning_v2(plan_uuid) ON DELETE RESTRICT"}]
```

```sql
SELECT tgname,pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid IN('training_checklist_snapshots'::regclass,
                'vessel_planning_v2'::regclass)
  AND NOT tgisinternal ORDER BY tgname;
```

```json
[{"tgname":"training_checklist_snapshots_immutable",
  "definition":"CREATE TRIGGER training_checklist_snapshots_immutable BEFORE DELETE OR UPDATE ON public.training_checklist_snapshots FOR EACH ROW EXECUTE FUNCTION training_checklist_evidence_immutable()"},
 {"tgname":"training_suggestion_plan_withdraw",
  "definition":"CREATE TRIGGER training_suggestion_plan_withdraw AFTER UPDATE OF relief_status, is_deleted, is_archived ON public.vessel_planning_v2 FOR EACH ROW EXECUTE FUNCTION withdraw_training_suggestions()"},
 {"tgname":"trg_frm_checklist_verified_write",
  "definition":"CREATE TRIGGER trg_frm_checklist_verified_write BEFORE INSERT OR UPDATE OF deployment_checklist_completed ON public.vessel_planning_v2 FOR EACH ROW EXECUTE FUNCTION frm_checklist_verified_write()"},
 {"tgname":"trg_vessel_planning_v2_updated_at",
  "definition":"CREATE TRIGGER trg_vessel_planning_v2_updated_at BEFORE UPDATE ON public.vessel_planning_v2 FOR EACH ROW EXECUTE FUNCTION set_updated_at()"}]
```

## 7. Possible follow-up, NOT implemented

No repair is needed to a demonstrated orphaned snapshot: none was found.
Keep terminology explicit in future reporting: **live check with no saved vessel
matrix** versus **accepted checklist with frozen evidence**.

If a stronger frozen-evidence contract is desired, first decide how an authorized
override of an unavailable matrix should be represented. A discriminated
complete/incomplete evidence format with an explicit unavailable-matrix reason
would be safer than treating every snapshot row as proof of a usable matrix.
Do not silently prohibit the approved independent override, fabricate a matrix,
reconstruct old evidence from current facts, or rewrite immutable historical rows.

Separately, the attachment fixture could receive deliberate training configuration
and captured-rank provenance in a future authorized fixture change, if it is to be
used as a training scenario. No such fixture change was made here.

## 8. Verification and scope of “no writes”

The only intended tracked change is this findings document. No application/test
code, migration, schema, fixture or development data was changed by the diagnostic.
Every diagnostic database connection used database-enforced read-only transactions
and rolled back. The requested automated gates run against the independently
registered **test** database; their normal synthetic fixture writes/cleanup must
not be described as “no writes anywhere”.

### Closing gates

Fresh full-suite run:

```text
npm test -- --reporter=dot --reporter=json \
  --outputFile=/tmp/snapshot-integrity-full-suite.json
1,663 passed / 162 failed / 67 pending
No new failing assertions against the preceding full-suite report.
```

Company Forms was checked from that same full run using the authoritative test
discovery and result-checking functions in
`scripts/verify-company-forms-tests.mjs`: **97 suites, 661 passed, zero failed,
skipped, pending or todo; no missing suites**.

Fresh `npx tsc --noEmit --pretty false`: **222 diagnostics**.
The full-suite exit was 1 because the existing 162 failures remain; it is not a
green full suite.

The test identity guard confirmed target `sail_automated_tests` matches the
registered cluster/database identity and differs from development `heliumdb`.

### Development data unchanged

Before and after the gates, SELECT-only comparisons covered **all 272 user tables**,
including their row counts and order-independent content fingerprints. Every
count and content fingerprint matched. The column-definition fingerprint also
matched: `dc7b95f6db0f5ca3709eb81531d9deeb`.

The diagnostic table fingerprints additionally include:

| Table | Rows | Content fingerprint |
| --- | ---: | --- |
| training_checklist_snapshots | 2 | `092bb96c4f6297d271d367ace2369217` |
| vessel_planning_v2 | 109 | `79c004d888e337c6b43800a5c573d62c` |
| crew_assignments | 248 | `fc25272f7458b39d5e72d37701834e9c` |
| adm_training_matrix_vessel_revisions_v2 | 9 | `3f892d38353503491a929bfa856e2f34` |
| crew_assignment_rule_context | 60 | `4ff0c36f7e6fe302c2ba3ae3425ce113` |
| adm_access_control_audit | 51 | `35a9f0950232388d6f331524adee9e66` |

For each qualified user table, the comparison query was:

```sql
SELECT count(*)::text AS count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),''
   ORDER BY md5(to_jsonb(t)::text)),'')) AS hash
FROM public.<table> t;
```

Table identifiers came only from `pg_tables` and were quoted before execution.
These MD5 values are change-detection fingerprints, not the application's
accepted-evidence SHA-256 values.

**No development-data or schema writes were made by the investigation: CONFIRMED
for its database connections, enforced by PostgreSQL read-only transactions.**
No fixtures were created, repaired or removed. Tests performed their normal
synthetic fixture lifecycle only in the isolated test database. Unchanged
fingerprints establish unchanged persisted content, not an audit of every
possible transient write by unrelated processes.

The final commit and the subsequent main-backend start time are reported in the
completion message; this document does not embed its own commit hash.
