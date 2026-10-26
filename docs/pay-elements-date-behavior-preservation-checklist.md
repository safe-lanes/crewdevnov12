# Group 2 — Pay Elements: Effective from and Effective to

## Scope and evidence

This preserves the complete behaviour audit presented to the user for the two
Pay Elements date fields. The user explicitly requested remembering every
finding before making any changes. Saving this document does not authorize
implementation, a solution, new validation or repairs to existing gaps.

The audit covered the current form, Save handling, server checks, database
definitions and payroll code. It was a code-based analysis, not a live browser
test. Exact browser/device calendar and partial-typing behaviour remains
unverified. Recheck current sources against this baseline before editing.

Unlike CBA Reference's original baseline, Pay Elements has both an end-date
minimum tied to the start date and a Save-time end-before-start check.
Do not assume CBA-specific approved behaviour changes are approved here.

## 1. Opening New or Edit

For both fields:
- New starts blank; neither automatically defaults to today.
- Edit loads the selected record's corresponding saved date.
- A missing saved value shows blank.
- Changing another field retains the entered date.
- Opening New resets the whole form.
- Opening Edit reloads the selected record, not another record's unsaved dates.
- Changing one date does not automatically change or clear the other.

## 2. Entering and clearing dates

- Both currently use normal browser-native date inputs.
- Users can select dates using the browser calendar.
- Keyboard entry follows the browser's native date-input handling.
- Visible format and calendar appearance can vary by browser/device.
- These are full dates, not month-only or date-and-time values.
- The page has no custom date parser or custom date-format message.
- A completed date is held as a date-only value such as `2026-10-07`.
- Clearing a field makes that field blank.
- Selecting, typing, clearing or leaving a field does not automatically save.
- No automatic adjustment to today, month start or month end occurs.
- Unfinished or impossible dates rely on browser handling.
- The page does not separately track unfinished date text.
- Save does not explicitly check the native input's browser-validity flag.
- Do not assume every browser handles partial typing identically.

## 3. Optional dates and allowed combinations

Both dates are optional. Subject to the other required fields:

| Effective from | Effective to | Date-rule outcome |
|---|---|---|
| Blank | Blank | Allowed |
| Filled | Blank | Allowed |
| Blank | Filled | Allowed |
| Filled | Same date as start | Allowed |
| Filled | Later than start | Allowed |
| Filled | Earlier than start | Save blocked |

## 4. Two parts of the existing date-order rule

### End-date input minimum

- Effective to uses Effective from as its minimum date.
- With a start of 10 October, the end input receives 10 October as its earliest
  allowed date.
- There is no maximum end date.
- Clearing the start removes the end-date minimum.
- Changing the start updates the end-date minimum.
- Effective from has no opposite restriction: no maximum tied to the end date.

### Save-time validation

- On Save, when both dates are filled, the page checks whether end is before start.
- This applies to both New and Edit.
- If the range is reversed, the exact message is:
  - Title: `Invalid effective dates`
  - Description: `Effective to must be on or after effective from.`
- No save request is sent.
- The dialog stays open.
- Both entered dates remain unchanged.
- The user must correct the range or clear one of the dates.

## 5. Changing start can leave an invalid pair visible

Example: start is 10 October, end is 15 October, then start changes to 20 October.

- End remains 15 October; the application does not move or clear it.
- The end input's minimum updates to 20 October.
- Save is blocked with the date-order message.
- No custom date-order message appears immediately under the fields.
- The page's own date-order message appears when Save is clicked.
- Existing reversed-date records have no exemption: saving through this form
  checks the range even when only another field was changed.

## 6. Restrictions that do not exist

- No rule requires either date to be today or later.
- No rule blocks future dates.
- Neither input sets a maximum date.
- The start input sets no minimum date.
- There is no maximum date-range length.
- There is no overlap check against other pay elements.
- Changing a date does not require confirmation.
- No app-defined four-digit-year limit is set on these native inputs.
- These absences are existing behaviour, not permission to add restrictions.
- Native input handling and database date validity still apply; lack of custom
  checks does not imply arbitrary text can be saved.

The Save check compares stored date strings directly. This works for ordinary
`YYYY-MM-DD` values. Do not assume unusual extended-year values behave like
ordinary four-digit dates without testing.

## 7. Validation order and Save-button behaviour

Save checks in this order:

1. Code and name are present.
2. Type, category, calculation method, payment timing, rounding rule and status
   are selected.
3. End date is not before start date.
4. Only then is the request sent.

