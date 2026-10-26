# Certificate-to-seafarer linking — read-only diagnostic

Investigation date: 23-Oct-2026 (UTC). Source baseline:
`3febc0aa1663a33745b8bfed3746dd2054c6ca5d`.

## 1. Direct answer: two different links

**Seafarer ownership is by UUID, not by a person's name. Course resolution is by
recognised identifiers/codes, not by the course's display name. Neither is a
database-enforced foreign key in the current development table.**

| Record/link | Storage | Actual mechanism |
|---|---|---|
| Certificate identity | `crew_training_courses.train_uuid` | Unique, non-null text UUID; separate serial `id` primary key |
| Certificate → seafarer | `crew_training_courses.crew_uuid` → `crew_members_v2.crew_uuid` | Non-null text UUID; logical reference, **no FK** |
| Certificate → course | `crew_training_courses.course_id` | Nullable text reference interpreted through the aliases below; **no FK**, not one canonical identifier type |
| Certificate's displayed course | `crew_training_courses.training_course` | Free text; not used by the shared calculator to identify a course |
| Certificate → attachments | `crew_training_attachments.train_uuid` | Logical certificate UUID reference |
| Company course → master | `adm_company_trainings_v2.training_master_id` → `adm_training_master_v2.id` | Numeric master identity used by the reader |

Source: `shared/v2/crew-pool/schema.ts:315–345`;
`migrations/0069_create_crew_pool_v2_tables.sql:351–372`.
Raw `pg_constraint` inspection found only `PRIMARY KEY (id)` and
`UNIQUE (train_uuid)` on `crew_training_courses`; no ownership or course FK.

`server/v2/shared/training-compliance/reader.ts:90–119` builds a map of:

- master UUID (`tm_uuid`) and master code (`training_id`);
- company-course numeric `id` rendered as text, company UUID (`ct_uuid`), and
  company code (`company_id`), each leading to its master's UUID.

It reads certificates with **`WHERE crew_uuid = suppliedCrewUuid AND NOT
is_deleted`**. A `course_id` must match an alias for **exactly one distinct
master UUID**. Zero or multiple matches return `courseUuid = null`. It does not
trim, fuzzy-match, or look up `training_course` by name. A label is used only for
display. These rules apply to both shared matrix consumers.

Creation: `crewTrainingController.ts:81–92` takes the owner from the route's
`crewUuid`; `crewCertificatesService.ts:350–370` verifies that UUID, preserves the
supplied `courseId` or null, and passes the explicit owner to
`crewTrainingRepository.ts:87–100`. All three paths are under
`server/v2/crew-pool/`.

**Is any part based on names/free text instead of IDs?** Seafarer ownership: **no
name matching**. Course reference: **yes, it is stored as text and can be absent
or an old/non-master code**, but **no course-name matching occurs in shared
compliance**. Bulk import stores a course label without a course reference.
Thus “unlinked” in the earlier 388/321/67 report meant **unresolved course
identity**, not an unidentified seafarer.

## 2. Exact breakdown of the 67

Current raw table: **435** records, of which **47** are soft-deleted.
There are **388 active certificates on active seafarers**, **321 recognised
course references**, **67 unresolved course references**, **0 orphaned seafarer
UUIDs**, and **0 certificates belonging to deleted seafarers**.

| Primary cause among the 67 | Count |
|---|---:|
| Missing seafarer ID / orphaned seafarer | 0 |
| Missing course ID | 0 |
| Course identifier resolves to more than one master | 0 |
| Non-empty course identifier resolves to no master | **67** |

The last category contains **10 `TRN-…` values and 57 `SC…` values**. An `SC` or
`TRN` prefix is not a recognised identity merely because it looks like a code.
There are unused `generateCourseId()` helpers producing `SC…` in
`crewCertificatesService.ts:92–115` and `crewTransferService.ts:133–155`; the
current creation paths do not call them. Historical row-by-row writer provenance
cannot be established from those helpers alone.

