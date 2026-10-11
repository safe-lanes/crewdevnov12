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

Imports enforce create/view access for In Progress, unlike the older endpoints that only enforce module authentication. **Production imports require the authenticated parent JWT to include `userUuid` matching the synced user master UUID.** Its existing numeric `id` is not usable: master sync rebuilds local serial IDs and does not preserve parent numeric IDs. Never map the numeric JWT ID to that local serial or use an editable browser profile to authorize access.

Manning Agent accounts additionally require a signed `manningAgent` claim containing the active agent ID or exact unique name. Only that agency appears in template dropdowns; workbook edits cannot select another agency. A blank agency is assigned from this authenticated scope on creation.

Missing verified identity, role permission or agency scope returns a clear 403 and saves nothing. The parent application's current minimal token (`id`, `domain`, `userType`) needs these additional identity/scope claims before this feature can be used with that login. Existing development-only bypass remains unchanged; it is not a production workaround.

## Verification

- Unit/regression: `npx vitest run tests/unit/recruitment-candidate-import.test.ts tests/unit/recruitment-import-request.test.ts tests/unit/recruitment-import-auth-transport.test.ts`
- Browser smoke (running development workflow): `node tests/e2e/recruitment-import-smoke.cjs`
- Cleanup its exact synthetic record: `NODE_ENV=development npx tsx tests/e2e/recruitment-import-cleanup.ts`

Cleanup refuses records without the smoke-test name prefix and only removes the recorded UUID and its related import records. Never run against production.
