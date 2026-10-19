# Shared Accounts Period selector — Group 12 preservation checklist

## Authority, scope, and evidence

The user requested saving every behaviour from the completed Group 12 audit so
it can be preserved during later changes. This document records that audit; it
does not propose a fix or authorize implementation.

- Leave this group until last: one shared input is used in eight places and
  affects loading, shared selection, and Vessel Portage unsaved-entry protection.
- Preserve all existing behaviours unless a departure is explicitly required
  and approved for the later requirement.
- Do not transfer approvals from other date-selector groups automatically.
- Avoid changes to the shared date selector itself; stop and ask the user if
  fulfilling requirements is impossible without changing it.
- Do not repair pre-existing issues, change business rules, or perform unrelated
  cleanup.
- Evidence is source-code analysis, not live financial-save testing or live
  unsaved-entry failure testing.
- Server validation findings are endpoint-specific, not a claim that every
  downstream business rule was exhaustively exercised.
- Recheck current source before implementation: this is the audited baseline.

## 1. Shared input and shared state

The same VesselPeriodBar supplies Period in:

1. Payroll Run.
2. Portage Bill.
3. Monthly Transactions.
4. Vessel Portage.
5. Advances.
6. Bond.
7. Payslips.
8. GL Export.

- All eight share the selected Vessel and Period.
- A month selected on one screen is used when navigating to another shared
  screen.
- Fleet Cost Summary has a separate, already-replaced input but reads and writes
  the same Period store. Its input is outside Group 12, but cross-screen selection
  effects must be preserved.

## 2. Defaults, persistence, and independent selection

- Initial Vessel is blank.
- Initial Period is the current month, derived from the browser's local date,
  not UTC or a server date.
- Period is represented as YYYY-MM, e.g. 2026-10.
- Vessel and Period are persisted in browser session storage.
- They survive Accounts navigation and page refresh within the session.
- Opening another shared screen does not deliberately reset the month to today.
- Changing Vessel does not automatically change Period.
- Changing Period does not automatically change Vessel.
- There is no month-rollover timer that advances the selection at the start of a
  new calendar month.
- The store's setPeriod does not independently validate or normalize values.
- Invalid stored months are not automatically repaired by the store.

## 3. Native input behaviour

- Period currently uses a native browser month input.
- Browser controls display, calendar popup, and native keyboard editing.
- A nonempty change is immediately passed to the page's month-change handler.
- No Apply button.
- No debounce or explicit finish-editing step.
- No separate custom text draft.
- No custom inline date error.

### Empty values and incomplete editing

- The handler accepts only nonempty values.
- Clearing the native input does not clear the shared Period.
- An empty value emitted during incomplete native editing is ignored.
- The last accepted Period remains in shared storage.
- Temporary appearance while editing depends on the browser.
- This differs from Group 11, where blank explicitly clears a stored limit.

### Bounds and keyboard handling

- No min, max, or required attribute.
- No explicit frontend year range.
- No past/current-only restriction.
- No requirement that a month already contain payroll records.
- No open-month-only restriction.
- No custom blur, Enter, or Escape handling.
- Locked months can still be selected and viewed. Locking affects actions,
  not whether the Period input can select that month.

## 4. Loading, caching, and failed requests

- Most period-specific queries require both a selected Vessel and nonempty
  Period.
- Changing either changes the relevant request/cache key.
- The screen loads the selected vessel/month context.
- Existing cached data may be reused; changing month does not guarantee a new
  network request every time.
- With Vessel blank, most period-specific queries are disabled.
- Reference lists may still load independently.
- Shared query defaults include a two-minute freshness window, no automatic
  browser-focus refetch, and a limited retry for rate-limit errors.
- A data-loading failure does not automatically restore the previous Period.
- Distinguish loading failure from Vessel Portage's save-before-switch failure:
  the latter can prevent the new Period from being accepted at all.

## 5. Clear behaviour

Normally Clear:

- Clears Vessel.
- Resets Period to the current local month, not blank.
- Updates shared state and therefore other shared screens.

Page-specific additions:

| Place | Additional behaviour |
|---|---|
| Payroll Run | Clear calculation warnings and displayed sync result |
| Monthly Transactions | Reset Origin and Status to all |
| Vessel Portage | Save dirty entries first where needed; refuse Clear on failure |
| Portage Bill, Advances, Bond, Payslips, GL Export | Use the shared default reset |

- Vessel Portage retains a ship user's assigned vessel on Clear.
- Its office-user default is no selected vessel.

## 6. Payroll Run

Period determines:

- Engagement review.
- Payroll workspace and portage information.
- Vessel submission-package status.
- Context passed to Sync from Crewing and calculation.

Changing Period additionally clears calculation warnings and displayed sync
result. It does not itself run wage calculation.

Loading a selected vessel/month can run the background create-missing-engagements
operation when editing is permitted:

- Creates missing engagements from Crewing.
- Does not replace explicit Sync for updates/cancellations.
- Server skips approved/locked months for this background creation.
- Failure is non-blocking.
- The page remembers the last vessel/month for this operation, not a permanent
  once-ever set.

## 7. Portage Bill

- Period selects payroll workspace and engagement review.
- Related ledger loads once a portage record is available.
- Preserve distinct no-context, loading, no-bill, and available-bill states.
- Period is used in display and export filename.
- Changing Period neither calculates nor approves the bill.

## 8. Monthly Transactions

- Period selects monthly transactions, eligible engagements, and workspace/lock
  status.
