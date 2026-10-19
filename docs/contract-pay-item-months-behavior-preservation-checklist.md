# Contract pay-item months — Group 11 preservation checklist

## Scope, authority, and evidence

The user explicitly requested saving every finding from the Group 11 audit for
preservation before later changes.

- Keep Effective from (month) and Effective to (month) together.
- Scope is Contract detail → Contract Pay Items → Add/Edit pay item, including
  clearing, conversions, server validation, locks, removal, and wage effects.
- This is a preservation baseline, not a solution or implementation authorization.
- Preserve every behaviour unless a required departure is explicitly approved.
- Do not alter the shared date/month selector. If requirements cannot be met
  without changing it, stop and ask the user first.
- Do not change unrelated code or repair existing inconsistencies.
- Group 9 and Group 10 approvals do not automatically apply here.
- Findings are code-based. Isolated checks exercised the existing date conversion
  helper; live saves, locked-month scenarios, payroll recalculation, and exhaustive
  native-browser input behaviour were not tested.
- No application code or financial records were changed during the audit.
- Recheck current source before proposing changes; this records the audited
  baseline rather than guaranteeing future code remains identical.

## 1. Location and independence

- Fields are Effective from (month) and Effective to (month) in the same pay-item
  Add/Edit dialog.
- Values belong to the individual pay item.
- They are not connected to the shared Accounts Period filter.
- Editing them does not change Fleet Summary, Payroll Run, Vessel Portage, or
  another screen's selected month.
- Both remain available in Add element, Replace scale value, and Suppress element modes.
- Changing pay element or mode does not automatically clear or recalculate the months.

## 2. Add defaults

- Both month fields start blank.
- Neither defaults to today, shared Accounts month, engagement start month, or
  engagement end month.
- Other new-item defaults: no pay element selected, Add element mode, blank
  amount, rate, and remarks.
- Opening Add again starts a fresh form.

## 3. Edit defaults and normalization

- Existing dates are reduced to their first seven characters, e.g.
  2026-10-15 becomes 2026-10.
- Existing From fills From month; existing To fills To month.
- Missing dates appear blank.
- Reopening Edit reloads saved item values, not an abandoned draft.
- Original day is not retained when a nonblank month is saved.
- Example: saved From 15-Oct-2026 displays October and saves as 01-Oct-2026.
- Example: saved To 15-Nov-2026 displays November and saves as 30-Nov-2026.
- Consequently, editing another property and saving can normalize previously
  stored mid-month dates to whole-month boundaries.
- This is existing behaviour, not permission to silently preserve old days or
  otherwise change normalization during replacement.

## 4. Optional blanks and clearing

Both fields are optional:

| From | To | Intended window |
|---|---|---|
| Blank | Blank | Whole contract |
| Selected | Blank | Selected month onward, within contract |
| Blank | Selected | Contract start through selected end month |
| Selected | Selected | Selected months, subject to validation |

- Blank From sends effectiveFrom: null.
- Blank To sends effectiveTo: null.
- These are explicit nulls, not omitted properties.
- Clearing an existing From removes its saved lower date limit.
- Clearing an existing To removes its saved upper date limit.
- Clearing both removes both explicit limits.
- Engagement dates are not substituted into the stored payload for blank fields.
  Their meaning is applied by later calculations/checks.
- This differs from Group 9 Next step date, where blank omits the update.
- Do not transfer Group 10's restore-on-leaving behaviour: clearing these fields
  is intentional and meaningful.

## 5. Month-to-date conversion

- Nonblank From receives -01: 2026-10 becomes 2026-10-01.
- Nonblank To uses the existing UTC-based month-end helper.
- Examples checked against that helper:
  - 2026-04 → 2026-04-30.
  - 2026-10 → 2026-10-31.
  - 2024-02 → 2024-02-29.
  - 2025-02 → 2025-02-28.
- Payloads are date-only strings, not timestamps.
- No user-timezone conversion of saved dates.
- Conversion occurs while Save constructs the payload.
- Editor does not support selecting a specific day.
- Existing help text: “Leave blank for the whole contract. Windows are whole
  months — mid-month changes are not yet supported.”

## 6. Native input behaviour and limits

- Both controls are browser-native month inputs.
- Browser controls visible format, picker, and keyboard editing.
- No custom draft tracking.
- No adjacent custom validation message.
- No custom blur validation.
- No custom field-specific Enter/Escape handling.
- Neither field has min, max, or required.
- No explicit frontend year limit.
- Neither is automatically bounded by the other month or engagement dates.
- Change handlers accept empty values into form state, unlike Fleet Summary.
- If native clearing/incomplete editing reports an empty value, the form receives
  it. Exact native editing behaviour depends on the browser.

## 7. Frontend Save and other payload fields

Save button is disabled when:
1. A save is pending.
2. No pay element is selected.
3. Mode is not Suppress element and both amount and rate are blank.

- Months are not part of the button's disabled condition.
- No frontend validation of From > To, engagement bounds, locked months,
  past/future months, or existence of wages.
- Save handler itself stops when form or selected pay element is absent.
- Remaining business validation happens on the server.
- Suppress element sends null amount and rate.
- Otherwise blank amount/rate becomes null.
- Blank remarks becomes null.
- Both effective-date properties are sent on Add and Edit.

