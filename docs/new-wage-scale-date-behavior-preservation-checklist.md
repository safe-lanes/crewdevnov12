# Group 5 — New Wage Scale: Effective from and Effective to

## Scope, authorization and evidence

This preserves the full behaviour audit presented on 2026-10-07. The user
explicitly requested saving every finding so it can be preserved during later
changes, while changing nothing in the application.

Scope is only the New wage scale creation form's Effective from and Effective
to fields in `client/src/modules/accounts/pages/WageScalesPage.tsx`.
Existing-scale editor dates and revision/supersede dates belong to Group 6,
not this group. References to later activation and payroll behaviour below
explain the preservation boundary; they do not expand implementation scope.

This is a code-based audit of the form, save request, server checks, storage
and related downstream rules. It is not a claim that every browser's native
calendar or unfinished-input behaviour has been tested. Recheck current
sources before later authorized implementation.

Saving this checklist authorizes no solution, implementation, new validation,
refactoring, cleanup or repair of existing gaps.

## 1. Both dates are optional

Date checks allow these combinations, subject to other creation requirements:

| Effective from | Effective to | Date-check result |
| --- | --- | --- |
| Blank | Blank | Allowed |
| Filled | Blank | Allowed |
| Blank | Filled | Allowed |
| Filled | Same date | Allowed |
| Filled | Later date | Allowed |
| Filled | Earlier date | Rejected |

Effective to does not require Effective from to be filled first.

## 2. Opening New wage scale

Every click on New wage scale:
- Starts Effective from blank.
- Starts Effective to blank.
- Resets previous unsaved values and the rest of the creation form to its
  existing defaults.

Neither date:
- Defaults to today.
- Comes from a selected vessel, payroll month, existing scale or revision.
- Uses a UTC-versus-local-today calculation for its opening default.
- Changes when the open dialog remains open across midnight.

## 3. Entering and changing dates

- Both fields use the browser's native date input.
- Users can type, choose from the browser calendar or clear either date.
- The page keeps the value reported by the browser.
- Changing or leaving a date field does not autosave.
- Entering one date does not automatically fill the other.
- Changing name, description, currency, vessel type or vessel group does not
  reset the dates.
- Changing a date does not change those other fields.

Effective from:
- Has no minimum date.
- Has no maximum date.
- Does not receive a maximum based on Effective to.

Effective to:
- Receives Effective from as its browser-level minimum when From is filled.
- Loses that minimum when From is cleared.
- Has no maximum date.

The date-limit connection is one-way: From controls To's minimum.

## 4. Changing From after entering To

- The page does not automatically repair, replace or clear the other date.
- Moving From earlier does not shift To.
- Clearing From leaves To unchanged, while removing To's browser minimum.
- Changing or clearing To leaves From unchanged.

Example: From = 10 October, To = 20 October, then From changes to 25 October.
The page does not deliberately replace To with 25 October or clear it.
The browser-level minimum updates, and Create rejects the reversed range
when both values are present.

Preserve this distinction between changing a limit and adjusting a value.

## 5. Clearing

- Either date can be cleared independently.
- Both can be cleared.
- Cleared values stay blank; today is not automatically inserted.
- Each blank field is sent as `null`, meaning no date.
- Start-only, end-only and neither-date creation remain allowed.

## 6. Exact front-end Create validation order

First, check the trimmed Scale name:
- Blank or spaces-only name stops creation.
- Title: `Missing field`
- Description: `Scale name is required.`
- This takes priority even if the date range is also wrong.

Second, check date order:
- Runs only when both dates have values.
- Rejects Effective to earlier than Effective from.
- Allows equal dates.
- Title: `Invalid effective dates`
- Description: `Effective to must be on or after effective from.`

Third, send the creation request.

Either front-end validation failure:
- Sends no creation request.
- Keeps the dialog open.
- Retains form values for correction and retry.

## 7. Existing validation and its limits

Present:
- Browser-level minimum on To when From is filled.
- Front-end order check when both dates are present.
- Matching server-side order rule.
- Database date-storage rules.

Not present in this creation form:
- Required-date check.
- Custom unfinished-date message.
- Custom impossible-date message.
- Separate tracking of unfinished date drafts.
- Custom date parser.
- Custom four-digit-year restriction.
- Calls to browser `checkValidity()` or `reportValidity()`.
- Native form submission automatically running all browser field-validity
  checks.
- Inline date-error message or reserved inline-error space.

Create calls the page handler directly.

Unfinished typing and impossible-date handling partly depend on the browser.
The page checks the values it receives rather than independently inspecting
each unfinished date segment visible in the native input.

The date-order checks compare received date strings directly, without first
converting them to date objects. Preserve this existing behaviour and its
limitations for unusual input; do not silently replace it with new rules.

## 8. Restrictions that are absent

Neither date must:
- Be today, past or future.
- Fall inside a selected payroll month.
- Be a month's first or last day.
- Match joining, sign-off, engagement, contract or CBA dates.
- Follow another wage scale's end.
- Avoid existing wage-scale dates at creation time.

