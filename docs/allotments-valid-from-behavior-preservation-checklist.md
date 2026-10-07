# Group 3 — Allotments: Valid From

## Scope and evidence

This records every finding in the behaviour audit presented to the user for
Allotments' one Valid From field, covering Add and Edit. The user explicitly
requested saving the full baseline so all behaviours are preserved during
later changes. Saving this reference does not authorize a solution,
implementation, new validation or repairs to existing gaps.

The audit covered the form, Save handling, server validation, database
definition and payroll use. It was code-based: browser-specific calendar and
partial-typing behaviour was not tested. Recheck current sources against this
baseline before editing. Do not transfer approved exceptions from other groups.

## 1. Opening Add Allotment

- Valid From automatically starts with today's date.
- The default is calculated each time Add opens, not just on page load.
- It uses UTC today, not the user's local date. In India, between midnight and
  5:29 a.m., this can be the previous local calendar date. Preserve this existing
  behaviour unless separately authorized to change it.
- The default does not come from the selected payroll period, vessel, crew
  member or engagement start.
- The user can replace or clear it.
- Changing vessel, crew or other fields does not automatically reset the date.
- Leaving the dialog open across midnight does not advance the date.
- Opening Add again resets the form and recalculates the default.

## 2. Opening Edit Allotment

- Loads the selected allotment's saved Valid From.
- Does not default to today.
- Missing saved dates open blank.
- Editing other fields does not change the date.
- Reopening Edit reloads the selected record, not a deliberately persisted
  unsaved date draft.
- An older record missing Valid From cannot be saved through this form until
  a date is supplied, even if only another field was changed.

## 3. Entering and clearing

- Currently a browser-native date input: full date, not month or date-time.
- Calendar appearance and keyboard entry depend on browser/device.
- Completed values are date-only strings such as `2026-10-07`.
- Clearing leaves the field blank.
- Selecting, typing, clearing or leaving does not autosave.
- No automatic adjustment to today, month boundaries or engagement dates.
- No custom date-format parser or inline date-error message on this page.
- No separate tracking of unfinished date text.
- Save does not explicitly call the native input's validity check.
- Impossible-date and partial-typing handling relies on the browser; do not
  assume identical handling across browsers.

## 4. Required-field checks and priority

- Required for both Add and Edit.
- Enforced in Save code, not by an HTML `required` attribute.
- A blank date shows:
  - Title: `Missing fields`
  - Description: `Payee name, amount and valid-from are required.`
- No create/update request is sent; dialog remains open and values remain.
- User must supply the missing information; date does not refill with today.
- This message is shared with missing payee name/amount, not date-specific.
- Save stays enabled merely when the date is blank; clicking runs validation.

Validation order:
1. Add only: require a crew member. Failure shows `Missing crew` /
   `Select a vessel and crew member.`
2. Add and Edit: check payee name, amount and Valid From together.
3. Send the request only after those checks pass.

Missing crew therefore takes priority over a blank date on Add. Edit skips
the Add-only crew check.

## 5. Restrictions that do not exist

- No input `min` or `max`.
- No page/service rule requiring today-or-later or today-or-earlier.
- No restriction to the selected payroll month.
- No requirement to match engagement start or fall between joining/sign-off.
- No requirement to follow the last payroll posting.
- No overlap check against another allotment's date range.
- No requirement that Valid From be on/before an existing Valid To.
- No page-defined four-digit-year limit.
- No date-change warning or confirmation.
- Date changes do not automatically change allotment status.

These absences are existing behaviour, not permission to add restrictions.
Browser handling and database date validity still apply.

## 6. Saved values

- Add and Edit include Valid From in the whole-allotment request.
- The date string is sent unchanged; no timestamp/timezone conversion of the
  entered value.
- There is no separate Save date operation.
- Blank dates are blocked before sending, not saved as `null`.
- Editing Valid From does not also send a new Valid To or change status.
- UTC calculation is for the Add default, not conversion of every entered date.

## 7. While saving

- Save is disabled and shows `Saving…`.
- Valid From remains editable.
- Cancel and other dialog close controls remain available.
- The outgoing request uses the values captured at Save.
- Later edits do not change that request.
- Closing does not cancel or undo an already-sent request.

## 8. Success and failure

Success:
- Allotments list is marked for refresh.
- Dialog closes.
- Toast is `Allotment created` or `Allotment updated`.
- Response may additionally show `Allotment cap exceeded` or `Cap check skipped`.
- Cap messages are warning/note behaviour, not date-validation failures or
  date restrictions.