For diagnostic comparison **only**, normalising case, surrounding whitespace and
repeated internal whitespace in `training_course`, and comparing with both
master `training_name` and company `training_label`, gives:

| Text comparison (not production linking) | Count |
|---|---:|
| No matching master identity | **50** |
| Exactly one candidate master identity | **17** |
| More than one candidate master identity | **0** |

These are secondary comparisons, not an additional 67 records. No name-based
links were installed. A text match does not establish certificate equivalence,
authenticity, or ownership.

### Every unresolved record

`id` is `crew_training_courses.id`. All rows have the same primary reason:
**unrecognised course identifier**. Seafarers are identified by their stored
Employee ID plus name; no person was selected by name. Course text is shown as a
JSON string so trailing spaces and tabs (`\t`) are preserved. “Candidates” is the
diagnostic text comparison above, not an actual link.

| id | Employee ID / seafarer | Course text as stored | course_id | Candidates |
|---:|---|---|---|---:|
| 23 | A000001 KO KO LIN | `"Basic Training for Chemical Tanker Cargo operations"` | TRN-009 | 1 |
| 24 | A000001 KO KO LIN | `"Ship Security Officer (SSO)"` | TRN-008 | 1 |
| 26 | A000001 KO KO LIN | `"CERTIFICATE OF PROFICIENCY FOR SEAFARERS OF THE P.R.C."` | TRN-012 | 0 |
| 28 | A000001 KO KO LIN | `"Advanced Training for Chemical Tanker Cargo Operations"` | TRN-002 | 1 |
| 29 | A000001 KO KO LIN | `"Advanced Training for Oil Tanker Cargo Operations"` | TRN-001 | 1 |
| 30 | A000001 KO KO LIN | `"Advanced Fire Fighting (AFF)"` | TRN-003 | 1 |
| 31 | A000001 KO KO LIN | `"Security Awareness Training"` | TRN-006 | 1 |
| 32 | A000001 KO KO LIN | `"Security Training for Seafarers with Designated Security Duties (STSDSD)"` | TRN-007 | 1 |
| 33 | A000001 KO KO LIN | `"Medical First Aid"` | TRN-005 | 1 |
| 34 | A000001 KO KO LIN | `"Proficiency in Survival Craft & Rescue Boats (PSCRB)"` | TRN-004 | 1 |
| 75 | A000008 LI  GUOHUA | `"BASIC TRAINING"` | SC009 | 1 |
| 76 | A000008 LI  GUOHUA | `"PROFICIENCY IN SURVIVAL CRAFT AND RESCUE BOAT OTHER THAN FAST RESCUE BOATS"` | SC010 | 0 |
| 86 | A000010 ARIV  TUWINGKUNCORO | `"BASIC TRAINING"` | SC011 | 1 |
| 87 | A000010 ARIV  TUWINGKUNCORO | `"PROFICIENCY IN SURVIVAL CRAFT AND RESCUE BOAT OTHER THAN FAST RESCUE BOATS\t\t"` | SC012 | 0 |
| 94 | A000011 MUHAMMAD  SALEH | `"BASIC TRAINING\t\t"` | SC013 | 1 |
| 95 | A000011 MUHAMMAD  SALEH | `"PROFICIENCY IN SURVIVAL CRAFT AND RESCUE BOAT OTHER THAN FAST RESCUE BOATS\t\t"` | SC014 | 0 |
| 96 | A000012 AUNG PYONE MYINT MYAT | `"Basic Safety Training VI/1"` | SC015 | 0 |
| 97 | A000012 AUNG PYONE MYINT MYAT | `"PSCRB (proficiency in survival craft)   VI/2"` | SC015 | 0 |
| 98 | A000012 AUNG PYONE MYINT MYAT | `"Watch-Keeping    "` | SC016 | 0 |
| 99 | A000012 AUNG PYONE MYINT MYAT | `"EDH"` | SC017 | 0 |
| 100 | A000012 AUNG PYONE MYINT MYAT | `"DSD "` | SC018 | 0 |
| 101 | A000012 AUNG PYONE MYINT MYAT | `"SSA    "` | SC019 | 0 |
| 102 | A000012 AUNG PYONE MYINT MYAT | `"Tanker Familiarization          V/1-1"` | SC020 | 0 |
| 103 | A000012 AUNG PYONE MYINT MYAT | `"PSSR Certificate"` | SC021 | 0 |
| 108 | A000013 MIN KAUNG  KHANT | `"BASIC TRAINING\t\t\t\t\t"` | SC022 | 1 |
| 109 | A000013 MIN KAUNG  KHANT | `"PROFICIENCY IN SURVIVAL CRAFT AND RESCUE BOAT OTHER THAN FAST RESCUE BOATS"` | SC023 | 0 |
| 110 | A000014 MYO MIN  THU | `"Basic Safety Training "` | SC024 | 1 |
| 111 | A000014 MYO MIN  THU | `"Watch-Keeping    "` | SC025 | 0 |
| 112 | A000014 MYO MIN  THU | `"PSCRB (proficiency in survival craft)   "` | SC026 | 0 |
| 113 | A000014 MYO MIN  THU | `"SSA    "` | SC027 | 0 |
| 114 | A000014 MYO MIN  THU | `"DSD"` | SC028 | 0 |
| 115 | A000014 MYO MIN  THU | `"Tanker Familiarization "` | SC029 | 0 |
| 116 | A000015 KYAW ZIN  LATT | `"COP/COC Certificates"` | SC030 | 0 |
| 117 | A000015 KYAW ZIN  LATT | `"Basic Safety Training VI/1"` | SC031 | 0 |
| 118 | A000015 KYAW ZIN  LATT | `"PSCRB (proficiency in survival craft)   VI/2"` | SC032 | 0 |
| 119 | A000015 KYAW ZIN  LATT | `"Watch-Keeping    "` | SC033 | 0 |
| 120 | A000015 KYAW ZIN  LATT | `"SSA    "` | SC034 | 0 |
| 121 | A000015 KYAW ZIN  LATT | `"DSD"` | SC035 | 0 |
| 122 | A000015 KYAW ZIN  LATT | `"Tanker Familiarization"` | SC036 | 0 |
| 123 | A000015 KYAW ZIN  LATT | `"PSSR Certificate"` | SC037 | 0 |
| 130 | A000016 INDRA WISYNU  WIBAWA | `"BASIC TRAINING"` | SC038 | 1 |
| 131 | A000016 INDRA WISYNU  WIBAWA | `"PROFICIENCY IN SURVIVAL CRAFT AND RESCUE BOAT OTHER THAN FAST RESCUE BOATS\t\t"` | SC039 | 0 |
| 132 | A000017 TIN MIN  THWE | `"Basic Safety Training VI/1"` | SC040 | 0 |
| 133 | A000017 TIN MIN  THWE | `"PSCRB (proficiency in survival craft)   "` | SC041 | 0 |
| 134 | A000017 TIN MIN  THWE | `"SSA          "` | SC042 | 0 |
| 135 | A000017 TIN MIN  THWE | `"Tanker Familiarization          "` | SC043 | 0 |
| 136 | A000017 TIN MIN  THWE | `"Ship’s Cook Certificate"` | SC044 | 0 |
| 137 | A000017 TIN MIN  THWE | `"DSD "` | SC045 | 0 |
| 138 | A000017 TIN MIN  THWE | `"PSSR Certificate"` | SC046 | 0 |
| 139 | A000018 HEIN  HTET | `"COP/COC Certificates"` | SC047 | 0 |
| 140 | A000018 HEIN  HTET | `"Basic Safety Training VI/1"` | SC048 | 0 |
| 141 | A000018 HEIN  HTET | `"PSCRB (proficiency in survival craft)   VI/2"` | SC049 | 0 |
| 142 | A000018 HEIN  HTET | `"DSD"` | SC050 | 0 |
| 143 | A000018 HEIN  HTET | `"Tanker Familiarization          "` | SC050 | 0 |
| 144 | A000018 HEIN  HTET | `"SSA "` | SC051 | 0 |
| 145 | A000018 HEIN  HTET | `"Ship’s Cook Certificate"` | SC052 | 0 |
| 146 | A000018 HEIN  HTET | `"PSSR Certificate"` | SC053 | 0 |
| 147 | A000019 AUNG MYINT  MYAT | `"PSCRB (proficiency in survival craft)   "` | SC054 | 0 |
| 148 | A000019 AUNG MYINT  MYAT | `"Basic Safety Training "` | SC054 | 1 |
| 149 | A000019 AUNG MYINT  MYAT | `"EDH"` | SC055 | 0 |
| 150 | A000019 AUNG MYINT  MYAT | `"SSA  "` | SC056 | 0 |
| 151 | A000019 AUNG MYINT  MYAT | `"Tanker Familiarization          "` | SC057 | 0 |
| 152 | A000019 AUNG MYINT  MYAT | `"DSD "` | SC057 | 0 |
| 177 | A000002 QIU GEPENG | `"CERTIFICATE OF PROFICIENCY FOR SEAFARERS OF THE P.R.C."` | SC062 | 0 |
| 178 | A000002 QIU GEPENG | `"BASIC TRAINING"` | SC063 | 1 |
| 179 | A000002 QIU GEPENG | `"PROFICIENCY IN SURVIVAL CRAFT AND RESCUE BOAT OTHER THAN FAST RESCUE BOATS\t\t"` | SC064 | 0 |
| 180 | A000019 AUNG MYINT  MYAT | `"PSSR Certificate"` | SC065 | 0 |

