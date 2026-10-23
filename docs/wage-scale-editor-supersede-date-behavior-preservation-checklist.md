# Group 6 — Wage Scale Editor and Supersede date preservation

## Authority, scope and evidence

This records the complete behaviour audit presented on 2026-10-07. The user
explicitly requested preserving every finding for later changes, while changing
nothing in the application.

The three fields belong together because revision creation and later editing
share date-boundary rules and interact with saving and activation:

1. Editor → Effective from.
2. Editor → Effective to.
3. Supersede → Revision effective from.

This is a source-code audit, not a claim that every browser interaction or live
database operation has been tested. Recheck current source before implementing.
Saving this checklist authorizes no solution, implementation, cleanup, new
validation or repair of existing inconsistencies.

## 1. Ordinary scales and revisions differ

| Situation | Effective from | Effective to |
| --- | --- | --- |
| Ordinary draft | Optional | Optional |
| Draft revision | Required, after the previous scale's boundary | Optional |
| Active | Visible but disabled | Visible but disabled |
| Superseded | Editor date controls hidden | Editor date controls hidden |

Do not treat ordinary-scale and revision date validation as interchangeable.

## 2. Editor loading, refresh and display

- Load saved dates for the selected scale; missing dates display blank.
- Neither editor date defaults to today.
- Neither comes from a selected payroll month, vessel period or other filter.
- A newly created revision loads its chosen From and a blank To.
- The editor watches both saved date values. If either changes, both local
  date fields reload from saved values.
- An ordinary rerender does not itself reset the fields.
- A refresh with identical saved date values does not itself reset them.
- A refresh with changed saved dates can replace unsaved local date edits.
- The heading displays saved dates, not unsaved field values.
- The missing-revision-From banner depends on saved From; typing alone does
  not remove it before saving.

## 3. Permissions, status and visibility

Editing requires Account Wage Scales Edit permission AND draft status.

| Status/permission | Fields | Save dates |
| --- | --- | --- |
| Draft with Edit | Editable | Available subject to dirty/saving state |
| Draft without Edit | Disabled | Hidden |
| Active with Edit | Disabled | Visible but disabled |
| Active without Edit | Disabled | Hidden |
| Superseded | Date section hidden | Hidden |

- Ordinary Save and Activate are shown only for editable drafts.
- No separate date-edit permission or payroll-period lock applies.
- The non-draft banner describes matrix values as read-only; an active scale's
  banner directs the user to Supersede from the list.

## 4. Editor Effective from

### Ordinary draft

- Optional; enter, change or clear independently.
- No browser minimum or maximum.
- To does not become a maximum for From.
- No requirement for today, future dates, a month boundary or payroll period.

### Draft revision

| Previous scale | Earliest permitted From |
| --- | --- |
| Has To | Day after To |
| Has no To but has From | Day after From |

- Previous To = 20 October → revision From >= 21 October.
- Previous From = 10 October with no To → revision From >= 11 October.
- Equality with the previous boundary is rejected.
- Exactly the next day is not mandatory; a later date is allowed.
- If the predecessor lacks From, validation rejects continuing.
- If next-day calculation fails, the editor leaves the minimum unset and
  records this error:

> The superseded wage scale's date boundary is invalid or outside the supported calendar range. Correct its effective dates before continuing.

- This error is checked during Save dates, matrix Save and activation.

## 5. Editor Effective to

- Optional for ordinary drafts and revisions.
- Can be cleared independently.
- Draft browser minimum = current From, if present.
- Clearing From removes the relationship minimum.
- No maximum, automatic month-end or maximum duration.
- Save dates rejects To before From when both are present.
- Equal dates and To after From are allowed.
- Blank To does not remove a revision's required-From rule.

## 6. One-way relationship and no automatic repair

