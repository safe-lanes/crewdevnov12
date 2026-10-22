# Training Matrix — compact five-dot presentation

## Scope and measurements

Presentation only, superseding the resting cell labels and eight-outcome legend
in `per-seafarer-requirement-presentation.md`. The shared calculation remains
**1.5.0**. No thresholds, schema, stored matrix data, grants or fixtures changed.
The only backend change is structured diagnostic logging after the existing
read-only snapshot; the response and calculator are unchanged.

Measured on the same vessel 04 matrix, 22 crew columns and 34 filtered course
rows, before and after, using the approved development office persona:

| Viewport | Before row height | After row height | Before crew-column width | After crew-column width |
|---|---:|---:|---:|---:|
| 1700 px | median 93 px (minimum 92.5) | median 37 px (minimum 36.5) | 190 px | 142.5 px |
| 900 px | median 93 px (minimum 92.5) | median 37 px (minimum 36.5) | 190 px | 142.5 px |

Measurements include browser table borders. CSS targets 36 px content rows and
142 px crew columns; before targets were 76 px cell content plus padding and
190 px columns. Existing course names still wrap instead of being discarded.

## Resting cells, headers and interaction

- Cells have no resting text. Required cells have at most one dot on their
  existing pale Mandatory/Recommended background. Other cells are blank/white.
  Filtered-out evidence is also blank, without “Hidden by filter”.
- Hover and touch popovers carry the requirement, all applicable non-retired
  states and specific flags. No colour change updates a stored compliance state.
- Rank is first and larger (12 px); name is second and smaller (10 px), with
  visible sentence casing and ellipsis. Original recorded identity remains in
  the name's desktop hover title and approved popup opened by name tap.
- Mandatory remains selected by default. The filter chips now form the
  requirement portion of the same compact, non-wrapping legend. At narrow
  widths it can scroll horizontally, rather than grow into several lines;
  the grid retains its existing horizontal scrolling.
- The approved `TrainingMatrixCompliance.tsx` and existing embedded-result
  transformation are unchanged. Full popup evidence, dates, attachments and
  current captions remain as approved.

## Exactly five styles, in precedence order

| Priority | Style | Meaning |
|---|---|---|
| 1 | Red filled `#DC2626` | Expired at joining |
| 2 | Red hollow `#DC2626`, transparent fill | Not held |
| 3 | Amber filled `#F59E0B` | Expires during contract |
| 4 | Amber hollow `#F59E0B`, transparent fill | Expiry not recorded; also Incomplete |
| 5 | Green filled `#16A34A` | Valid; Valid, no expiry |

All applicable labels remain in hover/tap, not just the winning one. Incomplete
never produces green; its specific reason is retained. Missing applicability is
the separately requested blank/not-required presentation, not an incomplete dot.

The evidence legend has only these five captions, in the requested order:
Valid; Expires during contract; Expired at joining; Not held; Expiry not recorded.
There are no extra no-expiry, two-month, grey, undetermined or not-required keys.

## Retired display outcomes and diagnostics

“Expires within 2 months” is suppressed **only in the matrix display**. The
underlying branch in `server/v2/shared/training-compliance/onboard.ts` and its
date helpers are unchanged for the user's planned reuse. A two-month-only amber
adapter result uses its canonical Valid course state and therefore displays
green. A real contract-expiry result remains amber filled. Mixed descriptions
lose only the retired phrase, not the remaining states or correction flags.
The approved popup is not changed to use this matrix-specific normalizer.

Former “Requirement not determined” cells are blank/not-required as requested.
`logUndeterminedTrainingMatrixCells` is invoked after the scoped read-only
controller transaction and logs **every occurrence on every request**. It never
uses current profile rank, changes a requirement, writes a database row, or
silently deduplicates repeated requests. Each JSON warning records:

- event `training_matrix_requirement_undetermined`, server time;
- master course UUID, company-training ID and course code;
- captured rank UUID (null when absent), its existing captured display label;
- vessel UUID, exact assignment UUID and reason codes.

### Current development inventory — 22-Oct-2026

Read-only requests scanned all **11 vessel snapshots**. There were **2 unique
formerly-undetermined cells**, both for the existing registered fixture
assignment `a4120000-0000-4000-8000-000000000002` on fixture vessel
`a4120000-0000-4000-8000-000000000001`, with captured rank absent (“Not recorded”):

| Course | Company-training ID | Master course UUID |
|---|---:|---|
| SA006 | 18 | `1fbde38c-a34f-4b87-beae-f05d362decba` |
| SC004 | 22 | `0d4ed165-03b7-4db8-a339-fa02df0bb561` |

Both had `CAPTURED_RANK_MISSING` and `MISSING_RANK`. The main backend application
log contains the server-emitted records. Reopening that fixture matrix produces
two further log entries: **two unique cells is not a lifetime log-entry count**.
Checks without any matrix rows are not invented as course-cell occurrences.

## Verification

- 99 focused tests passed: compact UI, diagnostics, unchanged on-board
  calculation and API reader/security regressions. UI tests include precedence,
  canonical Valid under the retired warning, merged valid greens, incomplete
  hollow amber, blank unknown cells, exact legend, case/identity and popup reads.
- Main-preview browser checks exercise 1700 px and 900 px widths, computed dot
  colours/outlines and same-row legend alignment, empty cell text, one-dot
  maximum, default filters, hover and actual touch tap. A registered long-name
  fixture demonstrates ellipsis and full original name in the unchanged popup.
- Verification only reads existing data. No fixtures or grants created/changed.
  Real seafarer names are masked in delivered matrix screenshots.
- Before/closing proof compares 323 protected calculation/schema/migration/popup
  source files and content fingerprints for all six training-master/matrix
  tables. The original two-month calculation remains protected.
- Raw gate results, log evidence, inventory, measurements, before/after images
  and final commit/backend chronology are outside git under
  `generated-artifacts/training-matrix-compact/`.

This is development-persona UI evidence, not normal parent-SSO verification.

## Standing gates

- Full suite: **1,659 passed / 162 failed / 67 pending**, no new failures against
  the preceding baseline. This is within the agreed limit, not an all-green suite.
- Company Forms: **661 passed in 97 suites**, zero skipped/pending/failed.
- TypeScript: **222 diagnostics**.
- Closing evidence must preserve final HEAD and backend PID, with backend start
  strictly later than the final commit. Those exact times are recorded in the
  closing browser JSON and completion summary.
