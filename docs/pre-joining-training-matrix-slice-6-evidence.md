# Training Needs suggestions — closing evidence

## Delivered

- One durable suggestion per assignment/required master course, source
  **Pre-joining compliance**, retaining the gap snapshot, matrix revision and
  calculation version. Only mandatory Not held, Expired at joining and Expires
  during contract qualify. The last targets the day before certificate expiry.
- Repeated identical checks do not insert duplicate suggestions or history.
  Dismissals survive rechecks. Withdrawn/closed entries reuse their slot if a
  later genuine gap requires a fresh suggestion and fresh confirmation.
- Confirm/Dismiss require the existing **Training > Create** grant. Dismiss
  requires a reason. Strict request bodies refuse browser audit identities.
  Authenticated principal ID, server time, before/after values and reason are
  recorded in append-only history.
- Confirmed generated needs appear in **Training & Ret. > Training**, source
  Pre-joining compliance. They are read-only there: decisions live beside the
  gap in **Reliever Status > See Details**.
- Normal D3 creation/update and batch-save reconcile automatically in the
  certificate transaction. A qualifying direct/equivalent certificate closes
  generated suggestions/needs, recording its identity and the reason. Unknown
  expiry or incomplete information cannot silently close a need.
- Every assignment-cancellation or relief-deferral write path withdraws active
  entries through database triggers. History is retained. Manual/other-source
  Training Needs are never updated by this service.
- Calculation remains **1.4.0**, unchanged. No master course expiry value or
  grant changed. No new enforcement or vessel-matrix slice 7 work.

## Main-preview fixtures and method

See `docs/company-form-regression-fixtures.md`, under Training Needs suggestion
acceptance, for the exact reused vessel, seafarer, assignment, plan and new
certificate/manual-need descendants. Main-preview fixtures remain in place.
The replay finds/reuses these descendants rather than creating more each run.

Office development persona 24/Admin uses existing Training View/Create and
Vessel/Crew Database View grants. Persona 3/Crewing Manager has Training View
but not Create; confirmation is refused. No grants are added. Main checks use
the real screens and persisted scope checks, not response mocks; normal parent
sign-in remains on the developers' production checklist.

Preparation uses authenticated fixture-only D3 APIs to create a pending renewal
and an unrelated manual need, and temporarily shortens the old fixture
certificate. Confirmation/dismissal are clicked in See Details. The pending
renewal is completed and saved through D3, causing automatic closure. Existing
fixture future-issued dates are temporarily corrected to pass ordinary profile
validation; original dates and the originally absent recruitment date are
restored afterwards. Registered new descendants and immutable history remain.

Main-preview replay and reporting:

```
node scripts/verify-training-suggestions.mjs               # prepare/review only
# final commit, then restart Start application
node scripts/verify-training-suggestions.mjs --closing     # click decisions/D3
node scripts/report-training-suggestions.mjs
```

The final JSON report captures full HEAD/time, backend PID/start, unchanged
HEAD/PID across closing evidence, screenshots, identities, before/after history,
the certificate closure, and an unchanged content fingerprint for the manual
need. Generated evidence is outside git in `generated-artifacts/training-slice6`.
`screenshots.html` is self-contained and downloadable.
The Training Needs grid uses its existing name filter for the fixture-only
capture, since rows below its virtualized viewport are not initially rendered.
Replays preserve the original clicked decision journey and its commit/runtime
metadata; they review the retained decisions instead of manufacturing repeat
dismissals or fresh fixture roots.

## Verification

Full isolated suite: **1607 passed, 162 failed, 67 pending**, no new assertion
failures compared with the previous closing run. The full suite is not green.
The 27 new tests pass, covering eligibility, target date, direct/equivalent
closure, immutable history, manual non-interference, lifecycle withdrawal,
confirm/dismiss UI, raw-error protection, signed-JWT identity, missing Create,
and tenant/vessel refusal.

Company Forms is discovered from the full result using the existing authoritative
discovery/checker, not a selected subset. `gates.json` records suite/test totals
and refuses any failure/skip. TypeScript: **222 diagnostics**. The report also
refuses a closing backend start not later than its captured final commit.

## Presentation changes

The new requested suggestion status/target/actions sit within the Course cell,
not a new table column; approved category/course ordering and all existing
compliance columns, certificate details and action-only switch are retained.
Generated Training Needs rows cannot use the unrelated manual/source edit
dialog. No other mock-up departures or calculation changes are introduced.