- Changing From updates To's browser minimum.
- It does not clear, replace or move To.
- Clearing From leaves To unchanged.
- Changing or clearing To leaves From unchanged.
- Changing or blurring a date does not autosave.
- Example: From 10 October / To 20 October, then From 25 October:
  To remains unchanged; Save dates rejects the reversed range.

## 7. Save dates availability and validation priority

The editor compares both entered dates with their saved values.

Save dates is disabled when:
- Not editable.
- A date save is running.
- Both entered dates equal their saved values.

Changing a value back to its saved value removes that field's dirty difference.

Handler order:
1. Return without saving if not editable.
2. Reject reversed From/To when both are present:
   - Title: `Invalid effective dates`
   - Message: `Effective to must be on or after effective from.`
   - This takes priority over revision-boundary errors.
3. For revisions only, require:
   - Predecessor From.
   - Revision From.
   - Valid supported revision From.
   - Revision From strictly after predecessor boundary.
   - No recorded editor boundary-calculation error.
   - Failure title: `Invalid revision date`.
4. Send the date update.

Both fields are sent together: filled as date strings, blank as null.
No time-of-day or timezone conversion is added.

## 8. Shared revision validation and exact messages

The same boundary helper is used across creation, editing and activation.

| Condition | Message |
| --- | --- |
| Predecessor From missing | `Effective From date of the superseded Wage Scale is not present. Please enter an Effective From date first.` |
| Revision From missing | `Effective From is required for the new revision.` |
| Revision From invalid | `Enter a valid Effective From date for the revision.` |
| Revision From <= predecessor To, where To exists | `The revision's Effective From date must be after the superseded scale's Effective To date.` |
| No predecessor To and revision From <= predecessor From | `The revision's Effective From date must be after the superseded scale's Effective From date.` |

The helper checks these conditions in the table's order, selecting the
applicable boundary branch. In the editor, its error takes priority over the
separately recorded next-day-calculation error.

Revision From validation requires:
- YYYY-MM-DD, a real calendar date and a four-digit year.
- No year 0000; supported years effectively 0001–9999.
- Impossible calendar/leap dates rejected.
- Date shifting uses UTC calendar arithmetic.

Do not apply this strict revision validation to every ordinary-scale editor
date merely because these fields are being replaced.

## 9. Save dates lifecycle

While saving:
- Save dates disabled and displays `Saving…`.
- Fields remain editable; Back remains available.
- Matrix Save and Activate are not disabled merely by a date save.
- Request uses values captured at click time.
- Later typing does not alter the already-sent request.

Success:
1. Refresh scale detail.
2. Refresh wage-scale list.
3. Show `Effective dates saved`.
4. Remain in editor.

Saved-date refresh can reload both local fields as described above.

Failure:
- `Save failed` with returned message.
- End saving state.
- No deliberate clearing/reset of entered dates.
- Correction/retry remains possible.

Back:
- Does not save or show a custom unsaved-date confirmation.
- Returning loads saved values, not deliberate restoration of abandoned edits.

## 10. Matrix Save versus Save dates

- Save dates saves header dates.
- Ordinary Save saves wage matrix lines, not dates.
- For revisions, ordinary Save first validates entered revision From and
  predecessor boundary.
- It does NOT require valid changed dates to have already been saved.
- It does NOT run Save dates' From/To order check.
- Its enabled state depends on matrix changes, not date changes.
- Do not turn Save into "save everything" during input replacement.

## 11. Activation and unsaved dates

### Revisions

Initial activation order:
1. Validate revision dates.
2. If valid but changed from saved dates, stop:
   - `Save dates first`
   - `Save the revision's effective dates before continuing.`
3. If matrix changes exist, stop:
   - `Save first`
   - `Save your changes before activating.`
4. Run CBA minimum check.
5. Activate or show acknowledgement dialog.

Revision validation and saved-date requirement run again before the actual
activation request, including Activate anyway.

### Ordinary scales