## 3. Duplicate-name risk

**Four distinct full names belong to more than one seafarer record** (eight
records total). All eight are active. Normalisation: concatenate non-empty first,
middle and family names, trim, collapse whitespace, lowercase. Each pair also
shares the same displayed spelling, so the collisions do not depend on case
normalisation.

| Name | Employee IDs |
|---|---|
| ANDRIY BOYKO | A100005, A100028 |
| RAVI PATEL | A100014, A100015 |
| EDGAR REYES | A100063, A100090 |
| AMIT SHARMA | A100088, A100083 |

**Can a name collision make the certificate linking mechanism select the wrong
seafarer? No.** The route/service/repository chain in section 1 uses `crewUuid`.
Bulk import uses an Employee-ID-to-generated-UUID map, not a name search
(`crewImportService.ts:385–391, 532–538, 789, 885–897`). Recruitment transfer
creates a new crew UUID and assigns that exact UUID to copied certificates
(`crewTransferService.ts:195–206, 539–558`).

This does **not** prove every historical document belongs to its stored owner.
No external issuing register or identity review of every certificate attachment
was performed. **Wrong-owner records identified: 0; universal ownership
correctness: NOT VERIFIED.** There is no second authoritative holder identity in
these rows against which that claim could be tested.

A separate risk, unrelated to duplicate names: the PATCH schema currently permits
`crewUuid`, and its service/repository update spreads the supplied data
(`crewTrainingController.ts:104–116`, `crewCertificatesService.ts:374–386`,
`crewTrainingRepository.ts:102–113`). Ownership is not immutable at the storage
boundary. No reassignment was attempted. Do not interpret “no name collision
path” as “any arbitrary or erroneous UUID supplied by a writer is safe”.

