# CBA Reference date behaviour preservation checklist

## Scope and evidence

This records the source-code audit presented to the user for CBA Reference's
**Effective from** and **Effective to** fields. The user explicitly requested
preserving every finding before any selector changes. Saving this document
does not authorize implementation.

The audit covered the Add/Edit form, save requests, server checks, database
definitions and wage-scale checks that consume these dates. It was a
**code-based audit**, not live browser verification. Browser-specific calendar
and keyboard behaviour remains unverified. Recheck current code against this
baseline before editing; do not assume the snapshot is timeless.

## 1. Opening Add or Edit

For both fields:
- New CBA reference starts blank; neither defaults to today.
- Edit loads the selected record's corresponding saved date.
- A missing saved value shows blank.
- Changing other fields retains the date.
- Changing one date does not automatically change the other.
- Opening New resets the whole form.
- Opening Edit reloads the selected row, not another row's unsaved dates.

## 2. Selecting, typing and clearing

- Both are normal browser date inputs.
- Calendar selection and supported keyboard entry are browser-native.
- Calendar appearance and visible input format depend on browser/device.
- These are full dates, not month-only or date-and-time values.
- The page has no custom date parser, date placeholder or custom calendar.
- Valid input is held as a date-only value such as `2026-10-07`.
- Clearing a field makes that field blank; the other field is unchanged.
- Changing or leaving a date field does not save the record.
- No date adjustment, copying or rounding happens automatically.
- Incomplete/invalid typing relies on native browser handling.
- The page has no separate unfinished-date handling or error message.
- Exact keyboard/partial-input behaviour needs browser verification; do not
  assume it matches a custom text-based selector.

## 3. Validation, including deliberately documented absences

- Neither date is required.
- Both may be blank, or either one may be filled alone.
- No app-defined past-date or future-date restriction is set.
- Neither input sets a minimum or maximum date.
- There is no rule requiring Effective to to be on/after Effective from.
- Equal start/end dates are not blocked.
- No overlapping-date check exists across CBA records in the CBA save path.
- Changing a date does not prompt for confirmation.
- Unlike Pay Elements, CBA Reference does not have end-before-start validation.
- These absences are existing behaviour, not authorization to add restrictions.
- Lack of custom validation does not imply arbitrary text can be saved:
  browser date-input handling and database date validity still matter.

## 4. Save lifecycle

### Before sending
- The page checks that the trimmed CBA name is nonempty.
- No separate date-required or date-order check is performed.
- Both dates are included in the request.
- A filled field sends its date-only value; a blank field sends `null`.
- Clearing a previously saved date and saving removes that date.
- Values are not converted to local time, UTC timestamps or month boundaries.

### While saving
- Save is disabled and displays “Saving…”.
- Both date inputs remain enabled.
- Cancel and dialog close controls remain available.
- The request captures values at Save click time.
- Later input changes do not modify an already-started request.
- Closing the dialog does not cancel an already-started save.

### Success
- The CBA list is refreshed.
- A created/updated success message is displayed.
- The dialog closes.

### Failure
- A “Save failed” message appears.
- Save becomes available again.
- Entered dates are not reset by the failure handler.
- If the user has not already closed the dialog, it remains open.

## 5. Cancel, closing and reopening

- Cancel closes without starting a save.
- The close button uses the normal dialog-close behaviour.
- No CBA-specific unsaved-changes warning exists.
- The page does not override normal dialog Escape/outside-click closing.
- Reopening New starts with blank dates.
- Reopening Edit reloads saved row values.
- No persistent date draft or automatic save on leaving the page exists.
- Cancelling before Save does not save; closing after Save starts does not
  undo or cancel that request.

## 6. Server and database

- Both columns allow null values.
- Storage is date-only, not date-and-time.
- The generated request schema accepts optional/nullable date strings.
- It adds no CBA-specific date-order validation.
- The CBA service checks neither date order nor overlaps.
- The checked database definition has no start/end-order constraint.
- The database DATE type rejects values it cannot store as a date.
- Database errors use the general create/update failure response, not a
  date-specific inline field error.

## 7. Permissions and restrictions

- New CBA row visibility follows Create permission.
- Row Edit visibility follows Edit permission.
- Neither date has separate permissions.
- Neither is read-only merely because it is past, expired or already used.
- The CBA save path does not apply a payroll-period lock to these dates.
- Preserve existing access rules independently of selector replacement.

## 8. Display and downstream use

### CBA table
- Dates display as DD-MMM-YYYY, for example `07-Oct-2026`.
- Missing dates display blank.
- The table date formatter uses UTC date parts.
- Editing happens in the dialog, not directly in these table cells.

### Wage-scale minimum checks
- Dates determine whether a CBA reference applies during minimum-rate checks.
- Effective from is the first applicable day; Effective to is the last.
- Both boundary days are inclusive.
- A blank start means no lower date boundary.
- A blank end means no upper date boundary.
- With both blank, the date window itself does not restrict applicability.
- The comparison date is the wage scale's Effective from, falling back to
  the current UTC date if absent.
- Currency, rank and pay-element/category matching still apply.
- Saving CBA dates does not itself pay wages, recalculate payroll or activate
  a wage scale.

## Preservation boundary

Preserve optional dates, blank defaults, field independence, unchanged date-only
values, clearing semantics, Add/Edit/Save/Cancel/failure behaviour, access rules,
absence of date/status locks and inclusive/open-ended downstream date windows.

Do not silently add date-order, overlap, past-date or future-date restrictions.
Any incompatibility or newly discovered issue must be reported separately,
not silently repaired as part of replacing the selectors.

## Source references for rechecking

- `client/src/modules/accounts/pages/CbaReferencePage.tsx`
- `client/src/modules/accounts/api/accountsApiV2.ts`
- `client/src/modules/accounts/accountsFormat.ts`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/dialog.tsx`
- `server/v2/accounts/controllers/cbaReferenceController.ts`
- `server/v2/accounts/services/cbaReferenceService.ts`
- `server/v2/accounts/repositories/cbaReferenceRepository.ts`
- `server/v2/accounts/services/wageScalesService.ts`
- `shared/v2/accounts/schema.ts`
- `shared/v2/accounts/types.ts`
- `migrations/0162_accounts_schema_rebuild.sql`