There is no required minimum or maximum duration between the dates.
The only explicit pair relationship in this creation form is that, when both
are filled, To must be on or after From.

These absences are existing behaviour, not authorization to add restrictions.

## 9. Saved values and request

- Effective from is sent as `effectiveFrom`.
- Effective to is sent as `effectiveTo`.
- Completed dates are sent as date strings reported by the inputs.
- Blank dates are sent as `null`.
- No time or timezone conversion is added.
- No start-of-day or end-of-day adjustment is added.
- No automatic extension of To occurs.
- Both dates are saved with the whole new scale, not separately.

## 10. Server and database

The server:
1. Checks the incoming request against the wage-scale data schema.
2. Requires Scale name.
3. Requires Currency.
4. Checks date order.
5. Creates the scale with status `draft`.

The service's reversed-date message is:
`Effective to must be on or after effective from`

- The server does not independently require either date.
- The request schema is generated from the table definition and adds no
  custom date-format or date-range rule for these fields.
- The database may reject values it cannot store as dates.
- Both columns allow `null`.
- Both store dates without times.
- Neither has an automatic today default.

## 11. Creation versus later activation

Create:
- Creates a draft wage scale.
- Does not activate it.
- Does not supersede another scale.
- Does not close another scale's date range.
- Does not create a revision link.
- Does not copy existing wage lines.
- Does not run payroll calculation.

Later activation checks, not New wage scale creation checks, include:
- Whether the scale has wage lines.
- Whether its dates overlap an active scale for the same vessel type/group.
- Whether amounts fall below applicable CBA minimums.

Later overlap checking:
- Uses inclusive boundaries.
- Treats missing dates as open on that side of the range.

Later CBA minimum checking:
- Uses Effective from as its reference date.
- Uses UTC today if Effective from is missing.
- Does not fill the saved Effective from field with that fallback date.

Do not accidentally move those later checks into Create. Revision-specific
date requirements are outside Group 5.

## 12. Permissions and locks

- New wage scale requires Account Wage Scales Create permission.
- No separate date permission exists.
- Both dates are editable in the creation dialog.
- The form applies no vessel/payroll-period lock to these dates.
- An existing scale need not be selected.
- Existing-scale status and revision restrictions are separate.

## 13. While creating

- Create becomes disabled and shows `Creating…`.
- Both date inputs remain editable.
- Cancel and dialog-close controls remain available.
- The request uses values captured when Create was clicked.
- Later date edits do not alter the already-sent request.
- Closing does not cancel or undo an already-started request.

## 14. Success and failure

Success:
1. Requests refresh of the wage-scale list and waits for it.
2. Closes the creation dialog.
3. Shows `Wage scale created`.
4. Opens the new scale's editor if its identifier is returned.

Opening the editor is existing post-create behaviour; it does not bring
editor date fields into this group.

Failure:
- Shows `Create failed` with the returned error message.
- Makes Create available again.
- Does not reset dates or other entered values.
- Leaves the dialog open unless the user already closed it.

## 15. Cancel, close and reopen

- Cancel closes without initiating creation.
- Shared-dialog close button, Escape and outside-click behaviour apply.
- No custom unsaved-changes warning.
- Closing alone does not save dates.
- Clicking New wage scale again resets both dates to blank.
- Unsaved dates are not deliberately restored to the next creation session.
- If creation already started, later success can still refresh the list and
  open the created scale's editor after the user closed the creation dialog.

## 16. Labels, layout and display

- Labels: `Effective from` and `Effective to`.
- Neither has a required asterisk.
- Both use standard 36-pixel input height.
- Form layout is one column on smaller screens, two from the small-screen
  breakpoint upward.
- The dialog can scroll vertically.
- No date-specific error row appears below either input.
- Native input display order and calendar appearance depend on browser/device.
- The wage-scale list separately uses its existing date formatter for saved
  dates.

## Preservation boundary

Preserve every finding above, including blanks, optionality, one-way minimum,
independent clearing, equal-date acceptance, reversed-date rejection,
validation priority/messages, payloads, server distinctions, permission and
lock behaviour, lifecycle and layout.

Do not transfer approvals from previous date-selector groups. No new
unfinished-input rule, new year restriction, shared-selector edit or other
behaviour change is approved merely by saving this checklist.

Recheck current code before proposing or implementing any later change.
Clearly distinguish code inspection from browser/real-save verification.

## Source references

- `client/src/modules/accounts/pages/WageScalesPage.tsx`
- `client/src/modules/accounts/api/accountsApiV2.ts`
- `client/src/modules/accounts/accountsFormat.ts`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/dialog.tsx`
- `server/v2/accounts/controllers/wageScalesController.ts`
- `server/v2/accounts/services/wageScalesService.ts`
- `server/v2/accounts/repositories/wageScalesRepository.ts`
- `server/v2/accounts/engine/wageEngineService.ts`
- `shared/v2/accounts/schema.ts`
- `shared/v2/accounts/types.ts`
- `migrations/0162_accounts_schema_rebuild.sql`
