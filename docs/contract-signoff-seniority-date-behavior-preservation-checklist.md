# Contract dates and sign-off — Group 9 preservation checklist

## Authority, scope, and evidence

The user explicitly requested saving every finding from the Group 9 audit for
preservation before any changes. This checklist records that audit, not a
solution or implementation authorization.

- Contract detail → Sign-off date.
- Vessel Portage → Sign-off date.
- Contract detail → Next step date, inside the Seniority Anchor editor.
- Next step date is the seniority date, not a fourth date field.
- Review the two sign-off paths together because both affect the same engagement
  end date and wages, but do not standardize their different existing rules.
- Preserve all existing behaviour except separately approved, necessary changes.
- Do not change the shared selector, unrelated code, business rules, or existing
  discrepancies without separate approval. If shared-selector changes become
  necessary, stop and ask first.
- Approvals for other Accounts groups do not automatically apply here.
- This baseline is code-based: no dates, wages, or records were changed during
  the audit. No live saves, payroll recalculation, or exhaustive browser-native
  date-input tests were performed.
- Recheck current source before proposing changes; this is historical audit
  evidence, not proof that future code remains identical.

## Common date-input behaviour

- All three currently use the browser's native date input.
- Calendar selection, typing, and incomplete/invalid-input handling are browser
  behaviours, not custom application validation.
- No HTML minimum or maximum date on any of these three inputs.
- No custom adjacent date-error message.
- No separate date-validation handler on blur.
- Dates are sent as date-only strings, without time or timezone.
- Saved dates elsewhere use the Accounts DD-MMM-YYYY formatter.
- Server request formats require four-digit years even though an unrestricted
  native browser date input can accept larger years.
- Blank-date, permission, and save rules differ by field as recorded below.

## Contract detail → Sign-off date

### Opening, defaults, and clearing
- Opens with the engagement's existing end date; blank when absent.
- Does not default to today or the selected accounting month.
- Reopening reloads the engagement date, not an abandoned edit.
- Save is disabled when blank; the save handler also stops when blank.
- Clearing the field cannot remove an existing end date through this dialog.
- The general server API accepts null endDate, but this dialog does not send null.

### Validation
- Frontend does not check before-start dates, accounting-month membership,
  past/future dates, or overlaps with other engagements.
- Server requires YYYY-MM-DD string format.
- Server refuses contract-field changes when a settlement freezes the engagement.
- For a resulting draft/active/completed engagement, the server checks the
  effective updated dates against the crew member's other relevant engagements.
- Overlap is inclusive: sharing a boundary day can count as overlap.
- An absent end date means open-ended for overlap checking.
- This general update handler does not contain the dedicated Vessel Portage
  checks for end date before start date or old/new accounting-month state.
- Its request-format validation is not full real-calendar-date validation.
- Database constraints still apply; absence of an application check does not
  imply arbitrary invalid dates can be stored.
- These differences are existing behaviour, not permission to repair or unify rules.

### Permissions and freezing
- Edit action hidden without Account Contracts Edit permission.
- Edit action hidden when contract detail reports frozen.
- General contract-update endpoint is office-only.
- Freeze covers non-deleted settlements in submitted, approved, paid, or locked status.

### Successful save
- Updates the existing engagement end date.
- Sets the manual end-date flag.
- Refreshes the contract-detail query.
- Closes the dialog.
- Shows “Sign-off date updated”.
- Crewing sync reports a differing sign-off for review instead of overwriting
  the manually set date.

### Failure, pending request, and cancellation
- Failure shows “Update failed” and retains the open dialog and entered value.
- Save is disabled and displays Saving… while pending.
- Date input and Cancel are not separately disabled while pending.
- Cancel/dismiss without a pending save writes nothing.
- Closing during a running save does not cancel the request.
- The request uses the date captured when Save was clicked.

## Vessel Portage → Sign-off date

### Opening, defaults, and clearing
- Opens for the selected crew member.
- Loads the engagement end date, or blank when absent.
- Does not default to today or month-end.
- Reopening reloads the selected engagement value.
- Save disabled when blank or saving.
- Handler requires a selected engagement and nonblank date.
- Clearing cannot remove an existing end date.
- Request includes the selected accounting period and sign-off date.

### Server checks
1. Expected date format and a real calendar date are required.
2. Sign-off date must fall inside the requested accounting month.
3. Engagement must exist.
4. User must have vessel access.
5. Settled or cancelled engagements cannot be changed through this path.
6. End date must not precede engagement start; equality is not rejected by this comparison.
7. Engagement must not be frozen by a settlement.
8. Month containing the new end date must be editable.
9. If the old end date is in a different month, that old month is checked too.
10. An existing guarded month must be unlocked and open/vessel_draft/returned.
    An absent month record does not itself fail this month-state check.

- Old-month checking prevents moving an end date out of a closed month.
- This dedicated sign-off handler does not run the general Contract detail
  engagement-overlap check.

