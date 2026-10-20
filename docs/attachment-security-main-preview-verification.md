# Attachment security: main-preview UI verification

20-Oct-2026. **All requested Office attachment families are now verified;
the vessel screen check remains blocked by Crew Pool navigation permission.**
Slice 2 has not been started.

## Authorised follow-up: missing examples prepared and checked

All 27 new fixture records and the authorised role grant are registered at
the top of `docs/company-form-regression-fixtures.md`. Preparation reuses
stable UUIDs, only fixture subjects, the existing fixture-only vessel and one
additional explicitly fixture-only vessel. Original Standard Forms are unchanged.

As the same limited **Crewing Manager** persona, actual screen clicks now pass:

| Previously missing family | Screen action and evidence |
| --- | --- |
| Crew document | Registered own-vessel profile → C → attachment → Preview; `slice1-office-document.json`, raw 200 image/png and visible image popup |
| Licence | Same profile → D → licence attachment → Preview; `slice1-office-license.json`, raw 200 and visible image popup |
| Medical | Same profile → F → medical attachment → Preview; `slice1-office-medical.json`, raw 200 and visible image popup |
| Interview signature | Fixture candidate → Screening → B6 Yes (local display choice) → saved Interview → Interview part; `slice1-office-interview-signature.json`, saved officer image loaded at natural width 850, raw 200 |
| Promotion | Fixture review → Checklist progress → B1.1 attachment → Preview; `slice1-office-promotion-file.json`, raw 200 and visible image popup |
| Drug & Alcohol | Fixture periodic test → Attachment(s) → Preview; `slice1-office-da-file.json`, raw 200 and visible image popup |
| Recruitment document | Fixture candidate → A2 → document attachment → Preview; `slice1-office-recruit-document.json`, raw 200 and visible image popup |
| Recruitment screening | Same candidate → Screening → B1 Attachment(s) → Preview; `slice1-office-screening-file.json`, raw 200 and visible image popup |

No display regression was found; no application code was changed. The previous
Briefing, Debriefing, D3, Planning and Company Form passes remain applicable.
These are UI evidence, not direct API checks.

The fixture vessel role is exclusively used by registered user 412002.
Crew Database View was enabled through the audited Access Control API, with
Create/Edit/Delete false; event 21 records the server-derived actor and change.
The browser was then checked again (`slice1-vessel-own.json`): **Crew Pool
View is separately required by navigation**, and that screen still gives a
plain Access Restricted message. No extra grant was silently added. Own-vessel
opening and ownership-specific other-vessel refusal are therefore still pending
approval of that additional navigation grant.

The sections below retain the original pre-follow-up inventory and results.

## Authentication boundary

The user approved development personas for UI-only evidence. Office and vessel
requests use the application's normal `devPersona` / `getDevPersonaToken` path.
The verifier does not intercept API requests, inject Authorization headers,
call file APIs directly, replace responses, or substitute an app server.

In `server/middleware/authMiddleware.ts`, the development branch constructs
the actor and calls `withVesselScope`; it does not bypass the attachment
routers. The attachment guards still resolve persisted active roles, check
View grants, load the attachment's parent, reject deleted/orphaned records and
check trusted vessel membership. Company Forms still resolve their principal
and authorize `read_asset`. No new attachment guard has an AUTH_BYPASS branch.

Thus these journeys exercise the same new grant/ownership/vessel checks in
this development tenant. They do **not** establish normal JWT authentication,
parent handoff or production tenant binding. Normal parent Office and vessel
sign-in is explicitly required in `docs/production-checklist.md`, item 4,
committed separately as `3476c1b43ecab99cc3c03ddf2812ade80dcc4d34`.

## Personas and unchanged grants