- Revision-only Save dates first guard does not apply.
- Unsaved ordinary-scale date edits do not themselves block activation.
- Activation/CBA checks use saved dates, not unsaved editor values.
- Unsaved matrix changes still block the initial activation click.
- This difference is not authorization to standardize behaviour.

### Activation UI lifecycle

- Activate is disabled by its own activating state, not date-save state.
- Initial button shows `Checking…` while activation/checking runs.
- CBA violations open the acknowledgement dialog and reset acknowledgement.
- Activate anyway requires acknowledgement and is disabled while activating.
- Cancel closes the acknowledgement dialog without activating.
- Success refreshes detail/list, closes the floor dialog and shows
  `Wage scale activated`.
- Non-violation activation failure shows `Activation failed` with the message.
- Floor-check failure shows `Floor check failed` with the message.
- A violations response can reopen/update the acknowledgement dialog.

## 12. Server date-update restrictions and storage

Draft:
- Validate To >= From when both present.
- Partial date updates compare supplied date against the other saved date.
- Revision updates validate From against predecessor.
- Clearing revision From is rejected.
- Updating revision To also triggers revision From validation.

Active:
- Requests containing either date are rejected, even if unchanged:
  `Effective dates cannot be changed once a wage scale is active.`

Superseded:
- UI hides date controls.
- Service nevertheless allows date-only updates subject to applicable
  revision checks.
- Ordinary From/To order check is draft-only.
- Do not silently alter this UI/server difference.

Other non-draft header changes remain restricted:
`Only the effective dates can be edited once a scale is no longer a draft`
(audit metadata is allowed by the service).

- Request schema validates incoming header data.
- Both database date columns allow null and store dates without times.
- Database date-storage checks still apply.

## 13. Supersede opening and default

- Supersede shown for active scales with Edit permission.
- Missing source From blocks opening:
  - Title: `Cannot create revision`.
  - Shared missing-source-From message.
- Default = later of UTC today and earliest next-day boundary.
- Today 7 October / source To 20 October → default 21 October.
- Today 25 October / source To 20 October → default 25 October.
- Today is a default, NOT another minimum.
- Past revision From is allowed if after the source boundary.
- Fresh opening recalculates default.
- No timer updates an open dialog at midnight.

## 14. Supersede input, validation and lifecycle

Field:
- Native date input.
- Minimum = next-day boundary.
- No HTML maximum.
- Editable/clearable, with no autosave.

Create revision disabled:
- From blank.
- Creation running.

Nonblank invalid dates do not independently disable it; handler validation
still applies.

Handler order:
1. Require source row.
2. Missing From:
   - `Effective From required`
   - `The revision needs an Effective From date — without it, wage calculation can never switch to it.`
3. Shared revision validation; failure title `Invalid revision date`.
4. Send request.

While creating:
- Button shows `Creating…`.
- Date remains editable.
- Cancel and ordinary dialog-close controls remain available.
- Request uses captured date.
- Closing does not cancel an already-started request.

Success:
1. Close dialog.
2. Refresh list.
3. Show `New draft version created`.
4. Open new revision editor if identifier returned.

Failure:
- `Supersede failed` with returned message.
- No deliberate date clearing/dialog closure.

Cancel, Escape, outside click and close button do not initiate saving.
Reopening recalculates the default rather than restoring the abandoned date.

## 15. Revision creation database transaction

1. Lock and recheck source remains active.
2. Revalidate chosen From against current source dates.
3. Create draft revision with chosen From and null To.
4. Copy source's live wage lines and scope information.
5. Mark original superseded and link it to revision.

- Source eligibility is checked on the server and again in the transaction:
  `Only active scales can be superseded`.
- Server also requires From before shared validation:
  `Effective From is required for the new revision — without it, wage calculation can never switch to the revision.`
- Creating a revision does NOT close an open-ended predecessor range.
- API accepts effectiveTo, but this dialog does not supply it and current
  creation service does not use it to set either record's end date.

