# Fleet Cost Summary Period — Group 10 preservation checklist

## Scope and authority

The user explicitly requested saving every finding from the Group 10 audit so
that all existing behaviour can be preserved during later changes.

- Scope: Fleet Cost Summary's own Period month input, including its effects on
  the shared Accounts selection and navigation.
- This is an audit baseline, not a solution or authorization to implement.
- Preserve all existing behaviour unless a required departure is separately approved.
- Do not change the shared date/month selector itself. If requirements cannot be
  met without changing it, stop and ask the user first.
- Do not change unrelated code, standardize existing differences, or repair
  pre-existing issues as part of a selector replacement.
- Approvals for earlier groups do not automatically apply to this group.
- Evidence is code-based. Navigation was traced through source, not exercised
  as a live cross-screen browser test. No financial records were changed.
- Recheck current source before proposing changes; this checklist records the
  audited baseline rather than guaranteeing future code is identical.

## 1. Current control and value

- Browser-native month input, not a full-date input.
- Canonical value is YYYY-MM, for example 2026-10.
- No day, time, or timezone is included in the stored value or report request.
- Browser controls visible format, keyboard editing, and picker appearance.
- Does not currently use the shared formatted date/month selector.
- No previous-month or next-month buttons.
- No separate Apply, Search, Save, or Cancel action for the month.
- This is a reporting filter, not a date saved against an engagement or transaction.
- It has its own input but shares the selected month with other Accounts pages.

## 2. Initial month, return visits, and persistence

- With no persisted selection, shared month starts at the current month from the
  browser's local clock, not server time or a fixed business timezone.
- With an existing selection, Fleet Cost Summary uses that shared month.
- Opening, leaving, or returning to this page does not itself reset the month.
- Shared month and vessel are persisted in browser session storage.
- Selection survives sub-menu navigation and page reloads within that session.
- This is not an account-level database preference.
- Store does not implement cross-tab or cross-device synchronization.
- No timer automatically advances the selected month when a new month begins.

## 3. Changing the month

- A nonblank value reported by the input updates shared month immediately.
- Updated selection is persisted in session storage.
- The report query switches to that month and the current vessel selection.
- Other pages using shared selection use the updated month.
- No Apply step, separate draft month, custom delay/debounce, confirmation,
  success notification, payroll calculation, or financial write.
- Selecting the same month leaves the report query key unchanged; this is not
  a force-refresh action.

## 4. Clearing, incomplete typing, and invalid entry

- Input change handler ignores an empty value.
- Shared month and report selection remain unchanged when empty is reported.
- Empty does not mean all months and does not reset to the current month.
- This controlled input cannot commit an empty shared selection through its handler.
- Exact visible behaviour during incomplete editing depends on the browser.
- No custom draft tracking.
- No custom validity callback.
- No adjacent application-specific validation error.
- No custom blur validation.
- No custom Enter or Escape handling.
- Browser decides which edited values become input change events.
- Handler checks nonblank only; it does not validate the month string.

## 5. Bounds and server validation

### Frontend and store
- No min or max attributes.
- No explicit frontend year limit.
- No required attribute.
- No current-month-only rule or restriction on past/future months.
- No engagement-date bounds.
- No requirement that wages exist for the month.
- No selection restriction based on open, closed, submitted, or locked status.
- Shared month setter performs no validation or normalization.

### Report endpoint
- Period is required.
- Expected format is exactly YYYY-MM.
- Year must contain exactly four digits.
- Month must be 01 through 12.
- No day, extra text, or surrounding whitespace accepted by the format check.
- Missing/malformed period returns HTTP 400 with
  “Invalid fleet summary request”.
- Year validation is a format check, not an explicit 0001–9999 business rule;
  the regex itself does not exclude 0000.
- Keep browser behaviour, store acceptance, and server validation distinct.
- Do not transfer previously approved year-range changes from other groups.

## 6. Report selection and financial effects

- Report query enabled only when shared period is nonblank.
- Month and selected vessel both contribute to the query key.
- All vessels omits vessel filtering from the request.
- Specific vessel includes that vessel in the request.
- Changing only month does not change or clear vessel.
- Changing only vessel does not reset month.
- Server reads existing wage ledger lines for the requested period.
- No missing wages are created and no payroll run is calculated by selection.
- Preserve existing superseded-line handling, crew counts, gross earnings,
  employer contributions, deductions, net payable, settlement accruals, and
  fleet totals.
