# Recruitment Excel import

In Recruitment → In Progress, **Import Candidate** downloads the current single-candidate `.xlsx` form. It contains exactly one **APPLICATION FORM** worksheet, styled like the supplied Crew Bio Data Form with grey section headings, bordered white input boxes and side-by-side details. Fill white boxes, upload, validate, then confirm.

All A1–A5 sections, instructions and dropdown lookup values are on this worksheet. Lookup columns are hidden outside the A:AF print area; there are no extra or hidden sheets. Sea-service entries use paired rows (From above To), as in the reference. Photos are explicitly marked for separate upload; unsupported bank, clothing-size and reference-only fields are not collected.

The previous multi-sheet format is no longer accepted. Download a fresh template and transfer values; an older workbook gives an explicit version/redownload error, never guesses the mapping. Do not insert rows, move fields or alter merged boxes.

- A1: personal, contact, family, children, next of kin and applied vessel types.
- A2: travel documents and visas.
- A3: education, licenses/DCE and training.
- A4: sea service. Period is derived from dates.
- A5: additional information/response.

Only populated fields and rows are saved. Empty optional sections do not create records. Zero/false values are preserved. Unknown or ambiguous masters, invalid dates and partial rows with missing required values prevent the entire import.

Successful imports create **Applied** candidates. Preview does not write. Confirmation revalidates and writes everything in one tenant database transaction. No screening dates/file numbers, screening jobs, compliance processing, approvals, crew transfers or mobile provisioning are triggered. Reimporting the same populated data is rejected; suspected matches on name/birth date, email or passport number require review rather than overwriting.

Photos and attachments are uploaded separately. The reference `.xls` is not accepted as an application import. Do not rename sheets/headings or add records outside designated rows. Files are limited to 5 MB compressed / 25 MB expanded and may not contain formulas, macros, external workbook links or embedded objects.

## Parent login integration dependency

Imports enforce create/view access for In Progress, unlike the older endpoints that only enforce module authentication. **The existing signed parent JWT (`id`, `domain`, `userType`) is sufficient for Office accounts with the required permissions.** User synchronization preserves the parent's explicit numeric `id`. Imports look up that ID in the authenticated tenant's `master_users`, then derive the audit UUID and role from the matched row. A missing/invalid ID or missing UUID/role mapping is denied. If an optional signed `userUuid` is supplied, it must match that row. Browser-supplied identity, role and audit fields cannot override the authenticated user.

Manning Agent accounts additionally require a signed `manningAgent` claim containing the active agent ID or exact unique name. Only that agency appears in template dropdowns; workbook edits cannot select another agency. A blank agency is assigned from this authenticated scope on creation.

Missing verified identity, role permission or agency scope returns a clear 403 and saves nothing. Manning Agents still need the separate signed agency claim; numeric user resolution does not grant unrestricted agency access. Existing development-only bypass remains unchanged; it is not a production workaround.

### UAT rollout and checks

Deploy the updated backend through the existing UAT deployment process and restart that backend. No parent JWT change, database migration, user synchronization run or candidate backfill is required for this fix. Keep the existing shared-signature verification and tenant configuration; do not enable an authentication bypass.

With an existing Office login whose master-user row has the same numeric ID and an assigned role permitting In Progress view/create, download the template, fill a synthetic candidate, and validate it. Confirm an import only when an authorized UAT test record may be created; verify Applied status, File No, submitted date and the matched user's audit UUID. Verify that a view-only user and a vessel user remain denied, and that cross-tenant requests cannot select another tenant's user with the same ID.

Local automated tests use synthetic signed JWTs, isolated tenant database doubles and simulated persistence. They do not prove the external UAT deployment has been updated; the signed-in UAT checks above must follow its rollout.

## Verification

- Unit/regression: `npx vitest run tests/unit/recruitment-candidate-import.test.ts tests/unit/recruitment-import-request.test.ts tests/unit/recruitment-import-auth-transport.test.ts`
- Browser smoke (running development workflow): `node tests/e2e/recruitment-import-smoke.cjs`
- Cleanup its exact synthetic record: `NODE_ENV=development npx tsx tests/e2e/recruitment-import-cleanup.ts`

Cleanup refuses records without the smoke-test name prefix and only removes the recorded UUID and its related import records. Never run against production.
