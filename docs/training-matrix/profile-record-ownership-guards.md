# Crew-profile record ownership guards

23-Oct-2026. Extends the existing training-certificate guard to travel documents,
visas, licences, pre-joining medicals, doctor visits and recruitment training.

## Scope and compatibility checks

Each type was inspected before changing its update paths. **No record type was
skipped: no existing product functionality was found that legitimately depends on
transferring its owner through ordinary update.**

| Type checked | Owner | Existing flow / compatibility finding |
|---|---|---|
| Travel document | `crew_documents.crew_uuid` | Profile editor sends record fields and the selected crew UUID in the route; edits do not move documents. Recruitment transfer creates a new crew document. |
| Visa | `crew_visas.crew_uuid` | Profile save edits the selected crew member's visa; transfer creates a new row, not a reassignment. |
| Licence | `crew_licenses.crew_uuid` | Selected crew member's existing licence is edited in place; recruitment transfer creates a new licence. |
| Pre-joining medical | `crew_pre_joining_medicals.crew_uuid` | Medical date, result, vessel and related fields can change without changing the seafarer. No transfer-through-update caller found. |
| Doctor visit | `crew_doctor_visits.crew_uuid` | Visit details are edited for the selected crew member. No transfer-through-update caller found. |
| Recruitment training | `cand_training_courses.rec_can_uuid` | Owner is the candidate UUID, not a crew UUID or name. Candidate edits keep that owner. Transfer to crew creates a new `crew_training_courses` record with a new crew UUID and copies certificate data; it does not reassign the candidate record. |

Checked client create/update wrappers in
`client/src/modules/crew-pool/api/crewPoolApiV2.ts`, the profile save hook and
mapper, recruitment API use, server service/repository callers, reconciliation
helpers and `server/v2/crew-pool/services/crewTransferService.ts`. This is a
source-path compatibility investigation, not an inventory of unknown external
API consumers. Repeating the existing owner stays compatible.

## One shared guard; exact behaviour

Reused and generalised **only**
`server/v2/crew-pool/utils/certificateOwnership.ts`. The same
`certificateUpdateFields` function now accepts an owner field name and record
label. Its default still protects training certificates' `crewUuid` with the
previous exact message; no second ownership-check implementation was introduced.
The existing error code `certificate_ownership_immutable` is retained.

A different owner, null or an empty string is refused with **409**, for example:

> Travel document ownership cannot be changed. Delete the travel document and
> re-create it against the correct seafarer.

The other labels are Visa, Licence, Medical record, Doctor visit and Recruitment
training record. The same wording pattern applies. The entire rejected update
saves nothing.

Repeating the stored owner is accepted, but it is removed before the SQL UPDATE.
Ordinary other-field edits and creation remain available. Crew-profile
controllers check raw ownership before schema validation so malformed/null owner
attempts also receive the clear ownership message. Service and repository checks
protect callers that do not go through those controllers.

The five existing crew-profile reconciliation helpers now use their guarded
repositories rather than spreading update data into direct table writes. If a
later item injects a different owner, the transaction rolls back earlier edits.
Recruitment training service/repository apply the same shared guard to
`recCanUuid`.

No permission changes, new transfer feature, course mapping, fixture repair or
application schema change is included.

## Every changed route, method and repository

For the crew routes below, the prefix is
`/api/v2/crew-pool/crew/:crewUuid/`. Their registrations in
`server/v2/crew-pool/routes.ts:100,111,132,169,179` are unchanged.
Recruitment registration is unchanged at
`server/routes/v2/recruitment.ts:186`, mounted under `/api/v2/recruitment`.

| PATCH route | Changed handler |
|---|---|
| `documents/:docUuid` | `server/v2/crew-pool/controllers/crewDocumentsController.ts:105–133` — `update` |
| `visas/:visaUuid` | `server/v2/crew-pool/controllers/crewVisasController.ts:101–129` — `update` |
| `licenses/:licUuid` | `server/v2/crew-pool/controllers/crewLicensesController.ts:104–132` — `update` |
| `medicals/:medUuid` | `server/v2/crew-pool/controllers/crewMedicalController.ts:102–133` — `updateMedical` |
| `doctor-visits/:visitUuid` | Same controller `:248–279` — `updateDoctorVisit` |
| `/api/v2/recruitment/training/:id` | `server/v2/recruitment/controllers/documentsController.ts:566–581` — `updateTrainingCourse` |

