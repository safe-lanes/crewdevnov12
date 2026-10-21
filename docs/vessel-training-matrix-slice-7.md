# Vessel Training Matrix — slice 7

## Build steps

1. Shared server calculation: add an explicit planned-relief end date to the
   existing kernel (version 1.5.0), exact captured-rank/on-board-assignment
   readers, a read-only scoped batch endpoint and shared details decoration.
   Test inclusive boundaries, month-end fallback, equivalents, longest valid
   certificate, incomplete data and parity.
2. Replace the old client dot/rank-name calculation with server results.
   Assignment-specific columns, dot-only cells, hover/tap meanings, eight-state
   legend, and the existing See Details window with today/planned-relief dates.
   No enforcement or training-suggestion writes from the on-board view.
3. Signed-JWT scope tests, UI regression tests, registered-fixture main-preview
   evidence and standing gates. Commit tooling/evidence, restart the main backend
   after the final commit, then take the closing evidence.

## Interpretation

- Today is the server's UTC civil date; date validity includes expiry day.
- Planned relief is `vessel_planning_v2.sign_off_date`, only on an active,
  non-archived row whose `crew_assign_uuid`, crew and vessel exactly match the
  on-board assignment. Never Relief Due, reliever dates or another assignment.
- Several matching active planning rows are incomplete, not a guessed date.
- Without planned relief, a known expiry through today plus two calendar months
  (inclusive, clamped to month-end) warns. A before-relief expiry also reports
  that two-month reason when applicable, as requested. An expiry on/after a known
  relief date stays Valid, even if it is within two months.
- No captured contract rank means Incomplete, never current-rank/name matching.
  Same-rank crew members have separate assignment columns and results.
- Historic check snapshots retain their recorded calculation versions.

## Verification

- Focused shared-engine/reader tests passed, including exact assignment-linked
  planning, no present-rank/other-contract fallback, same-input parity, expiry-day
  boundaries, longest accepted equivalent, missing expiry and month-end clamping.
- Signed-JWT tests use authentication enabled, isolated tenant schemas and real
  permission/scope guards. They cover own-vessel access and refusal for another
  vessel, another tenant, unauthenticated requests and browser date overrides.
- UI tests cover text-free dot cells and outlines, all-reason tap content,
  separate same-rank crew columns, grey incomplete, shared details/date captions,
  plain Retry errors, and no reliever reads/suggestion writes from embedded mode.
- Full isolated suite: **1,638 passed / 162 failed / 67 pending**, no new
  failures compared with slice 6. The suite is not green.
- Company Forms: **661 passed in 97 suites**, zero skipped or pending.
- TypeScript: **222 diagnostics**.

## Main-preview evidence

Fixture registration and the explicit synthetic rank-context preparation are in
`docs/company-form-regression-fixtures.md`. The existing registered seafarer has
separate on-board and reliever assignments. No new root fixtures or grants.
Preparation is UUID-scoped SQL on registered fixtures, not a Deploy/sign-on UI
journey and not a production rank backfill.

```
node scripts/verify-vessel-training-matrix.mjs             # preflight
# commit final code/tooling, restart Start application
node scripts/verify-vessel-training-matrix.mjs --closing
node scripts/report-vessel-training-matrix.mjs
```

The replay clicks the real matrix, hovers a dot, uses a touchscreen-enabled
browser's actual tap, opens the shared details from a crew name, and opens the
reliever screen too. Server results are compared for equal rank UUID, reference
date, contract end, matrix revision, certificate choices, equivalent flags,
validity booleans, states and calculation version. On-board “Expires before
planned relief” is the display name for the engine's “Expires during contract”.

Captures include red-outline Not held, amber before-relief with both reasons,
the no-relief two-month fallback, amber-outline Expiry not recorded, and both
details screens. An existing no-rank fixture also shows grey incomplete dots.
Temporary certificate dates/planning links are restored in `finally`; no fixture
is deleted. The matrix is read-only; the reliever screen's normal suggestion
reconciliation runs and is reconciled after restoration.

Evidence goes outside git in `generated-artifacts/training-slice7`. The final
report records full HEAD/time and backend PID/start, and refuses a backend
started before the final commit. Its HTML embeds all six screenshots.