Failure:
- Shows `Save failed` with the returned message.
- Save becomes available again.
- Form is not reset; date remains as currently entered.
- Dialog stays open unless the user already closed it.

Existing server-order detail: record saving happens before the cap check.
A later server failure is not proof that no database write occurred. Preserve
scope; this is not authorization to repair that existing behaviour.

## 9. Cancel, close and reopen

- Cancel closes without starting a save.
- No special unsaved-changes warning.
- Page does not override shared dialog Escape, close-button or outside-click
  handling.
- Reopening Add resets to newly calculated UTC today.
- Reopening Edit reloads the saved record date.
- Unsaved date text is not stored as a persistent draft.
- Closing after Save starts does not undo the save.

## 10. Permissions, status and posted allotments

- Add requires Account Allotments Create permission.
- Edit requires Account Allotments Edit permission.
- No separate Valid From permission.
- UI offers Edit for active and suspended allotments.
- UI hides Edit for ended allotments.
- Posted-this-month indication does not itself make the date read-only.
- No date-specific payroll-period lock in this edit path.
- KYC and bank-verification flags do not disable the input.
- Server update does not repeat the UI's ended-record edit restriction.
  This existing distinction is not authorization for a repair.

## 11. Server and database

Create:
- Server independently requires Valid From.
- Missing date produces `validFrom is required`.
- Other checks, including positive amount, can reject the whole record.
- Valid date alone does not guarantee saving succeeds.

Update:
- Request is partial.
- Update service does not repeat create-time required-date validation.
- Omitting Valid From in a direct update leaves it unchanged.
- Database definition allows null/missing Valid From.
- Normal Add/Edit form is stricter: both require a date.

Storage:
- Database date, without time.
- No automatic today default in the checked schema.
- No custom date-format/date-order refinement for this field in the request
  schema definition.
- Database can reject values it cannot store as dates.
- Form/server/database differences are existing findings, not new permissions.

## 12. Payroll use

Unlike the preceding Pay Elements audit, this date directly affects payroll
inclusion in the checked calculation path.

That path uses:
- Active, non-deleted allotments.
- Matching engagement when the allotment is tied to an engagement.
- Valid From on/before the payroll month's last day.
- Valid To on/after the month's first day, when supplied.

For October's date check:
- Before October: passes.
- 1 October: passes.
- 15 October: passes.
- 31 October: passes.
- 1 November: does not pass.

These examples concern the date condition only; other payroll conditions apply.

- No partial-month reduction based on Valid From.
- Mid-month start does not reduce a fixed allotment to remaining days.
- Percentage allotments use earned-on-board gross; Valid From adds no extra
  daily proration.
- Legacy null Valid From means no start-date restriction in the engine.
- Suspended/ended allotments are excluded from this active calculation.
- Saving a changed date does not itself trigger payroll recalculation.
- Changed dates can affect later calculations or permitted reruns.

## 13. Display and layout

- Allotments table has a Valid From column using the raw returned value, not
  a custom date formatter on that column.
- Contract Detail uses its date formatter, or `—` for missing dates.
- Standard input height is 36 pixels.
- Add/Edit dialog grid has two columns, without a small-screen one-column
  switch in that grid definition.
- Label is `Valid From`, without a required asterisk.
- No reserved inline-error area for this field.
- Embedded Allotments screen reuses the same page and date field.

## Preservation boundary

Preserve every item above, including defaults, required checks, messages,
validation priority, existing absences, Add/Edit/Save/Cancel/failure paths,
permissions, date-only values, server differences and payroll implications.

Do not silently add restrictions, fix existing gaps, standardize defaults,
change payroll eligibility/proration or carry approvals over from other groups.
Read this entire checklist and verify current code before authorized work.
Report conflicts and untested browser behaviour explicitly. No solution or
implementation is authorized by saving this document.

## Source references

- `client/src/modules/accounts/pages/AllotmentsPage.tsx`
- `client/src/modules/accounts/pages/AllotmentsCashPage.tsx`
- `client/src/modules/accounts/pages/ContractDetailPage.tsx`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/dialog.tsx`
- `server/v2/accounts/controllers/allotmentsController.ts`
- `server/v2/accounts/services/allotmentsService.ts`
- `server/v2/accounts/repositories/allotmentsRepository.ts`
- `server/v2/accounts/engine/engineReads.ts`
- `server/v2/accounts/engine/wageEngineService.ts`
- `shared/v2/accounts/schema.ts`
- `shared/v2/accounts/types.ts`
- `migrations/0162_accounts_schema_rebuild.sql`