## 4. Consequence in the current Vessel Training Matrix

Read all current on-board assignments on all active vessels, including registered
fixtures, with the actual server reader and calculator **1.5.0**, using
**23-Oct-2026** as today and saved relief dates (no what-if date). Counted
assignment/course cells before UI filters, not seafarers or distinct courses.

- **238** complete cells currently have state **Not held**.
- **1** of those cells has an unresolved certificate on the **same seafarer's
  UUID**, with a unique normalised master/company-label candidate for the
  required course or a saved accepted equivalent.
- That candidate is **MYO MIN THU, A000014**, required **Basic Training**,
  certificate row **110**, `train_uuid`
  `2327e355-6241-441a-bef5-965db489e90f`, stored course
  `"Basic Safety Training "`, code `SC024`, issue **10-Jan-2024**, expiry
  **17-Dec-2028**.
- A **pure in-memory diagnostic trial**, assigning only that candidate's master
  UUID to the already-read object, changes this one cell from **Not held** to
  **Valid**, choosing that certificate. Contract end is absent, so the normal
  full-contract warning remains. No SQL UPDATE, saved link or changed production
  calculation was involved.
- **0 other Not held cells** have such an exact-normalised-label candidate.

**Answer to “how many because a certificate exists but is unlinked”: one
identified candidate cell, with its effect reproduced in memory; a definitive
causal total is NOT VERIFIED.** The record lacks an authoritative course link;
the 50 labels without exact candidates could include abbreviations or other
courses. Treating “no text match” as proof that none covers a requirement would
be as unsafe as automatically accepting a text match. The one candidate requires
review before it can be counted as a proved correction. It would be misleading
to report either “zero affected cells” or “all 67 create a missing-course dot”.

