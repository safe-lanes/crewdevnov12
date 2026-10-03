# On-board Company Form acceptance and retained fixtures

## Run evidence

The final browser run is deliberately **after** the final implementation commit
and managed-backend restart. Its result is not inferred from this document:

- `.local/verification/onboard-closing-browser.json`: pass/fail, HEAD, commit
  time, actual main PID/start, browser start/end, requests, authenticated actor
  IDs, screenshots and assertions.
- `.local/verification/onboard-first-event-freeze.json`: all System points
  captured at the first witnessed signature.
- `.local/verification/onboard-two-master-handover.json`: two distinct actual
  actors and unchanged saved signature rows after the second actor's later
  identity/designation/role changes.
- `.local/verification/onboard-configuration-api.json`: normal version creation
  copied both pinned role identifiers and the third signature; before-joining
  release rejected Vessel Management.
- `.local/verification/onboard-cancelled-history-api.json`: normal assignment
  cancellation retained readable, non-editable history and refused restart.
- `.local/verification/onboard-protected-comparison.json`: projection against
  the original protected keys; additive nullable columns are not backfilled.
- `screenshots/onboard/`: real browser captures, including the other-vessel
  server refusal. A failure also saves the actual DOM and screenshot.

The executable driver is `scripts/verify-onboard-company-forms.mjs`.
`closing` requires a fresh normal sign-on fixture; it is not an idempotent
read-only replay. Never clear an occupied slot or reset an on-board status
merely to run it again.

## Verified before the final browser

- Five focused regression suites: **73 tests passed**.
- Full TypeScript check: **226 existing diagnostics**, none in the changed
  TypeScript files; the previous implementation baseline was also 226.
- Normal API version-copy and stage-release rejection passed.
- Normal cancellation and read-only history checks passed.
- Original protected rows unchanged: 3 submissions, 9 System snapshots,
  31 signatures, 45 released versions, 22 parts, 22 sections and 57 questions.
- Master permission provisioning and reachability of the normal sign-on
  dialog were checked before signing on. No on-board assignment status was
  written directly.

## Retention inventory

Keep all test-owned rows and evidence. The complete generated identifiers and
subsequent submission IDs are recorded in
`.local/verification/onboard-retained-fixtures.json` and the preparation
journal `.local/verification/onboard-setup-journal.json`.

| Fixture | Purpose |
| --- | --- |
| Master user 100 | Closing Ship browser, vessel 02 throughout |
| Master user 101 | Separate same-vessel handover record; later synthetic identity/role change |
| Master user 102 | Master scoped only to vessel 03; read/sign/asset refusals |
| Vessel User 103 | Same vessel, nonpermitted role refusal |
| Master user 104 | Empty trusted provisioning despite asserted development JWT scope |
| Ship role `73fa5c3c-0d65-486d-a493-e82eebaaa11e` | New retained Master role; no existing role converted |
| Existing Vessel Admin role | Second valid pinned Ship-role identifier; not modified |
| New Master role grants | Normal Vessel/Vessel Database/Officer Matrix and Crew Database view/edit; creation/deletion and Forms authoring remain denied |
| New synthetic seafarer | `TEST ONLY ONBOARD SEAFARER`, employee number `TEST-ONBOARD-DECLARATION`; cloned only from a prior explicitly synthetic fixture |
| Normal Rotation draft and entries | New test-owned deployment, assignment and exact planning link; occupied slots untouched |
| Form 801 | `TEST ONLY ONBOARD DECLARATION`, two System points, witnessed Seafarer and distinct Vessel Management signatures |
| Form 802 | `TEST ONLY ONBOARD HANDOVER`, separate second-Master record and archival retention |
| New draft copied from form 801 | API copy and stage-release rejection; original released version unchanged |
| Extra Chief Officer planned assignment | Retained preparation attempt; normal cancellation and before-joining read-only-history verification |
| Closing declarations | New original, explicit void/replacement and separate handover; never re-sign or void an original protected declaration |

The first Chief Officer deployment succeeded through Rotation, but that
position is absent from vessel 02's actual UI profile. It was retained, not
deleted or used to force sign-on. A second normal deployment used the genuinely
vacant **configured Master** slot. This separate Rotation validation issue was
suggested as a follow-up, not added to Company Form scope.

## Authentication and permission scope

These are development acceptance checks using the project's existing
`AUTH_BYPASS` development-persona mechanism. Authentication configuration is
unchanged. Role, lifecycle, pinned-policy, actor capture and complete trusted
vessel provisioning checks still run in the real server. This is not a test of
production authentication-provider login.

The closing page is initialized as Master 100 before the application loads.
There is no Office browser substitution. Any explicit Office void/archive API
operation or second-Master operation is recorded separately from the closing
Ship browser's network. Signature/definition/image/list/link operations in
that browser must use submission endpoints, not Admin endpoints.

Historical name/rank gaps are never repaired by looking up the current
occupant. Missing recorded names are explicitly unavailable; missing recorded
declaration dates use an explicitly labelled creation date.