- **Office:** existing user 3, **Crewing Manager**, parent role UUID
  `408d9fe9-1d0f-11f1-925d-5419ffd80f01`. Of 81 menu grants, 65 enable View
  and 16 do not: this is not an all-grants or administrator persona.
  Crew Pool, Crew Database, Recruitment, Vessel, Planning, Handover,
  Promotions, Drugs Alcohol and Forms all allow View/Create/Edit/Delete.
  Company Forms View, Fill in, Witness, Sign representative and Void are
  allowed; Void completed is false and Override checklist is not granted.
- **Vessel:** existing registered user 412002, **PDF Layout Review Vessel**,
  parent role UUID `a4120000-0000-4000-8000-000000000052`. Persisted membership
  points to fixture-only vessel UUID
  `a4120000-0000-4000-8000-000000000001`. Company Forms View, Fill in and
  Witness are allowed; Sign representative, Void, Void completed and
  Override checklist are false. **There are no menu grants**, including
  Crew Pool, Crew Database and Vessel.

No grants, role assignments or vessel memberships were changed. The built-in
Vessel User persona was not substituted: it also lacks Crew Pool/Crew Database
View and has no persisted vessel membership.

## Through-screen results

All successful file requests below originated from clicks in the screen.
Network records are observations of those browser actions, not API probes.
Evidence is under ignored `generated-artifacts/attachment-display/`.

| Screen / requested file | Result |
| --- | --- |
| Crew profile, D3 certificate | **Pass.** Uploaded the one authorised synthetic certificate to the already registered joining fixture, saved the profile, reopened it, opened D3's attachment window and clicked Preview. Thumbnail loaded at natural width 850; authenticated raw image returned 200 and Preview opened a popup. |
| Briefing, completed form | **Pass.** Crew profile → G1 → existing completed Briefing → Briefing Points. Saved officer signature images loaded; all three signature byte requests returned 200 image/png. |
| Debriefing, completed form | **Pass.** Crew profile → G2 → existing completed Debriefing → Debriefing Points. Both officer images and the witnessed seafarer image loaded; all three raw image requests returned 200. |
| Planning attachment | **Pass.** Vessel 04 → Crew List → Show Archived → archived Master row → Handover View → Preview. Existing attachment `5f5ceee0-8c2b-44ec-ad8a-2860b81ee3ee` opened a popup with a UI-triggered 200 application/pdf. Its archived parent is `081543ec-40d9-4bc2-8fe6-0fcf270ba23b`; neither was changed. |
| Company Form signature images | **Pass.** Registered joining fixture → G3 → retained completed sample `d5d3bc08-e5ab-4890-a83e-685f22604580`. Both saved images loaded through authenticated raw requests. |
| Company Form PDF copy | **Pass.** The same completed form shows `CF-2026-000003`; clicking Print copy opened its stored PDF, 200 application/pdf. |
| Crew profile document | **Not verified:** zero non-deleted `crew_documents_attachments` rows. |
| Crew profile licence | **Not verified:** zero non-deleted `crew_licenses_attachments` rows. |
| Crew profile medical | **Not verified:** zero non-deleted `crew_medical_attachments` rows. |
| Interview signatures | **Not verified:** no attachment-backed saved signatures linked to a non-deleted Interview submission. |
| Promotion attachment | **Not verified:** zero non-deleted `promo_checklist_attachments_v2` rows. No inline data URLs/fileData keys in active review records. |
| Drug & Alcohol attachment | **Not verified:** zero non-deleted `da_attachments_v2` rows. No inline data URLs/fileData keys in active test records. |
| Recruitment document and screening attachment | **Not verified:** all 14 candidate/screening attachment tables are empty. Candidate-level legacy data URLs exist only in `uploaded_photo`; portraits are not substitutes for either requested file. |
| Vessel persona, own fixture crew document | **Blocked by grants, not a display regression.** Crew Pool shows a plain Access Restricted page requesting administrator access. No file check can be certified. |
| Vessel persona, another crew record | The same plain module refusal appears, with no broken screen. **This is not evidence of an ownership-specific refusal:** both requests are denied before document access because Crew Pool View is absent. |

