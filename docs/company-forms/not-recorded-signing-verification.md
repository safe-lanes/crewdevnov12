# Missing contract rank — signing verification

## Delivered behavior

- Missing Deploy capture, including no capture row: seafarer signing records
  **Not recorded**, without reading the mutable profile rank or matching names.
- Company Representative first, witnessed seafarer second, then Submit works
  for a required form and completes its requirement.
- Later rank capture does not replace the signature or the form's displayed rank.
- A capture arriving between those signatures still leaves the rank aligned with
  the first-signature snapshot.
- Older profile-derived rank snapshots are preserved, not rewritten. When the
  actual seafarer signing rank is **Not recorded**, the rendered rank field uses
  that frozen signature fact with explicit `frozen_signature` provenance.
- Captured, eligible identifiers continue to resolve by UUID. Invalid captured
  identifiers remain refused; they are not treated as missing captures.

## Evidence

Retained synthetic crew, assignments, released definitions, requirements and
their signature/snapshot children are registered in
`docs/company-form-regression-fixtures.md`. No fixture cleanup deletes crew or
assignments. Both browser forms use private test-vessel conditions.

`scripts/verify-company-form-not-recorded-rank.mjs` clicks Start required form,
draws and saves both signatures, confirms Submit, checks the Completed
requirement through the screen, and reopens the completed form. Both its
signature and rank field show **Not recorded**, or **Fourth Engineer** for the
captured-rank example. Raw SQL confirms the same frozen values and completion.

The coherent click-through action log, images and SQL evidence are in
`.local/verification/not-recorded-rank/initial-browser-evidence.json`.
The `--closing` mode is read-only and writes
`.local/verification/not-recorded-rank/closing-browser-evidence.json`, including
the final HEAD, commit timestamp and backend start. It refuses a backend started
before or at the final commit.

Regression coverage includes required-form completion, changed mutable profile
rank, later capture, capture between signatures, legacy snapshot preservation,
no context row, missing UUID and invalid or ambiguous captured references.

## Standing gates

- Company Forms: **81 suites, 497 passed, zero failed, zero skipped**.
- Full suite: **1,220 passed, 161 failed, 67 pending**.
- TypeScript: **222 existing diagnostics**, within the agreed limit.
- Production build: passed.
- One intermediate suite run was invalidated by a development-server reload
  (`ECONNREFUSED`). Its result is not used. The stable, completed gate report is
  `.local/verification/not-recorded-rank/steady-full-suite.json`.