| Service | Changed methods and full line ranges |
|---|---|
| `server/v2/crew-pool/services/crewDocumentsService.ts` | `update:100–126`; `reconcileWithAttachments:181–280` |
| `server/v2/crew-pool/services/crewVisasService.ts` | `update:94–114`; `reconcileWithAttachments:176–272` |
| `server/v2/crew-pool/services/crewCertificatesService.ts` | `updateLicense:168–194`; `reconcileLicensesWithAttachments:251–332` |
| `server/v2/crew-pool/services/crewMedicalService.ts` | `updateMedical:98–114`; `updateVisit:206–219`; `reconcileMedicalsWithAttachments:318–402`; `reconcileVisitsWithAttachments:407–482` |
| `server/v2/recruitment/services/documentsService.ts` | `updateTrainingCourse:460–468` |

| Repository | Changed methods and full line ranges |
|---|---|
| `server/v2/crew-pool/repositories/crewDocumentsRepository.ts` | `update:103–121` |
| `server/v2/crew-pool/repositories/crewVisasRepository.ts` | `update:93–111` |
| `server/v2/crew-pool/repositories/crewLicensesRepository.ts` | `update:117–135` |
| `server/v2/crew-pool/repositories/crewMedicalRepository.ts` | `updateMedical:140–158`; `updateVisit:324–342` |
| `server/v2/recruitment/repositories/documentsRepository.ts` | `TrainingCoursesRepository.update:385–396` |

Shared guard: `server/v2/crew-pool/utils/certificateOwnership.ts:3–6,10–23`.
Creation methods and the existing crew-training certificate controller/service/
repository update implementations are unchanged in this task.

## Direct answer: what happens when courseId is edited?

**The old value is overwritten; there is no before/after course-edit audit or
history recording the old `course_id`.** There is last-modified metadata, not a
course change history:

- Crew training updates call `applyAuditUser`, which stamps `updated_at` and
  `updated_by_uuid`. The actor comes from the request's `auditUserUuid` when
  supplied, otherwise null. It is **not** an independently server-derived,
  immutable edit identity:
  `server/v2/admin/utils/auditUser.ts:12–23`;
  `server/v2/crew-pool/controllers/crewTrainingController.ts:115–119`;
  `server/v2/crew-pool/services/crewCertificatesService.ts:374–390`.
- `CrewTrainingRepository.update` overwrites the supplied `course_id`:
  `server/v2/crew-pool/repositories/crewTrainingRepository.ts:103–121`.
- Read-only development inspection found one non-internal trigger on
  `crew_training_courses`: `trg_crew_training_courses_updated_at`, calling
  `set_updated_at()`. It is not a course history trigger.
- Recruitment training likewise overwrites the course reference and stores
  modified-by/time, not the previous reference.
- Previously frozen compliance evidence is not a general course edit log and
  cannot be treated as one.

**`courseId` and `trainUuid` editability are unchanged.** A new test explicitly
edits both on a recruitment training record while preserving its owner; the
existing certificate tests still verify course edits. The 67 unrecognised
development course identifiers are not mapped or repaired.

## Tests

`tests/integration/api/profile-record-ownership.test.ts` adds **54 tests**:

- For **each of six types**: different, null and empty owner refused; ordinary
  other-field edit succeeds; same owner accepted; normal creation succeeds;
  direct service reassignment refused; direct repository reassignment refused
  and same-owner edits accepted. Complete-row equality proves no partial save.
- For **each of five crew reconciliation helpers**: owner injection is refused
  and an earlier valid edit in the same transaction rolls back.
- Recruitment training `courseId` and `trainUuid` remain editable.

The **10 existing training-certificate ownership tests** also pass. Total focused
check: **64 passed, zero failed or skipped**.

Actual Express controllers, actual services and actual repositories are used
against PostgreSQL. The tests are not authentication/permission end-to-end
checks. Test-only triggers raise on any SQL `UPDATE OF crew_uuid/rec_can_uuid`,
even assigning the same value, so same-owner success proves those columns are
excluded from SQL rather than silently re-assigned.

The test requires the independently identity-verified `TEST_DATABASE_URL`. It
creates a private schema with synthetic owners, records and private identity
sequences, no `search_path` fallback to public, then drops that schema. No real
crew data is copied. Test-only DDL is not an application schema change.

## Verification and unchanged data

- Fresh TypeScript: **222 diagnostics**, none in changed files/new tests.
- Development queries use database-enforced repeatable-read **READ ONLY**
  transactions ending in rollback, with database identity verified.
- All-table content/count and schema fingerprints are compared before/after.
  Local ignored evidence is under `generated-artifacts/profile-ownership/`.
- No development fixtures, data, grants or schema are intentionally written.
  Full-suite setup/teardown and the new tests write only in the registered
  isolated test database.
- Before commit, all **272** development-table counts/content fingerprints and
  the schema fingerprint match both the starting snapshot and the preceding
  ownership-guard task's closing snapshot. **No development-data writes:
  VERIFIED.** The 67 unrecognised course references are unchanged.
- Final full-suite/Company Forms gates, post-restart fingerprint comparison,
  HEAD and backend start time are provided in the closing report.