## 8. Server date-pair validation

### Request schema
- API permits each date to be absent or null.
- A supplied string must match YYYY-MM-DD with four year digits.
- Format regex alone is not full real-calendar-date validation.
- API does not require first/last-day boundaries; frontend does that conversion.
- No added explicit past/future rule.
- Database date-column constraints still apply.

### Ordering and engagement bounds
- When both dates are supplied, From must be on or before To.
- Equal dates are not rejected by the ordering check.
- Selecting the same month yields first day through last day and is not
  rejected merely because it is a single-month window.
- When engagement start exists, neither supplied date may precede it.
- When engagement end exists, neither supplied date may exceed it.
- Checks compare converted full dates, not only months.

### First/last engagement month consequences
- Engagement starting 15-Oct-2026: selecting From October sends 01-Oct-2026
  and is rejected as before engagement start.
- Leaving From blank avoids that explicit earlier boundary.
- Engagement ending 15-Nov-2026: selecting To November sends 30-Nov-2026
  and is rejected as after engagement end.
- Leaving To blank leaves the upper limit implicit.
- These are existing rules, not issues to silently repair.

## 9. Add versus Edit server paths

Add checks engagement existence, settlement freeze, payload validity, and the
effective window's locked-month status.

Edit:
- Loads the existing item and engagement.
- Merges supplied properties with existing values.
- Validates the resulting pair.
- Checks the resulting window for locked months.
- API-level omission retains a date; this UI explicitly sends both dates, so
  clearing replaces the stored date with null.
- Locked-window validation uses the resulting window, not a separate old-and-new
  window check like the dedicated Group 9 Vessel Sign-off path.
- No duplicate/overlapping-pay-item rejection was found in these create/update
  validation handlers.

## 10. Locked-month check

- Lower bound is explicit From, otherwise engagement start.
- Upper bound is explicit To, otherwise engagement end.
- Reject when every covered month is locked.
- At least one month not locked means this particular check does not reject.
- Absent matching locked record is not counted as locked.
- A record is locked when its lock flag is set OR its status is locked.
- Deleted month records are excluded.
- If no resulting end date exists, check allows the window because it reaches
  future open months.
- Check returns without testing the window if required engagement context is
  missing.
- Month enumeration has an existing 1,200-month safety cap.
- Preserve these existing boundaries without broadening or repairing the rule.

## 11. Permissions and settlement freeze

- Add, Edit, and Remove actions hidden when contract is read-only.
- Read-only includes lacking Account Contracts Edit permission or being frozen.
- Create/update/delete APIs are office-only.
- A non-deleted submitted, approved, paid, or locked settlement freezes edits.
- Server rechecks freezing during the operation; an open dialog does not
  guarantee a subsequent save will remain allowed.

## 12. Save lifecycle and cancellation

### Success
- Add creates; Edit updates the existing item.
- Refreshes Contract detail.
- Closes dialog.
- Toast: “Contract pay item saved”.

### Failure
- Toast: “Save failed” with error details.
- Does not deliberately close an open dialog.
- Retains entered values for correction.
- Does not automatically restore previous months.

### Pending
- Save disabled and displays Saving…
- Month inputs are not separately disabled.
- Cancel remains available.
- Request uses values captured when Save began.

### Cancel/dismiss
- Without pending request, discards unsaved form.
- Reopening uses fresh Add defaults or saved Edit values.
- Closing does not cancel an already-running request.

## 13. Saved table display

- Nonblank dates display as formatted full dates, not month-only values.
- Blank From displays “contract start”.
- Blank To displays “open”.
- Blank To displays “open” even if engagement has an end date.

## 14. Wage effects

- Engine tests override overlap with calculation segments.
- Missing From imposes no explicit lower limit from this override.
- Missing To imposes no explicit upper limit from this override.
- Boundary comparisons are inclusive.
- Applicable item follows its existing Add element / Replace scale value /
  Suppress element behaviour.
- Save itself neither runs payroll nor rewrites existing wage ledger lines.
- Effects are used by subsequent calculation.
- Pay-item dates are checked against calculation segments; they are not
  themselves added as new mid-month segment boundaries.
- Whole-month conversion therefore matters.
- Do not change engine behaviour for older mid-month records in this scope.

## 15. Removal

- Separate removal confirmation, with no month editor.
- Stored window still matters to server checks.
- Server checks settlement freeze and existing item's locked window.
- Removal is a soft delete.
- Success refreshes Contract detail and shows “Contract pay item removed”.
- Removal does not immediately recalculate payroll.
- Confirmation explains that open months revert to the wage scale on the next
  calculation run.

## Preservation priorities

1. Keep the pair together.
2. Preserve optional blanks and explicit null clearing.
3. Preserve month-start/month-end conversion.
4. Preserve normalization of stored mid-month dates during Edit.
5. Preserve engagement bounds and first/last-month consequences.
6. Preserve Save conditions, failures, pending state, and cancellation.
7. Preserve settlement freezing and the entirely-locked-window rule.
8. Keep the pair independent of shared Accounts Period.
9. Do not carry over other groups' approvals.
10. Do not change calculations or repair existing inconsistencies.

Saving this checklist authorizes no solution or application changes.
