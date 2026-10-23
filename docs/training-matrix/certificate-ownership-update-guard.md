# Immutable training certificate ownership on ordinary edit

23-Oct-2026. Scope: only the `crew_uuid` owner of an existing
`crew_training_courses` record. No course mapping, repair or schema migration.

## Behaviour

An ordinary update requesting a different `crewUuid`, including null or an empty
string, is refused with HTTP **409**:

```json
{
  "error": "certificate_ownership_immutable",
  "message": "Certificate ownership cannot be changed. Delete the certificate and re-create it against the correct seafarer."
}
```

No part of that update is saved. Supplying the existing owner is accepted for
compatibility, but the owner field is stripped from the SQL update. Omitting it
continues to permit normal edits. Creation still sets ownership normally.

The controller checks ownership before schema parsing so an attempted null/empty
owner receives the same clear explanation instead of an unrelated validation
error. Independent service and repository checks protect non-controller callers.
The reconciliation helper now uses that guarded repository for existing records,
so a runtime-injected owner cannot bypass the TypeScript `Omit` declaration.
Its transaction rolls back earlier edits if a later item attempts a transfer.

## Changed route and methods

| Boundary | File / lines | Change |
|---|---|---|
| `PATCH /api/v2/crew-pool/crew/:crewUuid/training/:trainUuid` | Route registration unchanged: `server/v2/crew-pool/routes.ts:145`; handler `server/v2/crew-pool/controllers/crewTrainingController.ts:104–134` | Check supplied owner, omit it from validated update fields, return clear 409 |
| `crewCertificatesService.updateTraining` | `server/v2/crew-pool/services/crewCertificatesService.ts:373–390` | Validate against the stored owner and remove it before mutation |
| `crewCertificatesService.reconcileTrainingWithAttachments` | Same service, existing-item branch `:472–478` | Route existing-item writes through guarded repository |
| `CrewTrainingRepository.update` | `server/v2/crew-pool/repositories/crewTrainingRepository.ts:103–121` | Validate supplied owner against the stored UUID; never include that owner in UPDATE |
| Shared error and field guard | `server/v2/crew-pool/utils/certificateOwnership.ts:1–19` | Stable error, explicit owner comparison, owner removal |

No other route handler or service method was changed. POST creation is unchanged.
Delete behaviour, course identifiers, attachment handling, suggestion calculation,
permissions and audit policy are unchanged.

## Compatibility investigation

**No existing product functionality was found that depends on changing
`crewUuid` through update.** Searched callers of `updateTraining`,
`CrewTrainingRepository.update`, and `reconcileTrainingWithAttachments`, and the
D3 API wrapper, save hook, profile edit and post-create save paths.

- D3 passes the target crew UUID in the URL and sends certificate fields without
  an owner in the update body:
  `client/src/modules/crew-pool/api/crewPoolApiV2.ts:287–295`;
  `hooks/useCrewPoolV2.ts:612–633`;
  `mappers/v2ToLegacyMapper.ts:607–619`;
  `CrewInfoForm_v2.tsx:7959–8005`.
- Recruitment transfer creates new certificate rows with the new crew UUID; it
  does not transfer an existing row by PATCH:
  `server/v2/crew-pool/services/crewTransferService.ts:539–558`.
- Bulk import creates rows linked by Employee ID and a generated crew UUID:
  `server/v2/crew-pool/services/crewImportService.ts:789, 885–897, 1099`.
- No current caller of the reconciliation helper was found. Its declared update
  data already excludes owner UUIDs, but runtime input now has a real guard.

This is a source-path investigation, not a claim that arbitrary external API
consumers have been inventoried. Sending the same owner remains compatible.

## Related patterns — report only, deliberately unchanged

These are storage/server capability findings, not evidence that a browser screen
offers reassignment or that current records are misassigned.

