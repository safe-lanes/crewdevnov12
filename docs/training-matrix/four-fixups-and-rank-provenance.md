# Training Matrix: four display fix-ups — 22-Oct-2026

## Changes

- Names are title-cased per word, including apostrophe and hyphen parts.
  Rank labels remain sentence case. Both lines are centred; name ellipsis,
  original full-name title, underline and click behaviour remain.
- Hover and touch cards use a measured collision region beginning at the
  **actual Training header's right edge**, not assumed column widths.
  Cards prefer the right side near that edge; if neither horizontal side fits
  at narrow widths, they use vertical placement. Near the bottom they flip up.
  Their width is capped at 320px and at the available evidence-region width.
  The region updates on scrolling and viewport resize.
- A null/missing **captured contract rank UUID**, never a rank-label comparison,
  produces the existing amber hollow dot for every otherwise-uncheckable cell.
  Its hover/tap says:
  “Contract rank was not captured for this assignment; requirement could not
  be checked.” It never says not required. Rows remain visible with either
  requirement filter active even if no crew has a known obligation.
- Genuine not-required cells remain blank; five evidence legend entries,
  dot colours, precedence, underlying result and the approved details window
  are otherwise unchanged. No calculation, threshold or schema change.

## Current data: read-only diagnosis, no rank repair

There are **two affected cells**, SA006 and SC004, on the same registered
fixture assignment `a4120000-0000-4000-8000-000000000002`, on registered
fixture vessel `a4120000-0000-4000-8000-000000000001`.

Raw SQL found **no `crew_assignment_rule_context` row**, not a populated rank
hidden in a column the reader overlooks. There are no incumbent or reliever
planning links for this assignment. Its creation and update timestamps are
both `2026-10-20 03:58:28.281878`.

The registered creation path directly inserts this assignment as `OnBoard`:
`scripts/provision-company-pdf-layout-samples.mjs:73–74`. It does not call
Deploy or capture the rank. The fixture register identifies it as the
retained, noncurrent preparation assignment, unused by the final PDF samples.
Thus its creation path **never captured a contract rank**. There is no stored
evidence of a subsequent capture/clear operation; no rank-change audit exists
that would justify claiming one. This is not a present-rank fallback problem
or a matrix reader looking in the wrong field. No record was repaired.

### Normal Deploy capture and its limits

1. `server/v2/rotation/controllers/rotationController.ts:331–336` calls
   `rotationDeployService.deployEntry`.
2. `server/v2/rotation/services/rotationDeployService.ts:130–189` creates the
   exact assignment, writes its exact reliever planning link, and
   **unconditionally calls `captureDeployRank` at line 189**, before marking
   the entry Deployed. It is not behind an optional UI flag.
3. `server/v2/company-forms/subjects/crewAssignmentRuleContext.ts:3–23`
   locks/validates that exact link, resolves master **identifiers** and stores
   `contract_rank_uuid`, label and provenance. No exact plan throws; the
   transaction cannot finish successfully by ignoring that failure.
4. Capture can still produce a null UUID when the planning reference yields
   zero or multiple eligible masters; it records the reason instead of guessing.
   `ON CONFLICT DO NOTHING` also preserves an existing context rather than
   replacing it. Early rejected Deploy attempts do not capture anything.
   Paths outside this Deploy service, including this direct fixture insert,
   do not automatically invoke its capture.
5. `server/v2/shared/training-compliance/onboard.ts:17–29` reads
   `crew_assignment_rule_context.contract_rank_uuid` joined by exact
   `assign_uuid`. It deliberately does not infer a rank from the profile,
   planning display text or another voyage.

## Existing underlined-name behaviour — unchanged

Clicking/tapping a name selects that exact crew assignment and opens the
existing `TrainingMatrixCompliance` details window with its on-board snapshot,
today as reference and planned relief as contract end. It does not navigate to
the crew profile or mutate data. Underline/decoration, original-name title and
ellipsis remain. The embedded-result normalization and details component are
unchanged.

## Evidence

Main-preview UI verification uses the same existing development office persona
as the preceding compact-matrix check, not a normal parent-SSO login.
At both 1700px and 900px:

- median course-row height **37px**;
- crew-column width **142.5px**;
- exactly **five evidence legend entries**;
- measured hover/tap card left edge is not left of the actual Training column's
  right edge; card right/bottom edges remain within the viewport;
- lower-edge cards flip upward, and course names remain readable.

The retained fixture displays two exact `#F59E0B` hollow dots, with the
missing-rank explanation on hover and tap; clicking its name still opens the
unchanged details window. Screenshot files and raw measurements are stored
outside Git under `generated-artifacts/training-matrix-fixups/`.

Before/after proofs compare 323 protected calculation/schema/migration/popup
source files, six matrix/master-table fingerprints and three additional
assignment/context/planning-table fingerprints. No development fixtures, grants,
rank context, matrix rules or certificates are changed by these checks.
The existing server diagnostics logger is unchanged and continues logging
these cells on each request.

## Standing gates

- Full suite: **1,663 passed / 162 failed / 67 pending**; no new failures
  against the preceding compact-matrix baseline.
- Entire discovered Company Forms area: **661 passed in 97 suites**,
  zero skipped, pending, todo or failed.
- TypeScript: **222 diagnostics**.
- Closing browser evidence records the final commit and a strictly later
  backend process start, asserting stable HEAD and PID throughout the journey.
