# Training Matrix — expiry urgency and trial relief date

> Presentation follow-up: the controls now share a compact bar and the displayed
> overdue chip is **O/D**, still using the internal `Expired` filter value.
> See [control-bar measurements and evidence](control-bar-presentation.md).
> The verification results below record the original urgency/trial implementation.

## Delivered behaviour

Vessel → Training Matrix now has two independent controls above the existing
five-entry evidence legend.

### Due in

The **3M / 2M / 1M / Expired** chips use the Drugs & Alcohol chip row extracted
into `client/src/components/common/DueInChips.tsx`. D&A Summary, Annual, Monthly
and Periodic use that same component with their original labels, colours and
static behaviour. Monthly retains its original two entries; the other three
retain their original four. Only the matrix uses interactive pressed states.

No urgency chip is selected by default. Multiple selected windows are combined
as “any selected window”. Existing Mandatory/Recommended filters still apply.
Rows with no matching cells are removed; unmatched cells in retained rows are
empty, not restyled.

The server's UTC reference date is “today”. Membership comes from the certificate
the shared engine actually relies on, including an accepted equivalent when
selected:

| Chip | Inclusive date rule |
| --- | --- |
| 3M | Today through today plus three calendar months |
| 2M | Today through today plus two calendar months |
| 1M | Today through today plus one calendar month |
| Expired | Expiry strictly before today |

Calendar-month addition clamps to the last day of the target month. Expiry today
is not expired; it belongs to the three future windows. The windows are nested,
not disjoint buckets. Selecting 1M and 3M therefore has the same expiry scope as
3M. Selecting Expired and 1M combines overdue certificates with the next month.

No chosen certificate, no expiry, or an invalid expiry gives no urgency
membership. Such cells return when the urgency filter is cleared; their existing
evidence state is not changed or assumed compliant.

The shared server helper is `certificateExpiryWindows` in
`server/v2/shared/training-compliance/onboard.ts`. The original two-month dot
adapter calls that helper too, retaining its original contract-relative condition.
There is no second expiry-window implementation in the client.

### Trial relief date

**Check against a different relief date** requests the existing read-only matrix
GET with the sole additional option `trialReliefDate=YYYY-MM-DD`. The server
validates the date, retains its own today/rank/revision inputs and evaluates every
on-board assignment using a copied input with that trial relief date.

The result retains the actual `plannedReliefDate` and separately reports the
`effectiveReliefDate` used. The active trial is visibly marked **“Trial date
active — no changes saved”**. **Clear trial date** restores actual relief dates.
Clear and Retry remain available after a failed request; raw errors are not shown.
Old actual-date dots are not displayed as if they were the new trial result while
the request is pending.

**No assignment record can be modified by this control.** It has no save endpoint,
uses GET only, copies calculation inputs in memory, and its database work remains
inside a PostgreSQL-enforced read-only transaction. Real planned relief dates,
contract periods, checklist acceptance evidence and stored matrices are untouched.
This control does not change checklist enforcement.

### Combined use

A trial date can change contract-relative dots. Urgency chips then filter the
returned certificate evidence against **today**, not against the trial date.
Changing only chips does not request or recalculate anything and does not change
any remaining dot's colour, outline, precedence or meaning. Clearing the trial
retains selected urgency chips; clearing the chips retains the trial date.

The crew-name action still opens the same approved details popup with the
current matrix result. The popup implementation itself is unchanged.

## Verification

### Automated coverage

- Server unit cases cover all four windows, nested memberships, expiry today,
  exact boundaries, month-end/leap-day clamping, missing/invalid expiry, and
  equivalence to the previous two-month predicate.
- Existing on-board calculation tests remain in place.
- Isolated-database API coverage proves a trial changes the result while
  preserving actual planning dates/content, clearing restores the original dots,
  the transaction is read-only, and malformed dates/additional authority inputs
  are refused.
- UI coverage proves union filtering, unchanged dot styles, no chip-only request,
  the trial GET and clear, no stale trial evidence, and plain retry/error handling.

Focused verification: the existing calculation and API suites passed **69 tests**;
the new urgency unit suite passed **15 tests**; the UI suite passed **25 tests**.
The full-suite gate below also covers all of these together.

### Main-preview browser evidence

Verification clicks the real main-preview screens using the existing development
office persona (master user 24, role Admin), not normal parent SSO. No API response
is mocked. Mutation requests are refused by the verification harness, except the
existing SELECT-only submission-counts POST used by navigation. No fixture was
created or changed; the registered PDF/training fixture vessel is reused.

The visible-cell counts with Mandatory selected in the current main data were:

| Selected windows | Matching dots | Remaining dot styles equal to unfiltered result |
| --- | ---: | --- |
| 3M | 10 | Yes |
| 2M | 0 | Yes |
| 1M | 0 | Yes |
| Expired | 1 | Yes |
| 1M and Expired | 1 | Yes |

The empty 1M/2M results are genuine current-data results, not missing responses.
Positive boundary cases for those windows are covered by the synthetic tests.
Screenshots scroll matching dots into view where present and mask real names.

On the registered fixture, a trial end of 01-Jan-2030 changes the held Advanced
Fire Fighting certificate from green to amber while preserving its actual relief
input. Missing captured rank stays amber hollow; Not held stays red hollow.
Selecting 3M while this trial remains active correctly produces no matching
fixture rows: the held certificate expires outside today's three-month window.
Clearing the trial restores the exact original dot map.

Desktop (1700 px) and narrow (900 px) measurements:

- Median training-row height: **37 px**.
- Crew-column width: **142.5 px**.
- Evidence legend: **exactly five entries**.
- Existing dot palette only: green `#16A34A`, amber `#F59E0B`, red `#DC2626`,
  with the existing filled/hollow styles. No new dot colour.

Evidence files are under ignored
`generated-artifacts/training-matrix-urgency/`: `closing-browser.json`,
`closing-*.png`, `before.json`, `closing.json`, and the full-suite reports.
The closing screenshots cover default, each individual chip, multi-selection,
narrow width, trial active, trial with an urgency filter, and trial cleared.

### Standing gates and data integrity

Fresh full-suite result: **1,687 passed / 162 failed / 67 pending**, with no new
failing assertions compared with the preceding baseline. The command exits 1
because those 162 existing failures remain; this is not a wholly green suite.
Company Forms, discovered and checked across that same full run: **97 suites,
661 passed, zero skipped/pending/todo/failed, no missing suites**.
Fresh TypeScript result: **222 diagnostics**, none in the changed files.

No schema migration is part of this change. The calculator, date arithmetic,
types, certificate/matrix reader, checklist policy and approved details popup
retain identical source hashes. Across **all 272 development user tables**, row
counts and content fingerprints are unchanged. The column-schema fingerprint is
also unchanged. These comparisons use database-enforced read-only transactions;
automated fixture writes/cleanup occur only in the independently registered
`sail_automated_tests` database, never development.

**Confirmed:** no changes to the five dot states, colours, precedence, validity
thresholds, schema or stored matrix data. The new urgency windows filter evidence;
the trial changes only the end-date input to the existing calculation.
Assignment and planning records, including actual relief/contract inputs, are
unchanged.

The final commit and backend process start are reported in the completion message.