No wrong-seafarer attachment was demonstrated; see the explicit ownership
verification limit in section 3. The seafarer link is not what prevents these 67
records from counting.

## 5. Certificate creation entry points

Paths below are relative to the workspace root. None of these was executed for
this investigation.

| Entry point | Owner link | Course link / code references |
|---|---|---|
| Crew profile D3, select from database | Explicit crew UUID | Company course code from selected master; `client/src/modules/crew-pool/CrewInfoForm_v2.tsx:2656–2695`; mapper `client/src/modules/crew-pool/mappers/v2ToLegacyMapper.ts:607–619` |
| Crew profile D3, free-text/manual course | Explicit crew UUID | Free-text label, no course ID unless one was selected; `CrewInfoForm_v2.tsx:2802–2822`; current mapper does **not** promote the UI `TRN-…` row ID to a master ID |
| D3 matrix defaults saved from profile / after creating crew | Explicit existing/new crew UUID | Company code supplied by `client/src/modules/crew-pool/utils/d3MatrixDefaults.ts:17–29, 56–114` (functions `d3CourseKey`, `missingD3Defaults`); profile save `CrewInfoForm_v2.tsx:7959–8005, 9292–9311`; same training API |
| Training POST API | Route crew UUID, checked by service | Body `courseId` as text or null, label required; `server/v2/crew-pool/routes.ts:142–148`; controller/service/repository in section 1; client wrapper `client/src/modules/crew-pool/api/crewPoolApiV2.ts:287–290`; hook `hooks/useCrewPoolV2.ts:612–633` |
| Crew bulk Excel import, Training Courses sheet | Normalised **Employee ID**, mapped to newly generated crew UUID | Copies **Course Name only**, leaves `course_id` null; `server/v2/crew-pool/services/crewImportService.ts:385–391, 532–538, 789, 885–897, 1099`; no name-based person lookup |
| Recruitment candidate training entry, then transfer to crew | Candidate UUID first, then newly generated crew UUID on transfer | Candidate `courseId` copied as-is or null, not reconciled by name; `server/v2/recruitment/services/documentsService.ts:449–457`, `repositories/documentsRepository.ts:362–383`; `server/v2/crew-pool/services/crewTransferService.ts:195–206, 539–558`; candidate UI selection/text paths `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx:2035–2045, 2355–2365, 3060–3070` |
| Server reconciliation helper (no current callers found) | Explicit crew UUID for new rows | Spreads supplied course data; `server/v2/crew-pool/services/crewCertificatesService.ts:435–491`; cannot infer a master from the label |
| Registered main-preview fixture bootstrap | Explicit fixture crew UUID | Explicit company IDs `"18"` and `"22"`; `scripts/prepare-training-compliance-fixtures.mjs:89–97`; ordinary reruns reuse registered records |
| Training suggestions acceptance script | Explicit fixture crew UUID, training POST | Explicit company course ID `"18"`; `scripts/verify-training-suggestions.mjs:110–118`; renewal fixture reused when present |
| Isolated compliance reader integration tests | Explicit synthetic crew UUIDs | Explicit synthetic course codes/company numeric IDs, plus intentionally null/invalid references; `tests/integration/api/training-compliance-reader.test.ts:124–127, 471–476, 491–494, 558–562` |