- New transactions use selected Period.
- Ordinary Period change does not reset Origin and Status.
- Clear resets both to all.
- Locked-month restrictions make relevant actions read-only.
- Period input remains usable for changing month.
- There is no Vessel Portage-style save-all-dirty-grid-entries-before-switch
  handler here.

## 9. Advances — list is not month-filtered

- Main list comes from the general advances endpoint and is not filtered by
  selected Period.
- Vessel/Period affects eligible engagement data for creating an advance.
- Selected Period is included when creating an advance.
- Selected Period is captured as the default write-off Period when the
  applicable closing action opens.
- Advances can remain visible without a selected Vessel.
- Month change must not be treated as filtering the main list to advances in
  that month.
- Period is not Request date.
- Period change does not automatically rewrite existing recovery schedules or
  historical records.

## 10. Bond

- Period selects bond items, related monthly transactions, eligible engagements,
  and workspace/lock status.
- New bond creation uses selected Period.
- Period is separate from the item's date field.
- Changing the filter does not directly rewrite saved item dates.
- Locked-month restrictions apply to relevant actions while selecting another
  month remains possible.

## 11. Payslips

- Period selects the payslip batch.
- Changing Vessel or Period returns to list mode.
- Previously selected single/all-payslip statement view is no longer displayed.
- Existing effect cleanup removes statement-printing mode.
- Period appears in headings and export naming.
- Changing Period neither calculates wages nor creates payslips from scratch.

## 12. GL Export

- Period selects the GL report.
- Used in report context, empty-result messaging, and export filename.
- Changing Period does not run payroll or create wage ledger lines.

## 13. Vessel Portage — accepting or refusing Period changes

When Period changes:

1. Check for tracked unsaved entry-grid changes.
2. If dirty, attempt to save all dirty entry tabs.
3. Await the saves.
4. Accept the new shared Period only if all saves succeed.
5. Clear submission warnings after accepting the change.

- Saves use the old vessel/month context, not the newly requested month.
- With no dirty entries, accept the new Period without that save operation.

### Failure

- Do not change Period.
- Show “Period not changed”.
- Failed entries remain available for correction.
- Tell the user to fix the issue or clear cells before changing Period.

### Success

- After successful autosaving, show “Changes auto-saved”.
- Accept the new Period and load its context.
- Changes to vessel/month reset unsaved entry state and added date columns.

### Multiple dirty tabs and no-ops

- Dirty tabs save individually, not as one all-or-nothing transaction.
- Some tabs can save while another fails.
- A failure still blocks the overall Period change.
- Successfully saved tabs remain saved.
- Changes producing no creates/updates/deletes are cleared without sending an
  empty batch.
- Protection covers tracked entry-grid changes; it is not a blanket promise to
  save every dialog or draft.

## 14. Vessel Portage — related navigation and autosave differences

### Vessel change

- Same save-before-switch approach.
- Save failure can refuse Vessel change.

### Clear

- Dedicated in-flight protection prevents repeated Clear operations.
- If already at default Vessel and current Period, return without resetting.
- Otherwise save dirty entries before resetting.
- Failure shows “Filters not cleared” and prevents reset.
- Successful reset clears submission warnings.
- Ship users retain assigned Vessel; office users reset to none.

### Entry-tab switch

- Starts saving the dirty tab being left.
- Tab switch itself does not await save success.
- Do not silently change this to the Period-switch behaviour.

### Leaving the page, refresh, and timed save

- Component unmount starts a best-effort background save if entry changes remain.
- It does not provide the awaited block-on-failure protection of Period change.
- Browser refresh/close has a native warning while dirty.
- That warning handler does not itself save.
- A background save runs every ten minutes while dirty.

### Existing switch boundaries

- Period handler has no explicit same-month early return.
- Period switching lacks the dedicated in-flight switch guard used by Clear.
- Shared input is not disabled during the asynchronous save.
- Protection belongs to Vessel Portage's handler, not the shared store.
- These are existing boundaries, not authorization to repair or standardize them.

## 15. Vessel Portage — month loading and editability

Selected Period controls:

- Submission-package status.
- Cash-to-master information.
- Monthly transactions.
- Engagement review.
- Payroll workspace.

Grid editability depends on:

- Selected Vessel and Period.
- Permissions.
- Lock status.
- Package status: editable statuses include open, vessel draft, and returned.

- Loading an editable vessel/month can trigger background creation of missing
  engagements from Crewing.
- Period is therefore not purely a visual filter on this page.

## 16. Validation boundaries

### Frontend

- Shared input's custom check is to ignore empty change values.
- Shared store and query-enabling checks are not full month validation.

### Backend

- Validation is endpoint-specific.
- Reports and several engagement/calculation operations require YYYY-MM with
  months 01–12.
- Some list controllers pass Period to their service instead of applying that
  same controller-level validator.
- Locking, permissions, and package-status checks remain separate checks for
  applicable operations.
- Do not describe all eight screens as using one identical backend validator.
- A format check is not a current-year-only or no-future-month rule.

## Preservation priorities

1. Shared Vessel/Period, including Fleet Summary's connection.
2. Current local month defaults and session persistence.
3. Ignoring empty native values rather than clearing Period.
4. Immediate filtering, no Apply button.
5. Existing loading and cache behaviour.
6. Each page's distinct Clear and Period-change effects.
7. Advances' non-month-filtered main list.
8. Vessel Portage saving in the old context before accepting a new month.
9. Failure blocking that switch while retaining failed entries.
10. Separate permissions, locks, background engagement creation, and validation.

Saving this checklist authorizes no solution, implementation, application
changes, or unrelated fixes.
