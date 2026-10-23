# Group 4 — Cash Advance Date and Bond Sale Date

## Scope, authorization and evidence

This preserves the full behaviour audit presented on 2026-10-07. The user
explicitly confirmed Group 4 after correcting an ambiguous reference to CBA.
Save every finding for later preservation; saving does not authorize a solution,
implementation, new validation, cleanup or repair of existing gaps.

Scope is only New Cash Advance → Date and Add/Edit Bond Item → Sale Date,
both in `client/src/modules/accounts/pages/CashBondPage.tsx`, with separate
save actions. Their Period filters are excluded. References to payroll periods
below explain existing date behaviour, not an expansion of scope.

The audit covered page code, API requests, controllers, services, repositories,
database definitions and payroll use. It was code-based, not a browser test of
every calendar, typing, invalid-input or partial-input case. Recheck current
sources before any authorized changes.

## 1. Key distinctions

- Both dates are optional, unlike Allotments Valid From.
- New records default to today calculated using UTC.
- Cash Advance has no Edit Advance form on this screen.
- Bond Edit loads the saved Sale Date.
- Clearing either date sends `null`, meaning no date.
- Clearing an existing Bond date requests removal of that saved date.
- Neither date has an explicit past/future restriction or must match payroll month.
- Neither date controls payroll month.
- Neither has a custom invalid-date message.
- Do not turn clearing into a Save-blocking error without separate approval.

## 2. New Cash Advance — opening and changing

- New Advance opens the New Cash Advance dialog.
- Date defaults to today each time the dialog opens, not only at page load.
- Default uses UTC today, not local today. In India from midnight through
  5:29 a.m., this can be the previous local calendar date.
- Default is not derived from payroll period, crew or engagement dates.
- Reopening New Advance resets the form and recalculates today.
- Keeping the dialog open across midnight does not advance Date.
- User can replace, type into or clear the browser-native date field.
- Changing crew, amount, recovery amount, currency or remarks does not reset Date.
- Changing Date does not change those other fields.
- Selecting, typing, clearing or leaving the date does not autosave.
- Clearing does not refill today.

## 3. New Cash Advance — validation order

Create Advance checks, in this order:

1. Selected crew must exist in the currently loaded eligible crew list.
   Failure: `Missing crew` /
   `Select a vessel/period above, then a crew member.`
2. Amount and Recovery per Month must be supplied.
   Failure: `Missing fields` /
   `Amount and monthly recovery are required.`
3. Send the request.

- No required-date check.
- No separate date-validity check in the save action.
- Blank Date alone does not block Create Advance.
- Missing crew takes priority over missing amounts.
- These failures keep the dialog open and retain form values.

## 4. New Cash Advance — saved value

- Completed date is sent unchanged as `requestDate`.
- Blank date is sent as `null`.
- No timestamp or timezone conversion of the entered date string.
- UTC calculation applies to the opening default, not all entered dates.
- Date is saved with the whole advance, not via a separate date-save operation.
- Payroll period is sent separately and is not changed by Date.

## 5. New Cash Advance — recovery and payroll

- Date does not determine when recovery starts.
- Form recovery preview uses Amount and Recovery per Month, not Date.
- Changing Date does not alter that preview.
- Saved schedule starts from the advance's separate payroll period.
- Checked payroll path uses recovery period, status, engagement and remaining
  balance, not `requestDate`.
- Earlier, later or blank Date does not itself delay or accelerate recovery.
- No daily reduction of recovery based on Date.
- Example: an advance assigned to October does not become a November recovery
  merely because its Date is in November.

## 6. New Cash Advance — permissions and editing

- New Advance requires Account Allotments Create permission.
- No separate Date permission.
- No Edit Advance form on this screen.
- Existing actions include recovery-detail viewing, cancellation and closing;
  they are not date-edit actions.
- New Advance is not hidden merely because vessel/period selection is missing.
  Eligible-crew validation prevents proceeding without a suitable crew member.
- This create path does not have Bond's portage-lock check.
- Backend advance update exists, but is not an Edit Date form in this group.

## 7. Bond — opening Add

- Sale Date starts with UTC today, recalculated each time Add opens.
- It is not defaulted from payroll month or crew engagement date.
- Add resets previous unsaved form values.
- Leaving the dialog open across midnight does not advance Sale Date.