## 16. Activation checks and predecessor closing

Server checks:
1. Draft status.
2. At least one wage line.
3. For revisions, required From and shared boundary validation.
4. No overlapping active scale for same vessel-type/group scope.
5. CBA minimum violations absent or explicitly acknowledged.

Overlap:
- Inclusive boundaries.
- Missing dates are open-ended.
- A shared boundary day counts as overlap.
- CBA acknowledgement bypasses neither overlap nor date-boundary checks.

CBA reference:
- Saved From if present; UTC today if absent.
- Fallback is not written into saved From.

Revision activation transaction:
- Lock/recheck revision and predecessor.
- Reject revision no longer draft.
- Reject dates changed during activation:
  `The revision's effective dates changed. Please refresh and activate again.`
- Reject predecessor/link changed:
  `The superseded Wage Scale changed. Please refresh and activate again.`
- Revalidate From against current predecessor boundary.
- If predecessor To null, set it to the day before revision From.
- If predecessor already has To, preserve it.
- Activate revision.
- Do not fill a gap between existing predecessor To and later revision From.

## 17. Wage calculation connection

Revision chain switches when next revision:
- Has From.
- From <= calculation date.
- Status active or superseded, not draft.

Consequences:
- New draft revision is not yet selected as replacement.
- Activated revision eligible from From inclusive.
- Missing From prevents switching.
- Revision starts can split calculation periods into segments.
- Chain switch condition uses From, not To.
- To still matters for ordering, overlap and predecessor closing.

## 18. Existing limits, inconsistencies and layout

Native-input limitations:
- All three fields still native date inputs.
- No shared text-format parser.
- No separate unfinished-text tracking.
- No shared inline format-error row or reserved error space.
- No explicit browser checkValidity/reportValidity call.
- Partial/unfinished native input behaviour partly browser-dependent.

Misleading wording:
- Missing-revision-From banner and one server activation error suggest
  matching predecessor From to replace all periods.
- Actual shared validator rejects equality; strictly later is enforced.
- Preserve this observation; do not repair wording/rules without approval.

Malformed/out-of-range source boundaries:
- Editor catches next-day calculation failure and records its specific error.
- Supersede opening/minimum calculation lacks the same local catch.
- Invalid source boundary/no supported next day can fail differently.

Layout:
- Editor fields 32px high, fixed w-40 width, wrapping row.
- Save dates 32px high.
- Supersede input standard 36px high inside dialog.
- Labels have no required asterisks, including required revision From.
- No date-specific inline-error reservation.
- Do not copy Group 5 sizing or newly approved draft rules into Group 6.

## Preservation boundary

Preserve every distinction above:
- Ordinary scale versus revision.
- Save dates versus matrix Save.
- Entered versus saved dates.
- Revision creation versus activation.
- Browser limits versus explicit validation.
- UI restrictions versus server restrictions.
- Closing an open-ended predecessor versus preserving an existing end.

No prior group approval transfers automatically. New draft checks, year rules,
error space, sizing changes, shared-selector changes, refactors or repairs
require their own approval. This saved audit authorizes none of them.

## Source references

- client/src/modules/accounts/pages/WageScaleEditor.tsx
- client/src/modules/accounts/pages/WageScalesPage.tsx
- client/src/modules/accounts/api/accountsApiV2.ts
- client/src/modules/accounts/accountsFormat.ts
- client/src/components/ui/input.tsx
- client/src/components/ui/dialog.tsx
- shared/v2/accounts/wageScaleRevisionDates.ts
- shared/v2/accounts/types.ts
- shared/v2/accounts/schema.ts
- server/v2/accounts/controllers/wageScalesController.ts
- server/v2/accounts/services/wageScalesService.ts
- server/v2/accounts/repositories/wageScalesRepository.ts
- server/v2/accounts/engine/wageEngineService.ts
- server/v2/accounts/routes.ts
