# Dashboard KPI comparisons

Only Crew Retention and D&A Analysis display the company KPI values saved in
Admin > KPIs. Dashboard View is enough to read this narrow projection; target
editing and Access Control permissions are neither exposed nor granted.

## Periods and interpretation

Crew Retention alone defaults to an inclusive rolling 24 calendar months ending
today. This is a forecast/reference for management review, using the existing
retention formula with different requested dates, not a new retention formula.
Its KPI comes from the end year. The official TMSA management-review period is
two whole consecutive calendar years (for example 2025–2026 for a 2026 review).
Both the default and an explicitly selected official two-year window compare
normally. The rolling default labels those comparisons **On track / Off track**
because it is a forecast; an explicit official two-year selection retains
**Met / Missed**. Hovering the forecast status explains the rolling window and
the exact official two-calendar-year dates. Other explicitly selected periods
show annual reference KPIs only.

The shared filter retains its existing current-calendar-year default. A separate
selection-intent flag distinguishes an untouched/cleared default from applying
that same year explicitly. Only Retention consumes that flag and its derived
rolling range; all other cards retain their original period inputs. Clear
restores the default. Both affected cards show their actual date boundaries,
and Retention's drilldown uses the same effective dates as its figures.

D&A remains an annual count. During the current year, exceeding the maximum is
**Missed**, but being at/below it means **Within KPI so far**, not achieved.
A completed calendar year can be **Met** or **Missed**; equality is Met. Other
periods, including future years, show grey annual reference KPIs without status.
No annual KPI is prorated. The current unfinished year's heading ends at today
and says **(year to date)**; completed years retain their full dates. This is a
heading-only distinction: it does not change the requested calculation period.

Only the actual figure is coloured green/red. KPI lines are the chart blue or
grey for period-ineligible references. Selected population filters suppress
all comparison statuses and show the company-wide reference note. Missing KPIs
have no line; unavailable actuals stay unavailable. KPI read failures offer
Retry and never pretend that no KPI is set. Stored direction and unit govern
wording/comparison, including real zero and exact decimal target values.

Senior Officers intentionally also belong to Officers when both flags apply:
TMSA 2.4 and 3.4 are different, overlapping measurements.

## Verification

`scripts/verify-dashboard-kpi-browser.mjs` starts the real app against the
identity-verified registered test database on its separate port. It uses a
synthetic Dashboard View-only persona, creates disposable synthetic crew/ranks
and safety records, temporarily supplies test KPIs, and restores prior target
rows and removes its own fixtures in teardown. No development data is written.
All successful screens use real API responses. Only failure-path evidence
deliberately substitutes failed transport responses.

The script writes screenshots, a report and a self-contained HTML gallery under
ignored `generated-artifacts/dashboard-kpis/`. Development preservation is
separately measured with read-only before/after fingerprints of all public
tables, columns and constraints. The before command refuses to overwrite its
baseline.

## Closing evidence — 16-Nov-2026

- Full repository run: 230 files, 2,615 tests; 2,386 passed, 162 failed,
  67 pending. The failed-test identities exactly match the prior Admin KPI
  closing baseline: no new or removed failures. This is not a green suite.
- Company Forms: all 103 discovered suites present, 740 passed, zero failed,
  skipped, pending or missing tests. These results were validated from the
  same full-suite JSON, not a selected subset of passing files.
- TypeScript: 222 diagnostics, within the approved ceiling.
- New comparison/card/period-isolation tests passed in the full run, as did
  the expanded KPI integration and explicit permission-route inventory.
- Real isolated-backend browser verification: 20 screenshots, no page errors.
  Successful actual/KPI responses were not mocked. Transport failure screenshots
  deliberately force an error, and Retry restores the real KPI response.
- All 275 development public-table content/count fingerprints, columns and
  constraints matched before and after browser verification and the full suite.
- Source differences include no Reports, Approval Workflow, migrations, schema
  definitions or actual-calculation endpoint handlers. Retention's effective
  default range intentionally changes; no formula or other card period changes.
- Browser evidence is from the isolated test app using a synthetic development
  persona with Dashboard View only, not real parent authentication or a signed-in
  main-preview session. Those latter signed-in paths are **NOT VERIFIED**.

Generated evidence is in ignored `generated-artifacts/dashboard-kpis/`:
`closing-gates.json`, `full-suite.json`, `typescript-final.log`,
`development-before.json`, `development-after.json`, `browser/report.json` and
the self-contained `dashboard-kpi-evidence.html` screenshot gallery.

## Read-only assessment of other card headings — 17-Nov-2026

No other Management Dashboard card renders the full January–December heading
that D&A used. Recruitment, Promotions and Appraisals use the shared period
selector and identify the selected year in their drilldown titles, without a
year-to-date qualification. Their explicit date-range titles retain the selected
boundaries. Crew Pool likewise identifies the selected period, but represents
a snapshot at the selected period end rather than a year-to-date event count.
These cards, their labels, filters, queries and drilldowns were not changed.

### Wording-only verification — 17-Nov-2026

- Focused comparison, card and period-isolation tests: 42 passed.
- Closing full run: 2,387 passed, 162 failed, 67 pending; the failed-test
  identities exactly match the previous closing baseline.
- Company Forms: all 103 discovered suites present; 740 passed, zero failed,
  skipped or missing. TypeScript: 222 diagnostics.
- The first full attempt had one additional existing Access Control browser
  navigation timeout. Its two unchanged tests passed standalone; the repeat
  full run met both gates. No assertions or timeouts were weakened.
- Isolated synthetic browser journeys passed with 20 screenshots, including
  rolling forecast labels, current D&A year-to-date dates, and official
  two-year final-result labels. The native forecast hover title is asserted
  exactly in component and browser checks.
- All 275 development table fingerprints, columns and constraints matched the
  fresh before snapshot after both full runs.
- The comparison helper, query periods, actual calculations, colours, schemas
  and backend application code were unchanged. Only the displayed status words,
  forecast explanation and D&A current-year heading changed.

Evidence: ignored `generated-artifacts/dashboard-kpi-wording/`, with the first
full attempt retained separately from the closing full run.