## 8. Bond — opening Edit

- Loads the selected item's saved Sale Date, not today.
- Missing saved dates open blank.
- A missing date does not prevent saving, provided other checks pass.
- Editing other fields does not change Sale Date.
- Reopening Edit loads the record's date rather than deliberately restoring an
  unsaved date draft.
- Crew selection is disabled in Edit; Sale Date remains editable.

## 9. Bond — changing and clearing

- Sale Date can be replaced or cleared in both Add and Edit.
- Changing quantity/unit price can recalculate amounts but leaves Sale Date alone.
- Changing Sale Date does not recalculate amounts.
- Clearing does not refill today.
- Changing or leaving the date does not autosave.

## 10. Bond — validation order

Save checks, in this order:

1. Add only: crew must be selected.
   Failure: `Missing crew` / `Select a crew member.`
2. Add and Edit: trimmed Item name must not be empty.
   Failure: `Missing item` / `Item name is required.`
3. Send the request.

- No required-date check.
- No separate date-validity check in this save action.
- Blank Sale Date does not block Add or Edit.
- Missing crew takes priority over missing item on Add.
- Edit skips the Add-only crew check.
- Validation failures keep the dialog open and retain entered values.

## 11. Bond — saved value

- Completed date is sent unchanged as `saleDate`.
- Blank date is sent as `null`.
- Clearing a saved Sale Date in Edit requests removal of that date.
- Saving another field still includes current Sale Date in the request.
- No timestamp or timezone conversion of the entered date.
- Add sends payroll period separately.
- Normal Edit does not send a changed period or crew.
- Sale Date changes do not move an item to another payroll month.

## 12. Bond — monthly deduction and payroll

- Sale Date does not decide which month receives the deduction.
- Items are grouped by stored crew and payroll period.
- Combined monthly deduction includes eligible, non-cancelled, automatically
  deducted items; Sale Date is not an inclusion condition.
- Blank or out-of-month Sale Date does not itself exclude an item.
- No daily proration based on Sale Date.
- Every Bond save, including a date-only edit, runs the existing combined
  monthly-deduction update.
- This does not mean Sale Date itself changes the amount or triggers full
  payroll recalculation.
- Example: an October item remains assigned to October when Sale Date is
  changed to September or November.

## 13. Bond — permissions, locks and status

- Add requires Account Allotments Create permission.
- Add is shown only with vessel and period selected and an unlocked period.
- Edit requires Account Allotments Edit permission.
- Edit actions are hidden when the displayed period is locked.
- No separate Sale Date permission.
- Edit does not additionally exclude deducted or cancelled item statuses.
- Changing Sale Date does not automatically change item status.
- Server also checks the relevant portage lock on saving.
- Date-only edits can be rejected by that lock.
- Inside an already-open dialog, date and Save are not directly disabled by
  lock state; Save is disabled only while saving.
- Update lock checks use the record's stored period, not Sale Date's month.

## 14. Shared date-entry behaviour

- Both use browser-native full-date inputs, not month or date-time fields.
- Browser supplies calendar appearance and keyboard behaviour.
- Values are date-only strings, normally such as `2026-10-07`.
- Page stores the value reported by the input in controlled form state.
- Display order and keyboard/calendar behaviour depend on browser/device.
- Neither has an HTML required attribute, min, max or read-only setting.
- No custom parser or custom inline date-error message.
- No separate tracking of unfinished date text.
- Save does not explicitly call the browser's input-validity check.
- No native form submission that automatically performs date validation.
- No page-defined four-digit-year limit.
- No date-change warning or confirmation.
- Partial typing and impossible-date handling depend on browser behaviour.
  The code does not guarantee identical reporting across browsers.
- These browser-specific cases were not tested in this audit.

## 15. Restrictions that do not exist

Neither field has an explicit rule requiring its date to:

- Be today, today-or-earlier or today-or-later.
- Fall within the selected payroll month.
- Match joining or engagement start.
- Fall between joining and sign-off.
- Follow the last payroll posting.
- Come before or after another date field.
- Be unique among other advances or Bond items.

These absences are existing behaviour, not permission to add restrictions.
Browser and database date-validity limits still apply.

## 16. While saving

