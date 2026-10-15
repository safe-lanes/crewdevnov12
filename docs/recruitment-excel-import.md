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

**Import Candidate requires a valid signed parent JWT and a matching master user only.** User synchronization preserves the parent's explicit numeric `id`. Imports look up that ID in the authenticated tenant's `master_users`; a missing/invalid signed ID or unmatched user is denied. JWT signature/expiry verification and tenant isolation remain enforced by normal authentication middleware.

Import-specific role permissions, view/create checks, vessel-user exclusions and Manning Agent scope restrictions are not applied. Existing matched users can download, validate and import regardless of role, user type, missing role/UUID, or optional signed UUID/agency claims. The Import Candidate button does not depend on permission-loading or create permission; New Crew and other existing action/navigation permissions are unchanged.

Audit attribution comes only from the matched master user's UUID, or null when unavailable. Browser/upload audit values and optional JWT UUID values cannot override that lookup and do not cause an additional denial. Import requests no longer send the browser audit identity. No agency is forced onto blank workbook cells, and all normal agency choices for the tenant remain available, subject to ordinary workbook master-reference validation.

Workbook file safety, required-cell validation, confirmation, master mapping and duplicate protection remain enforced. The existing development-only bypass is not a production workaround and uses null audit attribution rather than browser-supplied values.

### UAT rollout and checks

Deploy the updated frontend and backend through the existing UAT deployment process and restart that backend. The production backend now runs the same JWT authentication middleware as development after tenant resolution, including when the client sends both Authorization and x-tenant-id. No parent JWT change, database migration, user synchronization run or candidate backfill is required. Keep the existing shared-signature verification and tenant configuration; do not enable an authentication bypass.

With an existing login whose master-user row has the same numeric ID, download the template, fill a synthetic candidate, and validate it. Confirm an import only when a UAT test record may be created; verify Applied status, File No, submitted date and the matched user's audit UUID (or null if absent). Verify matched view-only, vessel and Manning Agent users can import without extra claims, while missing users, invalid authentication and cross-tenant requests remain denied. Verify New Crew and other actions still retain their existing permissions.

Local automated tests use synthetic signed JWTs, isolated tenant database doubles and simulated persistence. They do not prove the external UAT deployment has been updated; the signed-in UAT checks above must follow its rollout.

## Verification

- Unit/regression: `npx vitest run tests/unit/recruitment-candidate-import.test.ts tests/unit/recruitment-import-request.test.ts tests/unit/recruitment-import-auth-transport.test.ts`
- Browser smoke (running development workflow): `node tests/e2e/recruitment-import-smoke.cjs`
- Cleanup its exact synthetic record: `NODE_ENV=development npx tsx tests/e2e/recruitment-import-cleanup.ts`

Cleanup refuses records without the smoke-test name prefix and only removes the recorded UUID and its related import records. Never run against production.