- No matching ledger lines means an empty report, not automatic wage generation.

## 7. Loading, caching, and failure

### Display
- Initial loading displays “Loading fleet summary…”.
- No rows after loading displays “No wage ledger lines for [month].”.
- Empty-result message formats month as MMM-YYYY.
- Fleet totals appear only when report rows exist.

### Query defaults
- Cached data is fresh for two minutes.
- Unused cached data is retained for ten minutes.
- No timed polling.
- No automatic refetch merely from regaining browser-window focus.
- Rate-limit response may be retried once; ordinary errors are not automatically retried.
- Revisiting a recently viewed month may use cached results, not a fresh request.

### Failure
- Failed request does not roll back to the previous shared month.
- New month remains selected.
- No dedicated page-level report-error banner or error toast.
- Without cached data, failure can display the same empty-results message.
- Cached data may remain available for the query.
- Preserve these existing behaviours; do not silently repair error presentation.

## 8. Page-level Clear

- Different from attempting to clear the native month input.
- Resets shared month to the current local month.
- Resets shared vessel to no specific vessel, shown as All vessels here.
- Applies immediately with no confirmation.
- Shared resets propagate to other Accounts screens.
- Does not add an Apply step.
- Not a special report-cache refresh command.
- Does not explicitly reset AG Grid column filters or sorting.

## 9. Navigation and shared selection

Shared month consumers identified in the audit:

- Payroll Run.
- Portage Bill.
- Monthly Transactions.
- Vessel Portage.
- Allotments & Cash → Advances.
- Allotments & Cash → Cash Bond.
- Payslips.
- GL Export.
- Fleet Cost Summary.

Behaviour:

- Destination consumes the shared month, not an independent copied selection.
- Returning to Fleet Cost Summary uses the current shared month, including
  changes made elsewhere.
- Shared Clear on another screen affects the month seen on return.
- Vessel selection also travels between shared consumers.
- All vessels on Fleet Summary corresponds to empty shared vessel; another page
  may then require vessel selection.
- Vessel Portage has an existing assigned-vessel rule for vessel users that can
  update shared vessel on entry; it does not thereby reset shared month.
- Month is not encoded as a month-specific URL for Fleet Summary.
- Browser Back/Forward does not provide a history of prior month selections.

## 10. Vessel Portage save/navigation boundary

Changing month inside Vessel Portage:

- Attempts to save dirty entries first.
- Awaits that save.
- Save failure blocks the month change and preserves the previous month.

Leaving Vessel Portage for another Accounts screen:

- Unmount handler starts a save when dirty entries exist.
- That save is not awaited to block navigation.
- Fleet Summary's own month handler does not invoke Vessel Portage's
  save-before-period-change handler.

These are different protections. Preserve both paths without silently changing
navigation or save rules, and do not claim navigation away is blocked on failure.

## 11. Export

- Disabled when no report rows exist.
- Filename includes selected period:
  fleet-cost-summary-YYYY-MM.xlsx.
- Falls back to fleet-cost-summary-YYYY-MM.csv if Excel export is unavailable.
- Exports through the current grid.
- Export does not change selected month.
- Month selection does not trigger export.
- Export does not calculate payroll.

## 12. Permissions and locks

- Screen access controlled by Account Fleet Summary view permission.
- Server classifies Fleet Summary as an office-only report.
- Period has no separate Create/Edit permission check inside the screen.
- Input remains enabled while report loads.
- Input is not disabled because accounting month is closed or locked.
- Preserve distinction between viewing a report and editing financial records.

## Preservation priorities

1. One shared month despite a separate input.
2. Immediate filtering without Apply or Save.
3. Empty input changes ignored.
4. Clear resets both shared vessel and month.
5. Shared selection survives navigation and reload.
6. No new bounds, lock restrictions, or business validation without approval.
7. No payroll calculation or financial write from month selection.
8. Vessel Portage in-page switching and navigation-away saves remain distinct.
9. Existing report caching, failure handling, and export naming stay unchanged.

Saving this checklist authorizes no application changes or proposed solution.