The repository create helper is a lower-level writer, not an additional route.
`training-suggestion-ledger.test.ts` clones the certificate table but does not
insert certificate rows. The inspected seed commands
`scripts/seed-isolated-tests.ts`, `scripts/seed-2026-demo.ts`,
`scripts/seed-test-script-data.ts` contain no D3 certificate insert.
The crew attachment ZIP import adds attachments to pre-existing records rather
than creating certificates (`crewAttachmentImportService.ts:74`).
Verification scripts for matrix/checklist/live corrections update registered
fixture dates, not a new certificate-creation family.

Recruitment stores its own `cand_training_courses` first; it is not a crew
certificate visible to this matrix until the explicit transfer. Legacy
`shared/schema.ts` JSON `trainingCourses` profile fields are not the
`crew_training_courses` table read by this calculator.

## 6. Options — not implemented

1. Keep current conservative identity-only resolution. Office users review
   original certificates and explicitly select the correct master course, keeping
   original labels and an audit trail. Do not bulk-resolve by seafarer or course
   name.
2. Add one canonical master UUID field/reference and validate it on every writer,
   including recruitment transfer and Excel import. Existing codes remain legacy
   evidence, not competing identity namespaces. Plan an audited, reviewed
   migration; do not assume the 17 text candidates are approved matches.
3. Extend the Excel template with an explicit validated master/company course
   identifier while retaining original course text. Employee ID continues to
   establish crew ownership; reject ambiguous or unknown identifiers visibly.
4. Separately consider FK enforcement and making certificate ownership immutable
   through ordinary PATCH. These are schema/security changes needing approval,
   not diagnostic “repairs”.

**No fix, schema migration, course mapping, fixture creation, grant change or
development-data write was made.** Only this requested findings document is
committed. Test suites use the independently registered test database and may
write/clean up there; that is not a claim that tests themselves are read-only.

## 7. Read-only evidence and gates

Every development diagnostic query ran inside
`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, ending with `ROLLBACK`.
The driver wrapper rejected every statement except SELECT and those transaction
boundaries. `transaction_read_only = on` was asserted at start and finish.
Database identity (cluster system identifier plus database OID) was checked
against the independently registered test identity; this investigation targeted
development `heliumdb`, not the test database.

Local ignored evidence: `generated-artifacts/certificate-linking/evidence.json`
(all 67 certificate and crew UUIDs, categories, duplicate groups and in-memory
trial), `console.json`, `before.json`, and `closing.json`. The diagnostic findings
are printed to the console as well as written here. Before/after all-table content
fingerprints and schema fingerprints, gate results, final commit and subsequent
backend start are reported at closing.

Closing checks before commit:

- All **272** user-table row counts and content fingerprints match the starting
  snapshot. Column-schema fingerprint and eight protected calculation/reader/UI
  source hashes also match.
- Fresh full suite: **1,689 passed / 162 failed / 67 pending**. The failure-name
  set has no additions against the preceding control-bar run; the full suite
  still exits nonzero because of the existing failures.
- Authoritative Company Forms discovery: **97 suites, 661 passed, zero
  skipped/pending/todo, no missing or failed suites**.
- Fresh `tsc --noEmit --pretty false`: **222 diagnostics**.
- All **67** table rows above were compared programmatically against the
  read-only evidence, including the exact JSON-escaped original course text.
- Full-suite output: `/tmp/certificate-linking-full-suite.json` and
  `/tmp/certificate-linking-full-suite.log`; compiler output:
  `/tmp/certificate-linking-typescript.log`.

**Development database writes: none, VERIFIED** by enforced read-only diagnostic
transactions and matching all-table content/schema fingerprints. This statement
does not include the isolated test database, where the requested full test suite
performs its normal setup and teardown. Runtime ordering and post-restart
fingerprint verification are supplied with the final commit report.
