# Stage-specific operational Company Form popups

The revised On Board Status entry uses a top **Sign-off forms** button and a
separate dialog matching the reliever's **Joining forms** flow. Opening/closing
the forms dialog does not submit personnel changes. The nested dialog resets
on parent closure or assignment change. Missing links and API refusals remain
visible in the forms dialog rather than hiding the entry.

Operational declaration lists and reciprocal navigation are stage-scoped:

| Entry | Stage |
| --- | --- |
| Reliever / Joining forms | Before joining |
| Crew List / Forms | On board |
| On Board Status / Sign-off forms | At sign-off |
| Crew profile G3 | Full history across stages and assignments |

Assignment UUIDs remain request identities, not headings or introductory
labels. Server permissions, assignment locking, signatures, freezes, normal
sign-off behavior and Crew List count semantics are unchanged.

## Tests, 2026-10-05

- `node scripts/verify-company-forms-tests.mjs`: 51 inventoried files,
  **361 passed tests, zero skipped/pending, no missing or empty suites**.
- `node scripts/verify-repository-suite-baseline.mjs`: 116 configured files,
  1,259 tests; **1,030 passed, 162 failed, 67 pending**. Exit 1 from Vitest is
  retained, not described as a green suite. No new failing test identities
  compared with the recorded baseline. Baseline ceilings are in
  [the task ledger](../task-ledger.md).
- `node scripts/compare-signoff-typescript.mjs 37967ecd1aa30f1e3000ccd4d3a951fcf5079130`:
  226 baseline diagnostics, 226 current, zero introduced diagnostics.

Raw test logs/results are retained under `.local/verification/`; the full
suite gate saves its exact command, times and counts in
`stage-popups-repository-suite.json`.
The test commands ran against the implementation working tree before its
source commit; their reports therefore record the starting HEAD. Application
and test contents have not changed since the implementation commit.

## Main-preview closing

`node scripts/verify-stage-company-form-popups.mjs` must run only after the
final commit and a strictly later managed main-backend start. It records
HEAD, commit time, backend PID/start, browser start/end, actor-scoped requests,
saved responses and real screenshots. It fails on source/PID drift, unexpected
form writes, Admin authoring reads during form rendering, or protected-record
changes.

The browser uses retained synthetic operational personas and test-owned
records. It does not certify production authentication or the creator's own
account. Its journeys are read-only: top button, separate dialog and return,
stage-only lists and pinned sign-off rendering, plus full G3 history. No roles,
fixtures, signatures or operational assignments are modified.

The previous sign-off closing intentionally cancelled its reliever. Rather
than resetting it, the driver verifies the exact still-Planned link of the
retained **TEST ONLY READABLE DECLARATION REGRESSION** fixture on the same
vessel. Cancelled history is left intact in G3.

Each run, including failed attempts, is retained in
`.local/verification/stage-popups-browser-<UTC timestamp>/`.

The tested application implementation is
`5817fd94fad9938bc0586502990e76c4a3e2db4f`. The first two browser attempts
found driver defects (a temporal-dead-zone reference and an assumed Crew List
accessible label); both failures, screenshots and requests remain retained.
Corrections were committed before fresh main-backend starts:
`ce8fd2304ae1a420b6e543e37a762c1082731954` and
`d461e2f7fb41b6497956b8aef14e83ca1f1d5a44`.

Closing passed on `d461e2f7fb41b6497956b8aef14e83ca1f1d5a44` with backend PID
3752 started at `2026-10-05T04:35:44Z`; browser `04:35:59Z`–`04:36:16Z`.
The top Sign-off forms button, separate dialog, pinned sign-off rendering,
return action, keyboard-operated unchanged Forms count, all three stage-only
lists and full G3 history were verified; protected comparisons were unchanged.
That first successful evidence and both failed attempts are copied to
`docs/verification/stage-popups/`. The final evidence/driver commit must be
followed by another newer main-backend start and fresh unchanged-HEAD closing.
The final driver's G3 screenshot scrolls the real profile panel to its retained
declaration rows, and its report includes decoded request actor IDs plus hashes
for all protected tables without storing credentials.