No attachment display regression was reproduced in the successful journeys.
The unavailable cases are explicitly unverified, not inferred passes.
No application display code was changed.

The retained legacy Planning attachment lacks filename/date metadata; its
list displays an epoch date. The PDF itself opens. This metadata issue was
not changed or represented as an attachment authorization regression.

## Fixture changes

Only the authorised D3 example was added. Exact course and attachment UUIDs
and the required fixture-only Date of Recruitment prerequisite are registered
at the top of `docs/company-form-regression-fixtures.md`. No real seafarer's
profile was saved. No new crew, assignment, vessel, form or released rule was
created. Subsequent checks reuse the registered certificate.

## Grant inventory: absence is not permission to change it

Crew files and Briefing/Debriefing signatures require Crew Database View.
Interview and Recruitment files require Recruitment View; Promotion requires
Promotions View; D&A requires Drugs Alcohol View; Planning bytes require
Planning View. Navigation can additionally require Crew Pool, Vessel or
Handover View. Company Form assets require Company Forms View plus normal
subject/vessel scope.

The following read-only inventory covers active, non-deleted parent roles.
It reports absence, **not** a recommendation to broaden a role.
“All eight” means Crew Pool, Crew Database, Recruitment, Promotions, Vessel,
Planning, Handover and Drugs Alcohol View.

| Roles | Missing View grants among those eight |
| --- | --- |
| Admin; Crewing Executive; Crewing Manager; DPA; Marine Superintendent; Sail Admin; Super Admin; Technical Superintendent | None |
| Auditors; Crew OB; Crew OL; Crewing Support2; External 1–5; PDF Layout Review Vessel; Top Management; User; Vessel User 2–10 | All eight |
| Crewing Support; Marine Support Technical Suppport Crewing Support; Top Management - View | Promotions, Handover, Drugs Alcohol |
| Marine Dept - View | Recruitment, Promotions, Planning, Handover, Drugs Alcohol |
| Marine Support Technical Suppport | Recruitment, Promotions, Vessel, Planning, Handover, Drugs Alcohol |
| Master | Crew Pool, Recruitment, Promotions, Planning, Handover, Drugs Alcohol |
| Technical Dept - View | Recruitment, Planning, Handover, Drugs Alcohol |
| Vessel Admin; Vessel User | Crew Pool, Crew Database, Recruitment |

Company Forms View is absent for Auditors, Crewing Support2, External 1–5,
Top Management and User. It is present for the other active roles in this
inventory, but does not itself grant Crew Pool navigation or vessel membership.

## Evidence tooling and gates

`scripts/verify-attachment-display.mjs` uses installed Chromium and the main
preview origin. It records screenshots, image load state, browser failures,
UI-originated raw/PDF responses and preview popups. A step/popup failure exits
nonzero. Browser profiles and all outputs remain outside Git.

Cold contexts intermittently failed to fetch real Vite dependency modules
before React mounted. These transport failures were recorded separately;
the verifier retries the real page once and uses a persistent profile per
persona. It does not replace modules or suppress permission failures.

Application/test source is unchanged from the last gated source at
`8da3d77d770f3ba17cf1a265c0706f886cba010e`. Its gate results remain:
full suite 1,382 passed / 162 failed / 67 pending; Company Forms 648 passed,
zero skipped across 96 files; attachment security 101 passed; TypeScript 222
diagnostics. These gates were **not rerun** for documentation, UI-only tooling
and an isolated main-preview fixture upload. The new verifier passes
`node --check`. Closing commit/process chronology and fresh read-only journeys
are recorded in `generated-artifacts/attachment-display/closing-evidence.json`.

Acceptance remains incomplete until the missing attachment examples and a
properly granted fixture-vessel account are available. No grants are changed
to obtain that evidence. Parent-authenticated verification remains a production
checklist item. Slice 2 is not built.