### Frontend access
- Edit action shown only with selected vessel/period, unlocked package,
  open/vessel_draft/returned status, and Create or Edit permission for Vessel Portage.
- Office users may also use this endpoint; it is not vessel-users-only.
- UI does not pre-check every server rule. Settlement freezing or old-month
  state can still reject a request.

### Successful save
- Updates the same engagement end-date field as Contract detail.
- Sets the manual end-date flag.
- Refreshes the engagement-review query for the selected vessel/month.
- Closes the dialog.
- Shows “Sign-off date saved” and a wage-proration message.
- Does not change the selected accounting month.

### Failure, pending request, and cancellation
- Failure shows “Could not save sign-off date” with the server message.
- Open dialog retains the entered date.
- Save disabled while saving.
- Date input and Cancel remain available.
- Cancel/dismiss does not initiate a new save or cancel an already-started request.

## Shared sign-off effects on wages and sync

- Both paths update engagement endDate and mark it manually set.
- Neither save handler itself runs the wage engine or rewrites all wage ledger lines.
- During wage calculation, service dates are bounded by engagement start/end
  dates and the accounting month.
- End date affects paid service days; existing proration and wage rules still apply.
- Vessel Portage dialog says the sign-off day is included.
- The engine supports exclude_sign_off_day and excludes that day when configured.
- Preserve the configured calculation, not an assumption based on dialog wording.
- This wording/calculation discrepancy is pre-existing and outside selector replacement scope.
- Manual end-date protection against Crewing sync must remain intact for both paths.

## Contract detail → Next step date / Seniority Anchor

### Opening and defaults
- Dialog includes Scale year at start and Next step date.
- Scale year loads its saved value, defaulting to 1 when absent.
- Date loads its saved value, or blank.
- Opening does not default the date to today or calculate a new anniversary.
- Reopening reloads saved values.

### Blank means omit, not clear
- Blank date does not disable Save.
- Nonblank date is included in the request.
- Blank date is omitted.
- Clearing an existing date and saving leaves the stored date unchanged.
- If no date was stored, omission leaves it absent.
- Request schema does not accept null for nextStepDate.
- Do not transfer Group 8 CTM blank-as-null behaviour to this field.

### Date validation
- No frontend min/max date.
- No requirement to be after engagement start.
- No rule tying it to sign-off date or accounting month.
- No past/future restriction in this save path.
- Server requires YYYY-MM-DD format when supplied.
- Format validation alone is not real-calendar-date validation; database
  constraints remain relevant.

### Related scale-year behaviour — preserve unchanged
- Number input has minimum 1.
- Saving parses with parseInt.
- If parsing produces no number, year is omitted.
- Server requires a supplied year to be an integer >= 1.
- Save button does not perform separate complete frontend validation of these values.

### Permissions and configuration
- Edit hidden when frozen or lacking Contract Edit permission.
- Edit disabled until configuration successfully loads.
- Edit enabled only when allowManualSeniorityAnchor is true.
- General update endpoint is office-only.
- Updating date or scale year is subject to settlement freezing.
- Configuration flag is checked in this UI; the audit found no corresponding
  flag check in the general server update handler.
- Preserve this boundary; do not silently introduce additional enforcement.

### Successful save and confirmation
- Updates only included anchor fields.
- Sending scale year or next step date marks seniorityAnchorConfirmed true.
- Since scale year is normally loaded, saving can confirm the anchor even
  with a blank date.
- Refreshes Contract detail and closes the dialog.
- Shows “Seniority anchor updated”.

### Wage effect
- Next step date establishes the first seniority step date.
- Further anniversaries repeat every 12 months.
- Wage engine splits calculation at relevant step dates.
- Calculated scale year increases from each step date onward.
- Without a next step date, this date-driven anniversary sequence is absent.
- Confirming the anchor removes the unconfirmed-anchor warning condition.
- Saving the dialog does not itself run a full payroll recalculation.

### Failure, pending request, and cancellation
- Failure shows “Update failed” and retains entered values.
- Save disabled while saving.
- Both inputs and Cancel remain available.
- Cancel/dismiss does not save new changes or cancel a running request.
- Reopening reloads the saved anchor.

## Differences that must not be standardized

| Behaviour | Contract Sign-off | Vessel Portage Sign-off | Next step date |
|---|---|---|---|
| Blank can complete Save | No | No | Yes |
| Clearing removes stored date | No | No | No; omitted |
| Must match accounting month | No explicit rule here | Server-enforced | No |
| Explicit before-start rejection | Not in this handler | Yes | No |
| Engagement overlap check | Yes for relevant statuses | Not in this handler | Date alone does not trigger it |
| Old/new month-state checks | Not in this handler | Yes | Not in this handler |
| Settlement freeze | Yes | Yes | Yes |
| Marks manual sign-off | Yes | Yes | No |
| Confirms seniority anchor | No | No | When anchor values sent |

“Keep both paths consistent” means preserve common end-date storage, manual-sync
protection, and wage effects while retaining entry-point-specific checks. It does
not authorize making their differing rules identical.