- When required fields and date order are both wrong, missing-field validation
  takes priority.
- Save is not disabled merely because dates are reversed; clicking it shows
  the validation message.

## 8. Saved values

For both New and Edit:
- Both dates are included in the request.
- A filled field sends its date-only value.
- A blank field sends `null`.
- Clearing a previously saved date and saving removes it.
- The page does not convert dates into timestamps or shift them between zones.
- Dates are saved with the whole pay element; there is no separate Save dates action.

## 9. While saving

- Save is disabled and displays `Saving…`.
- Both date inputs remain editable.
- Cancel remains available.
- Dialog close controls remain available.
- The request uses the values captured at the Save click.
- Later edits do not change a request already sent.
- Closing the dialog does not cancel that request.

## 10. Success and failure

### Success
- The Pay Elements list refreshes.
- The page shows `Element created` or `Element updated`.
- The dialog closes.

### Failure
- The page shows `Save failed` with the returned error message.
- Save becomes available again.
- The failure handler does not reset the dates.
- The dialog stays open unless the user already closed it.
- Existing percentage-base, nationality and deactivation checks can still
  reject the whole save even when the dates are acceptable.

## 11. Cancel, closing and reopening

- Cancel closes without starting a save.
- There is no Pay Elements-specific unsaved-changes warning.
- The page does not override normal close-button, Escape or outside-click handling.
- Reopening New starts with blank dates.
- Reopening Edit reloads the record's values.
- Unsaved date changes are not stored as a persistent draft.
- Cancelling before Save discards the edits.
- Closing after Save starts does not undo that request.

## 12. Server and database

- The page enforces end-before-start validation, but the Pay Elements server
  service does not repeat it.
- Both database date columns allow null.
- Storage is date-only, without a time.
- The request schema accepts optional/nullable date strings.
- The Pay Elements service has no date-order or date-overlap check.
- The checked database definitions/migrations have no start/end-order constraint.
- The database can still reject values it cannot store as dates.
- Thus the form blocks reversed ranges, but the server does not independently
  enforce the same rule.
- This difference is an existing finding, not authorization to repair it.

## 13. Permissions and existing records

- New follows Account Pay Elements Create permission.
- Edit follows Account Pay Elements Edit permission.
- Neither date has a separate permission.
- Dates do not become read-only merely because an element is inactive, old,
  expired or already referenced.
- The date-edit path has no payroll-period lock.
- Changing dates alone does not trigger the separate guard used when changing
  status to inactive.

## 14. Display, layout and downstream use

### Table and input layout
- Both dates have their own table columns.
- Dates display like `07-Oct-2026`.
- Missing dates display blank.
- The formatter uses UTC date parts.
- Editing happens in the dialog, not directly in table cells.
- Inputs use the standard 36-pixel height.
- The form uses two columns on wider screens and one column on smaller screens.

### Payroll code checked
- Active pay elements are selected using active status and not-deleted status.
- The audit did not find these two master Pay Element dates used to automatically
  start or stop payroll eligibility. This is a finding about the checked code,
  not a claim that all possible integrations were tested.
- Wage-scale dates and contract-override dates have separate handling.
- Saving these dates does not itself recalculate payroll or automatically
  change the element's status.

## Preservation boundary

Preserve every item above, especially the end-date minimum and Save-time
date-order check, equal-date acceptance, optional blanks, independent field
values, clearing semantics, validation priority, Add/Edit/Save/Cancel/failure
handling, access rules, unchanged date-only values and existing server behaviour.

Do not silently add date requirements, overlap checks, time restrictions,
server validations or automatic adjustments. Report incompatibilities and
existing gaps separately. This document authorizes no application changes.

## Source references for future rechecking

- `client/src/modules/accounts/pages/PayElementsPage.tsx`
- `client/src/modules/accounts/api/accountsApiV2.ts`
- `client/src/modules/accounts/accountsFormat.ts`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/dialog.tsx`
- `server/v2/accounts/controllers/payElementsController.ts`
- `server/v2/accounts/services/payElementsService.ts`
- `server/v2/accounts/repositories/payElementsRepository.ts`
- `server/v2/accounts/routes.ts`
- `server/v2/accounts/engine/engineReads.ts`
- `server/v2/accounts/engine/wageEngineService.ts`
- `shared/v2/accounts/schema.ts`
- `shared/v2/accounts/types.ts`
- `migrations/0162_accounts_schema_rebuild.sql`
- `migrations/0163_accounts_amendments.sql`
- `migrations/0166_accounts_payroll_run_prep.sql`