- Each form has its own separate save action and saving state.
- Its Save/Create button is disabled and displays `Saving…`.
- Date remains editable.
- Cancel and dialog close controls remain available.
- Request uses values captured when Save was clicked.
- Later typing does not modify the already-sent request.
- Closing does not cancel or undo an already-sent request.

## 17. Success and failure

Advance success:
- Marks advances list for refresh.
- Closes dialog.
- Shows `Advance created`.

Bond success:
- Marks Bond items and related monthly transactions for refresh.
- Closes dialog.
- Shows `Bond item added` or `Bond item updated`.

Both on failure:
- Show `Save failed` with the API error message.
- Save becomes available again.
- Form is not reset and date is not automatically replaced.
- Dialog remains open unless user already closed it.

Important existing Bond ordering: the item is saved before the combined
monthly-deduction update. A later failure can be reported after the item was
saved. A failed response is not proof that nothing changed. This finding is
not authorization to repair that behaviour.

## 18. Cancel, close and reopen

- Cancel closes without initiating a save.
- No special unsaved-changes warning.
- Page does not override shared-dialog close-button, Escape or outside-click
  handling.
- Unsaved date drafts are not persistently stored.
- Reopening a new-record form resets to freshly calculated UTC today.
- Reopening Bond Edit reloads selected record's date.
- Closing after Save starts does not undo the save.

## 19. Server and database

For both dates:
- Database definitions allow null/missing dates.
- Checked schema has no automatic today default for either column.
- Storage is a date without time.
- Request schemas have no custom date-order, payroll-month or engagement-date
  rule for these fields.
- Services do not independently require these dates.
- Database can reject values it cannot store as dates.
- Direct partial update: omitted date stays unchanged; `null` clears it.
- Normal forms explicitly send the current date or `null`.

Other fields can still prevent a record save. A valid or blank date alone
does not guarantee success.

Advance creation also checks:
- Crew supplied.
- Amount greater than zero.
- Monthly recovery greater than zero.
- Valid first-recovery period supplied.

Bond creation also checks:
- Crew and item name supplied.
- Valid payroll period supplied.
- Deduction amount not negative.
- Engagement can be resolved.
- Relevant period not locked.
- Suitable active Bond pay element exists when a positive combined deduction
  is needed.

Bond updates do not repeat every create-time check in exactly the same way.
Preserve that existing Add/Edit distinction; do not silently standardize it
while replacing Sale Date.

## 20. Display, layout and reused screens

- Labels are `Date` and `Sale Date`, without required asterisks.
- Standard input height is 36 pixels.
- Both appear in two-column form grids without a small-screen one-column
  grid rule.
- Neither currently reserves an inline-error line.
- Advances table Date column uses returned `requestDate`.
- Bond table Sale Date column uses returned `saleDate`.
- Neither table column has a custom date formatter.
- Combined Allotments & Cash screen reuses the same tab components, fields
  and save behaviour.

## Preservation boundary

Preserve every item above, including defaults, optionality, clearing to null,
existing validation priority/messages and absences, separate save actions,
Add/Edit/Cancel/failure paths, permissions, locks, date-only values, server
differences and payroll implications. Do not carry approvals from other date
groups into this one. Do not change Period filters. Read the full checklist and
verify current code before any authorized work; report conflicts and untested
browser behaviour explicitly. Saving this reference authorizes no solution or
application changes.

## Source references

- `client/src/modules/accounts/pages/CashBondPage.tsx`
- `client/src/modules/accounts/pages/AllotmentsCashPage.tsx`
- `client/src/modules/accounts/api/accountsApiV2.ts`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/dialog.tsx`
- `server/v2/accounts/controllers/advancesController.ts`
- `server/v2/accounts/controllers/bondItemsController.ts`
- `server/v2/accounts/services/advancesService.ts`
- `server/v2/accounts/services/bondItemsService.ts`
- `server/v2/accounts/repositories/advancesRepository.ts`
- `server/v2/accounts/repositories/bondItemsRepository.ts`
- `server/v2/accounts/engine/engineReads.ts`
- `server/v2/accounts/engine/wageEngineService.ts`
- `shared/v2/accounts/schema.ts`
- `shared/v2/accounts/types.ts`
- `migrations/0140_create_accounts_v2_tables.sql`
- `migrations/0162_accounts_schema_rebuild.sql`