| Record / editable subject or identity fields | Evidence |
|---|---|
| Training certificate `courseId` → `course_id` | Still accepted by ordinary PATCH and stored. This can intentionally correct course selection; no change made. `crewTrainingController.ts:111–119`, `crewTrainingRepository.ts:103–121`. The new isolated test explicitly verifies it remains editable. |
| Training certificate `trainUuid` → `train_uuid` | Still in the partial insert schema and spread update; not made immutable by this task. `shared/v2/crew-pool/types.ts:165–170`, controller/repository above. |
| Travel document `crewUuid`, `docUuid`, `documentId` | Partial insert schema accepted by `server/v2/crew-pool/controllers/crewDocumentsController.ts:104–113`; `crewDocumentsService.ts:99–123` resolves country then passes other fields through; `crewDocumentsRepository.ts:102–113` spreads them into `crew_documents`. |
| Visa `crewUuid`, `visaUuid` | `crewVisasController.ts:100–110`, `crewVisasService.ts:93–109`, `crewVisasRepository.ts:92–103`; same partial-schema/spread pattern in `crew_visas`. |
| Licence `crewUuid`, `licUuid`, `licenseId` | `crewLicensesController.ts:103–112`, `crewCertificatesService.ts:168–193`, `crewLicensesRepository.ts:116–127`; same pattern in `crew_licenses`. |
| Pre-joining medical `crewUuid`, `medUuid` and vessel reference | `crewMedicalController.ts:101–112`, `crewMedicalService.ts:97–112`, `crewMedicalRepository.ts:139–150`; same pattern in `crew_pre_joining_medicals`, with vessel master-data resolution. |
| Doctor visit `crewUuid`, `visitUuid` | `crewMedicalController.ts:239–250`, `crewMedicalRepository.ts:316–327`; same pattern in `crew_doctor_visits`. |
| Recruitment training `recCanUuid`, `trainUuid`, `courseId` | `server/v2/recruitment/controllers/documentsController.ts:565–577`, `services/documentsService.ts:459–461`, `repositories/documentsRepository.ts:384–388`; update passes supplied data into `cand_training_courses`. |

Paths abbreviated in the table are beneath `server/v2/crew-pool/` except where a
full path is provided. These fields remain unchanged. No wider identity-locking
policy has been silently introduced.

## Tests and data boundary

`tests/integration/api/training-certificate-ownership.test.ts` exercises a real
Express route mounted on the actual controller, the actual service, crew
existence lookup and repository against real PostgreSQL tables. Only the
unrelated suggestion-lock/reconciliation effects are stubbed; this is not an
end-to-end authentication or permissions test.

Ten cases cover:

1. A different owner is refused; the complete row is unchanged.
2. Null owner is refused; the complete row is unchanged.
3. Empty owner is refused; the complete row is unchanged.
4. Ordinary certificate-number and expiry edits succeed.
5. Repeating the same owner succeeds without moving the certificate.
6. Creation with the route's crew UUID succeeds.
7. Direct service reassignment is refused.
8. Direct repository reassignment is refused; same-owner normal edits succeed.
9. Reconciliation injection is refused and its earlier edit rolls back.
10. Course ID edits remain permitted, independently of immutable crew ownership.

The test requires the identity-verified `TEST_DATABASE_URL`, creates a private
schema there with no `search_path` fallback to public, and drops it afterwards.
Its two tables retain normal defaults but use private identity sequences rather
than advancing public table sequences. No real crew data is copied.

Development inspection uses enforced read-only transactions and full-table
before/after content/schema fingerprints. No main-preview fixture was created or
edited. The 67 unrecognised course identifiers are not touched. There is no
application schema change. Test-only CREATE/INSERT/UPDATE/DELETE/DROP operations
are confined to the independently registered isolated test database.

## Verification

- Focused ownership integration suite: **10 passed, zero failed or skipped**.
- Fresh TypeScript check: **222 diagnostics**, none in the changed files or new
  test.
- All **272** development-table row counts/content fingerprints and the column
  schema fingerprint match the starting snapshot. They also match the preceding
  read-only certificate-linking investigation. This includes the 67 unresolved
  course references.
- No production data was accessed. No development data, grants or schema were
  changed. The requested full suite performs its normal setup/teardown in the
  registered test database only.
- Full-suite and Company Forms results, final HEAD and backend start time are
  provided in the closing report. Local evidence is under
  `generated-artifacts/certificate-ownership/`; test/compiler output is under
  `/tmp/certificate-ownership-*`.
