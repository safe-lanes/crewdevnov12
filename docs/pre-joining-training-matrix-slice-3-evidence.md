# Pre-joining Training Matrix — slice 3

Historical evidence for calculation 1.0.0. The subsequent approved revision is
documented in `pre-joining-training-matrix-calculation-1.1-review.md`; the case
generator now produces the latest review table, preserving the original output.

## Boundary

Shared server calculation only. No screens, HTTP routes, enforcement, grants,
Training Needs, checklist snapshots or main-preview fixture writes.
The later HTTP caller must authorize the assignment and vessel before invoking
the server-internal service. Existing attachment permissions remain unchanged;
the calculation exposes certificate identity and dates, never file content,
storage paths or unprotected download URLs.

## Commits

| Step | HEAD | UTC |
|---|---|---|
| 1 — versioned pure calculator | `c0f8c9b084057e2eb080c0d3ef25ebdc41664068` | 21-Oct-2026 03:27:03 |
| 2 — canonical tenant reader | `bf2073a29da3ae90178099df108b5664cd0e96d9` | 21-Oct-2026 03:35:27 |
| 3 — executable review cases | `269b8fa633c9958be96d50249db9d87a53e59960` | 21-Oct-2026 03:42:29 |
| 4 — closing evidence | Commit containing this document | Reported at delivery |

## Public server contract

`server/v2/shared/training-compliance/index.ts` exports:

- `calculateTrainingCompliance`: pure calculation of canonical inputs.
- `calculateRelieverTrainingCompliance`: read the exact linked assignment,
  its saved matrix and D3 certificates, then use the same pure calculation.
- `TRAINING_COMPLIANCE_VERSION`, currently **1.0.0**.

The reader uses the current tenant's connection in a PostgreSQL-enforced
**READ ONLY / REPEATABLE READ** transaction. No alternate connection, schema
fallback, browser-provided facts or arbitrary crew/vessel search is used.
It requires the exact planning-to-reliever assignment/crew/vessel link and an
active crew, vessel and Planned/OnBoard assignment. Missing or inconsistent
links return an incomplete check, not another assignment's information.

## Date and selection semantics

- Civil ISO dates; no current clock, time zone or time-of-day comparison.
- Joining is the reliever's planned joining date. Contract end is joining plus
  the reliever's own whole, nonnegative range-end calendar months, clamped to
  the last day of the resulting month. Zero months means that same date.
- No incumbent/shared planning date, assignment sign-on or present rank is a
  substitute. The captured Deploy rank UUID resolves the numeric rank row used
  by the existing company rank cells; rank names and parent codes are not
  matched.
- Expiry is inclusive: expiry on joining counts at joining; expiry on contract
  end is valid through that end. Issue on joining counts; issue after joining
  is excluded even when the certificate lasts longer.
- Consider the required master course and only its explicit, directed accepted
  alternatives in the **selected saved revision**. Never traverse links, reverse
  them, consult a working draft or substitute another requested revision.
- No expiry (null or blank) is longest. Otherwise latest expiry wins. Equal
  expiry prefers direct over equivalent, then newest issue, then stable
  certificate identity. If all eligible certificates have expired, the latest
  expired certificate is still named as evidence of the gap.
- Missing/malformed issue dates, malformed expiry and expiry before issue are
  incomplete, never treated as permanent validity. Malformed relevant records
  are not hidden behind an otherwise good certificate.

The five course states are **Valid**, **Valid, no expiry**, **Expires during
contract**, **Expired at joining**, and **Not held**. Incomplete is a separate
check status, not a sixth state. A positive course state cannot be concluded
without a contract end: the chosen certificate is retained, but the result says
**Contract end not set** and the summary is incomplete. A known negative such as
Not held can remain visible alongside that incomplete check.

**Complete means calculated, not compliant.** Summaries distinguish valid,
warning, gap and incomplete for Mandatory and Recommended. Any missing required
input or failed calculation makes both group summaries incomplete. No checklist
permission or enforcement decision is made here.

Every course result includes calculation version, required course identity and
obligation, chosen certificate's identity/name/number/dates (or explicit null),
whether the chosen certificate is an equivalent, and excluded future-issued
identities. The whole result identifies the saved matrix revision used.
Failures contain plain retry instructions, never raw SQL/stack text.

## Existing policy storage, not reinterpreted

The existing saved matrix contains vessel applicability. Slice 2 added frozen
equivalent links per saved revision. Mandatory/Recommended rank cells remain in
the current company requirement table; this slice does not invent historical
rank-cell snapshots. The result explicitly names
`current_company_rank_requirements` as that source. A later checklist snapshot
will freeze the actual result, as planned.

D3 currently stores company-course numeric IDs; older records also use course
codes. The reader resolves explicit company-course ID/UUID/code and master
UUID/code lineage to the canonical master UUID. An ambiguous identifier remains
unlinked. Names, abbreviations and free text never establish identity. Historical
identifier lineage can resolve a recorded certificate without renaming/relinking
it; archived required policy rows instead make the current check incomplete.

## Verification

Focused run: **76 passed** across:

- `tests/unit/training-compliance-calculator.test.ts`
- `tests/unit/training-compliance-case-table.test.ts`
- `tests/integration/api/training-compliance-reader.test.ts`

The PostgreSQL tests use only the identity-verified registered TEST_DATABASE_URL
and two private schemas, with no public search-path fallback. Schemas copy real
migrated table shapes, but no real crew data. Synthetic records are removed
normally afterward; no main-preview fixture register entry is appropriate.

Evidence includes actual transaction flags (`on`, `repeatable read`), unchanged
content fingerprints across all 13 fixture tables, canonical rank/date inputs,
blank own values beside populated incumbent values, deleted/unlinked/ambiguous
certificates, two tenants with identical IDs and different results, older saved
equivalents despite a newer revision/draft, missing/corrupt matrices and an
actual SQL failure handled without exposing its raw message.

### Review table

Run `npx tsx scripts/report-training-compliance-cases.ts`.
It imports only pure synthetic inputs and the calculator: no database or HTTP.
It asserts each outcome before producing the plain table and full JSON under
`generated-artifacts/training-slice3/case-table.*` (outside Git).
The same **24 rows** run as independent unit cases, including the exact expiry
boundaries and missing end requested for review.

## Final standing gates

- Full unfiltered run: **1,474 passed / 162 failed / 67 pending**, 1,703 tests.
  The suite is not green, but meets the agreed bounds. Comparison against slice
  2's full result finds no new failing assertions.
- All **76 new tests pass** in that same full run.
- Company Forms: **96 discovered files, 648 passed, zero failures, zero
  skipped/pending, zero todo**. The complete-subset checker reports no gaps.
- TypeScript: **222 diagnostics**; no new compliance-module diagnostic.
- Raw SQL confirms **zero remaining training_calc_* test schemas** afterward.

Raw reports, focused output, the executable case table and the coverage check
are outside Git under `generated-artifacts/training-slice3/`. `gates.json`
summarizes the actual unfiltered results, not a filtered test run.

After this closing commit the managed main workflow is restarted. Actual final
HEAD, commit time, listening backend PID/start time and capture time are stored
in `generated-artifacts/training-slice3/closing-main-preview.json`. That
recorder asserts backend start is later than this final commit and the working
tree is clean.

**Stopped for logic review. No slice 4 work has been built.**
