# Recruitment Excel import

In Recruitment → In Progress, **Import Candidate** downloads the current single-candidate `.xlsx` form. It contains exactly one **APPLICATION FORM** worksheet, styled like the supplied Crew Bio Data Form with grey section headings, bordered white input boxes and side-by-side details. Fill white boxes, upload, validate, then confirm.

All A1–A5 sections, instructions and dropdown lookup values are on this worksheet. Lookup columns are hidden outside the A:AF print area; there are no extra or hidden sheets. Revision 6 aligns the editable columns with the Recruitment Application: it removes Issuing Country from A2.1 documents, A3.2 licenses and A3.3 training, removes Source from A2.2 visas, and orders Education as **Qualifications → Subjects/Field → School/College/University → Date of Completion**. Sea-service entries use one row each, with optional **IMO Number** immediately after Vessel Name, followed by Vessel Type, Deadweight, Engine Type/Power, Owner/Operator, Rank, From and To. Periods are calculated on import. Photos are explicitly marked for separate upload; unsupported bank, clothing-size and reference-only fields are not collected.

The current template is **revision 7**. Its labels match the application: **Document**, **Residential Address Line 2 (City, State, PIN)**, **Contact Landline**, and **Vessel Type**. The singular Vessel Type label retains multiple names separated by semicolons. The address label wraps in a wider box; its input is now Y21:AF21.

Single-sheet revisions **2, 3, 4, 5 and 6 remain supported with their original field definitions, headings and cell mappings**, including values in the now-removed inputs. Revisions 2 and 3 retain paired sea-service rows and do not have an IMO input; revision 4 supports IMO but keeps document names as unlinked text; revision 5 adds linked/manual document dropdowns. Previously filled revision 5 workbooks remain valid with or without the Foreign Languages dropdown. Download a fresh revision 7 template for the current labels and required indicators; do not copy encoded database choices into revisions before 5. The old multi-sheet revision 1 is not accepted. Unsupported versions get an explicit redownload error; the importer never guesses the mapping. Do not insert rows, move fields or alter merged boxes.

Validation follows the current application rules for every supported revision: **Spouse First Name and Spouse Family Name are required only when Marital Status is Married**. Spouse middle name and DOB remain optional. Revision 7 uses standard IF/TRIM heading formulas to show spouse-name asterisks only when Married, with red conditional formatting and visible guidance; macros, add-ins and cell comments are not used. Only the two exact server-generated heading formulas are allowed, and their cached text is never trusted for validation. Ordinary input formulas remain forbidden.

**Child First Name and A5.1 Information are optional**, including in populated rows. A child row with another supported value, or an additional-information row with only Response, is retained without inventing missing values. Empty rows are omitted. Older workbooks may still show the previous asterisks or optional-spouse instructions; they are read using their historical headings but validated against the corrected rules.

- A1.1 General Particulars; A1.2 Address & Contact Info; A1.3 Family and NOK (including children).
- A2.1 Travel & Identification Documents; A2.2 Visas.
- A3.1 Education; A3.2 License & DCE; A3.3 Training Course.
- A4.1 Details of Sea Service.
- A5.1 Details on Additional Information required.

### A2.2 Visa country choices

Issuing Country uses the same country-name mapping and predefined additions as the web application's Visa selector, including Schengen and its priority ordering. The live list is built from master data category 001 plus the application's predefined visa countries, rather than only the general country master. Other country dropdowns retain their existing catalog.

Selected names resolve server-side to matching country master UUIDs where available. If a predefined visa choice has no matching country master, the readable name is saved, matching the web form's existing behavior. The importer never saves picker-only `COUNTRY-n` identifiers or invented UUIDs, and it does not trust uploaded hidden lookup cells. Unknown or ambiguous choices require correction. Older revisions retain their original general-country validation and Source input semantics; no existing records or database columns are removed.

### A2.1 database or manual documents

Every Document Type input has a non-blocking dropdown sourced from the current tenant's active, non-deleted Travel Document Types, matching the web “+ Add from database” selector. Options show `Name [DB:DOCxxx]` with the master business code, not an internal row UUID. A selected option saves the canonical name and its `entryId` as `documentId`; custom typed names remain unlinked and never create masters. A unique plain name also resolves like A3.2; ambiguous names require an explicit code-bearing dropdown choice.

The server rechecks choices against the live catalog during both validation and confirmation, never trusting hidden workbook lookup cells. Renamed, inactive, deleted, forged or ambiguous options get an A2.1 cell error requesting a current selection. No document number, dates or issuing details are inferred. The derived association does not change the historical retry fingerprint of otherwise identical plain-name input.

### Foreign Languages

Newly downloaded templates offer a normal single-choice dropdown using the same active, non-deleted language names as the web application's Foreign Languages selector. For multiple languages, manually enter names separated by commas, e.g. `French, Spanish`. The input prompt explains this when the cell is selected. Choosing another dropdown option replaces the whole cell value; it does not append.

Manual comma-separated entries are not blocked by Excel dropdown validation. The existing 100-character import limit applies; blank cells are not saved. Values remain plain language-name text, not UUIDs, and older filled templates retain their existing import behavior. If there are no eligible language choices, manual entry and the input prompt remain available. No macros, add-ins, installations, or checkbox controls are required. Native Language and its existing validation are unchanged.

Only populated fields and rows are saved. Empty optional sections do not create records. Zero/false values are preserved. Unknown or ambiguous masters, invalid dates and partial rows with missing required values prevent the entire import.

Successful imports create **Applied** candidates with the next existing File No and initial submitted date. Preview does not write. Confirmation revalidates and writes everything in one tenant database transaction. No screening jobs, compliance processing, approvals, crew transfers or mobile provisioning are triggered. Reimporting the same populated data is rejected; suspected matches on name/birth date, email or passport number require review rather than overwriting. Moving fields or leaving the new IMO field blank does not change duplicate identity for otherwise identical input.

Photos and attachments are uploaded separately. The reference `.xls` is not accepted as an application import. Do not rename sheets/headings or add records outside designated rows. Files are limited to 5 MB compressed / 25 MB expanded. Only the original license/training autofill formulas (and their verified native-editor equivalent) are allowed; arbitrary formulas, macros, external workbook links and embedded objects are rejected.

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

- Required-field and label regressions: `npx vitest run tests/unit/recruitment-required-label-parity.test.ts`
- Read-only live template/download/validation smoke (never executes imports): `node tests/e2e/recruitment-template-style.cjs`
- Native conditional-heading recalculation: `LIBREOFFICE_BIN=/path/to/soffice npx tsx tests/e2e/recruitment-spouse-headings-native.ts`. This verifies actual LibreOffice recalculation and XLSX save/reopen, not Microsoft Excel desktop or Excel for the web.

- Unit/regression: `npx vitest run tests/unit/recruitment-candidate-import.test.ts tests/unit/recruitment-import-request.test.ts tests/unit/recruitment-import-auth-transport.test.ts`
- Browser smoke (running development workflow): `node tests/e2e/recruitment-import-smoke.cjs`
- Cleanup its exact synthetic record: `NODE_ENV=development npx tsx tests/e2e/recruitment-import-cleanup.ts`

Cleanup refuses records without the smoke-test name prefix and only removes the recorded UUID and its related import records. Never run against production.
