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
normally. Other explicitly selected periods show annual reference KPIs only.

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
No annual KPI is prorated.

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
