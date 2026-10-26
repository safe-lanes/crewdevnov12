# Vessel Portage entry dates — preservation checklist

## Purpose and scope

The user explicitly requested retaining every finding from the Group 8 audit
before proposing or implementing changes. This checklist records that audit,
not implementation approval.

- In scope: Add Date Column → Date; Add/Edit CTM Line → Date.
- Excluded: Sign-off dates, accounting-month selection, and changes to their workflows.
- Preserve existing behaviour and business rules. Do not silently introduce
  validation, fix unrelated gaps, clean up code, or transfer approvals from other groups.
- This is a code-based baseline, not proof of live browser/database behaviour.
  No transactions or cash records were saved during the audit.
- Recheck current source before implementation. Browser-native behaviour may
  vary by browser; do not describe it as custom application validation.

## Add Date Column → Date

### Location and defaults
- Used by the Cash advances and Bond / slop chest dated entry grids.
- The selected date belongs to the target tab, not automatically every tab.
- Opening Add date explicitly starts with a blank date every time.
- No default to today or the first day of the accounting month.
- Currently uses the browser's native date input.

### Required value and validation
- Add is disabled when the date value is empty.
- The handler also refuses to proceed without a date or target tab.
- No application-defined minimum/maximum date.
- No rule requiring the date to be in the selected accounting month.
- No past/future restriction.
- No custom date-error message or separate blur validation.
- Native browser date handling governs entry and incomplete/invalid text.
- No additional JavaScript validity check before adding the column.
- No existing application-defined year range should silently become a new
  business restriction.

### Adding and displaying columns
- Add updates that tab's local date list, closes the dialog, and clears its date state.
- Local dates are combined with dates in saved transactions.
- Duplicate dates produce one column; selecting a duplicate is not an error.
- Columns are sorted by date strings.
- Headings display DD-MMM-YYYY.
- Existing transactions without dates appear under Undated, before dated columns.

### Persistence and financial effects
- Adding an empty column makes no server call.
- It creates no transaction/cash record and changes no balance.
- Empty added columns are local page state.
- On saving entered amounts, the column date becomes the transaction's txnDate.
- The accounting period remains the separately selected period; the column date
  does not change it.
- New entries are vessel-originated draft transactions.
- Existing non-draft transactions are not edited through this batch-building path.
- Clearing a saved draft cell can delete the transaction.
- Failed grid saves retain typed edits.
- Saved vessel cash-advance transactions are linked to automatically maintained
  CTM lines; their transaction date is passed to the linked cash line.
- Adding an empty column alone does not create a linked CTM line.

### Cancel, dismiss, reopen, and context
- Cancel/dismiss does not add a column.
- Closing does not immediately clear internal date state.
- Opening Add date again explicitly resets the date to blank.
- Local added columns reset when vessel/month context changes.
- They disappear on page remount unless represented by saved transactions.
- This context dependency is recorded for preservation, not authorization to
  modify accounting-month navigation or its save workflow.

### Permissions and locks
- Add date is shown only with vessel and period selected, an unlocked package,
  status open/vessel_draft/returned, and Create or Edit permission.
- The dialog Add button itself checks date presence; it does not independently
  repeat all permission/status checks.

### Related removal behaviour — preserve, do not expand scope
- Undated is not offered as a removable dated column.
- Removing a date column deletes matching draft transactions, removes the local
  added-date entry, and clears corresponding unsaved cell edits.
- Non-draft transactions are not deleted and can keep the column present.
- Failure shows an error instead of completing the local removal.

## Add/Edit CTM Line → Date

### Defaults and reopening
- Add starts with a blank date.
- Edit loads the selected line's existing date; a missing date becomes blank.
- Add resets the other form fields as well.
- Edit reloads the selected record rather than reusing abandoned edits.
- Currently uses the browser's native date input.

### Optional date and clearing
- Date is optional.
- Blank date does not disable Save.
- Saving without a date is allowed.
- Clearing an existing date and saving sends null, removing that date.
- The manual CTM create handler does not insert a default date.
- Do not confuse this with the required date for adding a grid column.

### Validation and storage
- No minimum/maximum date.
- No restriction to the selected accounting month.
- No past/future restriction.
- No custom date-error message.
- No date-specific blur validation.
- No date-dependent Save-button rule.
- The manual CTM server request accepts a string, null, or an omitted date.
- Request validation does not itself check the date string's format or compare
  it with the accounting month.
- Database storage uses a date column; database constraints still apply.
- Absence of custom date validation does not mean arbitrary strings can be stored.

### Save and financial behaviour
- Save first requires nonblank Amount, not Date.
- Missing amount displays “Missing amount” / “An amount is required.”
- The request includes the chosen date or null when blank.
- Add creates a line for the selected vessel and accounting month.
- Edit updates the existing line by its identifier.
- Changing the date does not move the line to another accounting month.
- Success refreshes relevant account/grid data, closes the dialog, and displays
  the appropriate added/updated success message.
- The server recalculates CTM closing balance.
- Failure displays Save failed with the error message.
- The failure handler does not reset the form; an open dialog retains entered values.

### Pending save
- Save is disabled and displays Saving….
- The Date field is not separately disabled.
- Cancel remains available.
- The request uses values captured when Save was clicked; later typing does not
  alter the already-started request.
- Preserve these existing behaviours; their recording is not a proposal to change them.

### Cancel and dismiss
- Cancel/dismiss does not save the date.
- Reopening Add starts with blank defaults.
- Reopening Edit reloads the saved record.
- Cancelling an edit does not change its stored date.

### Permissions, state, and linked lines
- Add is shown only for an editable package and Create permission.
- Edit is shown only for an editable package and Edit permission.
- The package-editable gate requires selected vessel/period, an unlocked package,
  and status open/vessel_draft/returned.
- Automatically linked CTM lines are not offered for manual editing.
- Server manual changes require CTM status open.
- Server rejects manual editing of transaction-linked lines.
- Server checks vessel access.
- A selector replacement must not bypass or alter these checks.

### Display and ordering
- Saved dates display DD-MMM-YYYY.
- Missing dates display an em dash (—).
- Server ordering is by date, then record ID.
- Changing a date can change the line's list position.
- There is no date-uniqueness rule preventing multiple CTM lines with the same date.

## Preservation summary

| Behaviour | Add Date Column | Add/Edit CTM Line |
|---|---|---|
| New default | Blank | Blank |
| Date needed to complete action | Yes | No |
| Blank handling | Cannot add column | Saves null |
| Must match accounting month | No existing rule | No existing rule |
| Immediate server write | No | On Save |
| Duplicate date | One shared column | Multiple lines allowed |
| Cash effect | After grid entries save | Saves line and recalculates balance |
| Reopening | Add resets | Add resets; Edit reloads saved values |

Do not standardize these differences. Any necessary behavioural departure must
be identified and approved separately before implementation. Replacing controls
must not change sign-off, accounting period, or unrelated payment/grid rules.
