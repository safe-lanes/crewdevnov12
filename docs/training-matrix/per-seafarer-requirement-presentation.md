# Per-seafarer Training Matrix — requirement levels and vocabulary

## Scope

Presentation only. Calculation remains **1.5.0**. No server, schema, threshold,
permissions, stored matrix or certificate changes. No fixtures created or
modified.

## What changed

- Each displayed cell names its requirement: **Mandatory**, **Recommended** or
  **Not required for this rank**. Mandatory uses the rank matrix's pale green
  `#F0FDF4`; Recommended uses its pale blue `#DBEAFE`. Known not-required cells
  are white. The same key is in the evidence legend.
- If captured rank/revision or requirement information is unavailable, the cell
  instead says **Requirement not determined**, with grey incomplete evidence.
  A display rank name is never used to infer applicability. A certificate-date
  problem in another course does not turn a known blank rank cell into unknown.
- Mandatory and Recommended toggle chips sit above the legend, with Mandatory
  on and Recommended off initially. Both can be selected. Rows stay when a
  selected requirement applies to any crew column; opposite-level evidence is
  hidden, but its requirement label is retained. Unknown cases remain visible.
  With both off, an explanation asks the user to choose a filter.
- The table and sticky headers reuse the existing standard table-header utility
  `bg-[#52baf3]`, as in Vessel Database and other SAIL lists. No new header shade.
  The shared form editor's differently coloured `tableHeader` setting was not
  substituted for this existing data-table convention.
- Visible status wording uses **Valid; Valid, no expiry; Expires during contract;
  Expired at joining; Not held; Expiry not recorded; Incomplete**.
  The frontend maps legacy on-board display labels, including compound hover/tap
  reasons and an immutable copy for shared details. It does not change the
  server's course state, response or cached evidence.
- Dot buttons still contain no status text; visible requirement labels are
  separate. Hover, touch tap, outlines, plain Retry and shared details remain.

## Colour changes

| Meaning | Previous fill | New fill | Reason |
|---|---|---|---|
| Valid | `#059669` | `#16A34A` | Clear medium green |
| Valid, no expiry | `#059669` | `#064E3B` | Much darker forest green, distinct without hovering |
| Expires during contract | `#F59E0B` | `#C2410C` | Dark burnt orange for the contract-validity warning |
| Expires within 2 months | `#F59E0B` | `#FACC15` | Bright yellow/gold, distinct from contract warning |
| Table header | `#0369A1` | existing `#52BAF3` | Match standard SAIL list headers |
| Recommended cell band | `#EFF6FF` | existing `#DBEAFE` | Match rank-based matrix convention and its key |

Valid borders are `#15803D`; no-expiry borders `#022C22`; during-contract borders
`#9A3412`; two-month borders `#A16207`. Red/grey states and transparent
red/amber outlines are unchanged. No-expiry remains a filled green, not an
outline. The main browser check verifies computed RGB values, not just class
names.

## “Expires within 2 months” — retained for the user's decision

This is an existing **on-board display warning**, not an eighth shared
calculation state and not a new training enforcement rule.

- It comes from `onboardDot` in
  `server/v2/shared/training-compliance/onboard.ts`, added for the approved
  slice 7 Vessel Training Matrix requirements.
- `calculateOnboardCompliance` delegates validity/certificate selection to the
  existing shared calculator. The display adapter then obtains its window from
  `contractEndDate(today, 2)` in
  `server/v2/shared/training-compliance/dates.ts`: two calendar months, clamped to
  month end, inclusive of today and the boundary day.
- It is shown for an eligible selected finite-expiry certificate within that
  window when relief is unknown. If the certificate already expires during the
  known contract, the adapter also lists the two-month reason when applicable.
  A certificate covering known relief is not made amber solely by that fallback.
- The read-only on-board controller returns it in `dots` and `displayStatus`.
  The frontend preserves it in the legend, hover/tap and details, and uses it
  only to choose the distinct warning colour.
- Shared calculator states, checklist enforcement, overrides and Training Needs
  suggestions do **not** depend on this label. They use canonical calculation
  states/results. No calculation, date window, condition or stored snapshot has
  changed here. Existing server regression tests still assert the original
  adapter labels, demonstrating that the change is frontend vocabulary only.

## Development-data console verification

Read-only snapshot, **21-Oct-2026 UTC**, development database identity
`heliumdb`/OID `16384`, distinct from the registered test database identity.
Counts below are actual matrix cells **before UI filters**, across **26 on-board
assignments / 25 seafarers**; no deduplication across assignments. These measure
requirement separation, not whether course expiry classifications are correct.

| Matrix state | Mandatory | Recommended |
|---|---:|---:|
| Valid | 78 | 4 |
| Valid, no expiry | 0 | 0 |
| Expires during contract | 0 | 0 |
| Expired at joining | 1 | 1 |
| Not held | 218 | 20 |
| Expiry not recorded | 1 | 0 |
| Incomplete | 0 | 0 |
| **Total known-level evidence cells** | **298** | **25** |

**Recommended is not zero: 25 cells.**

Separately: **2 requirement-undetermined cells**, **1 unallocatable incomplete
check** without a matrix, and **1,332 known not-required cells**. Unknown levels
are never invented as Mandatory or Recommended, so their grey cells are not
included in either column above. This explains why the preceding impact report
had two allocated Incomplete results but this level split has zero known-level
Incomplete results. The calculation did not change.

The retained two-month overlay is zero for both levels in this snapshot.

## Verification evidence

- UI regressions cover default/toggle filtering, same-course different
  obligations, recommended-only rows, per-cell labels/key, not-required cells,
  unknown retained with filters off, canonical vocabulary, distinct legend
  colours, existing header colour, and unchanged state payloads.
- Main preview uses the previously approved development office persona
  24/Admin with existing grants. This is not normal parent sign-in evidence.
  It reuses the registered fixture vessel and reads existing vessel 04 data.
  Real seafarer names are masked in the latter screenshots.
- Browser checks count all 25 Recommended cells with Mandatory off, verify no
  Mandatory evidence is displayed, tap **Expired at joining**, and check
  computed header/status colours.
- No mutation endpoint is permitted by the browser harness. The existing
  Company Forms batch-count POST is allowed only after verifying its route,
  service and repository perform scoped SELECT/GROUP BY reads; it is not a
  submission write.
- Read-only evidence captures a digest of all tracked server/shared/migration
  sources plus content fingerprints for training masters, company trainings,
  rank requirements, saved matrices, drafts and equivalents. Closing verifies
  these remain identical.
- Console output, raw gate results, fingerprints, browser captures and final
  HEAD/commit/backend chronology are outside git under
  `generated-artifacts/training-matrix-labels/`.

## Standing gates

- Full suite: **1,645 passed / 162 failed / 67 pending**, no new failures.
  The full suite is not green; the existing failure baseline is unchanged.
- Company Forms: **661 passed in 97 suites**, zero skipped, pending or failed.
- TypeScript: **222 diagnostics**, within the standing limit.
- All 13 per-seafarer matrix UI tests passed, alongside unchanged shared-engine
  tests. The final browser replay must use a backend started after the final
  commit and preserve HEAD/PID throughout.
