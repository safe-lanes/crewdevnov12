# RH date fields: behaviour preservation checklist

Recorded: 2026-09-29.

## Purpose, authority and verification limits

This saves the complete behaviour analysis supplied to the user for the six
Rest Hours (RH) date fields below, including validations, dependencies, save/load
rules and already-existing issues. The user authorised saving this reference
only: no application changes, fixes, refactoring or new validation.

This is a historical, code-inspected preservation baseline, not an implementation
proposal. Recheck the actual code before implementation. Existing issues are
identified separately; recording them does not authorise fixing them or establish
them as intended business requirements.

No saved data was changed during the analysis. Browser-specific interaction and
database save/reopen results were not tested live in that analysis. Statements
about calendar deselection and request/storage handling are based on the
inspected library and application code, not an end-to-end persistence test.

## Scope

| Area | Field |
| --- | --- |
| Office Review popup | Reviewed by Office — Date |
| NC Report | Due Date |
| NC Report | Date Completed |
| NC Report | Closure Verified by Office — Date |
| Add/Edit Variable Task dialog | Start Date |
| Add/Edit Variable Task dialog | Finish Date |

These are the six active full-date fields found in RH that do not use the actual
shared date selector. Period Filter Date From and Date To already use it.
From Month and To Month exist in the reusable Period Filter but are NOT enabled
by the RH Dashboard, Records or Plan callers. They are not extra RH fields.
Time-only inputs and dates displayed as text are not additional date selectors.

## 1. Office Review — Reviewed by Office: Date

### Opening and existing values

- A new review starts blank; it does not default to today.
- An existing review loads its saved date.
- It belongs to the office review for the selected vessel and month.
- Merely opening the popup does not save or change the date.
- Closing does not explicitly reset the fields. Reopening the same review can
  retain local values until saved data reloads.
- The local value is a Date or undefined. Saved values load through new Date.
- Saved office-comment data is fetched in office mode. The load effect hydrates
  the date, or clears it when there is no record; it is not an open/close reset.
- The RH Records caller keys the dialog by vessel/month, so changing that
  selection remounts it. Closing/reopening the same keyed record does not itself
  remount it.

### Selecting the date

- Currently calendar-only, not a manual text-entry field.
- Blank placeholder: `Pick a date`.
- Selected values use the long date-fns `PPP` display, such as September 29th, 2026.
- No configured minimum, maximum, disabled-date range or month boundary.
- Past and future dates are allowed.
- It need not be inside the reviewed month.
- It is not compared with the vessel-review date or any NC date.
- Selecting it does not fill or change reviewer, position or office comments.
- Single-date calendar selection directly updates this field's local state.
- Clearing and calendar-popup behaviour are detailed in section 9.

### Save versus Submit

- Save allows a blank date and has no corresponding client required-field checks.
- Submit requires a date, reviewer name and office comments containing more than
  spaces. The date check is presence, not an explicit valid-Date check.
- Exact toast title: `Validation Error`.
- Exact message:
  `Please enter office comments and complete the signature fields before submitting`
- Save keeps the popup open and refreshes office-comment data.
- Successful Submit closes the popup and refreshes office-comment and
  vessel-record data. Failed requests leave it open.
- Submit first saves/upserts office comments and signature data, then submits the
  review in a separate request. The first can succeed while the second fails.
- Generic error fallbacks are `Failed to save office comment` and
  `Failed to submit office review`; server error messages may be used instead.

### Visibility and locking

- This field exists only in the Office Review mode of the popup, not vessel mode.
- In office mode, vessel comments are read-only independently of this date.
- RH Records omits the Office Review column for Ship users.
- For non-ship users, Due/Overdue/Completed Office Review statuses can open the
  popup; Completed opens it read-only through this normal table path.
- The popup's office-mode lock is exactly the passed Office Review status being
  `Completed`. It disables comments, reviewer selection and the date trigger,
  and hides the action-button area.
- Reviewer position is always a non-editable display.
- The popup itself does not independently check the user's Ship role or edit
  permission. The table's generic record/lock permissions do not separately gate
  this office date.
- Existing entry-point difference: the dashboard status-chart caller passes
  empty review statuses, so the same Completed-based lock is not applied there.
- Viewing NC reports from the review remains available; that does not propagate
  the review's read-only state into the NC dialog.
- No matching role/status guard was found in the traced office-comment or
  office-submit save logic. This is not a claim that all application-wide
  authentication or middleware was exhaustively audited.

### Meaning and downstream effects

- This is the reviewer-entered signature date, not the system submission date.
- Submission writes a separate server-current-time submission timestamp.
- Completion and Due/Overdue/Completed calculation use submission information,
  not this selected signature date.
- Changing the date alone does not complete the review.
- The reviewed signature date and system submission date can differ.
- In the traced status calculation, an office submission timestamp yields
  Completed; before vessel submission office status is empty; afterward the
  due/overdue calculation uses the 10th-day deadline, independently of reviewDate.

### Storage and server rules

- The date is a nullable timestamp on the office-comment record.
- Save upserts by vessel/month, updating the first matching active existing row.
- The request includes comment, reviewer name, derived position and date.
- Date objects use normal JSON timestamp serialization, not explicit date-only
  normalization.
- The service requires vessel ID and month, not a signature date.
- For truthy incoming non-Date date values, it parses the value; invalid parsed
  values become null.
- No matching server required-signature, chronological, reviewed-month or
  past/future business validation was found.
- The review-submit service itself ignores the supplied signature/date fields
  and sets submission status/time on the vessel record.
- No uniqueness constraint for the office-comment vessel/month pair was visible
  in the inspected schema.

## 2. NC Report — Due Date

### Opening and selecting

- New reports start blank; existing reports load the saved value.
- Calendar-only, with `Pick a date` when blank and `PPP` long-date display.
- No manual text input.
- No configured minimum, maximum or disabled-date range.
- Past and future dates are allowed.
- Not limited to the report month or violation dates.
- Not compared with Date Completed or office closure Date.

### Required-date rules

- Save: optional.
- Submit (Vessel): required, together with Root Cause, Corrective Action and
  Preventive Action.
- Exact toast title: `Validation Error`.
- Exact message:
  `Please fill in Root Cause, Corrective Action, Preventive Action, and Due Date before submitting.`
- The vessel path uses truthiness checks for these fields, not the Office
  Review's trimmed-comments rule.
- Submit (Office) follows a separate path and does not run this Due Date check.

### Effects

- Changing Due Date does not change Date Completed.
- It does not automatically change preventive-action status.
- Passing Due Date does not automatically mark this NC overdue or close it in
  the traced code.

## 3. NC Report — Date Completed

### Opening and selecting

- New reports start blank; existing reports load the saved value.
- Calendar-only, with the same blank placeholder and long-date display.
- No configured minimum or maximum; past and future dates are allowed.
- May be earlier than, equal to or later than Due Date: no comparison check.
- Not compared with office closure Date.

### Required-date rules

- Save allows blank, even when preventive-action status is Completed.
- Submit (Vessel) requires this date only when preventive-action status is exactly
  `Completed`.
- Otherwise it is optional for vessel submission.
- Exact toast title: `Validation Error`.
- Exact message: `Please enter Date Completed when status is Completed.`
- Submit (Office) does not run this check.

### Status changes

- Selecting Completed does not fill today's date.
- Returning to Pending does not clear an existing date.
- Selecting a date does not set the status to Completed.
- A retained date is still included in saving when status is Pending.

## 4. NC Report — Closure Verified by Office: Date

### Opening and selecting

- New reports start blank; existing reports load the saved value.
- Calendar-only, with the same blank placeholder and long-date display.
- No configured minimum or maximum; past and future dates are allowed.
- Not compared with Due Date or Date Completed.
- Need not be within the report month.
- Selecting the date does not close the NC automatically.

### Required-date and submission rules

- Save: optional.
- Submit (Vessel): not required.
- Submit (Office) is enabled only when all of these are present:
  - Office verifier Name.
  - The selected verifier's derived Position.
  - Office closure Date.
  - Preventive-action status exactly `Completed`.
- Exact disabled-button tooltip:
  `Please fill in Name, Position, and Date in Closure Verified by Office section`
- The tooltip does not mention the additional Completed-status requirement.
- These are button-enabling conditions, not a separate validation routine called
  by the office-submit handler.
- Office submission is available from draft or vessel-submitted status.
- Prior vessel submission is not required.
- Office submission does not rerun the vessel checks for Root Cause, Corrective
  Action, Preventive Action, Due Date or Date Completed.
- Therefore a draft can be office-submitted/closed without Due Date or Date
  Completed if the four office conditions above are met. This is existing
  behaviour, not a proposed rule.

## 5. Rules shared by all three NC dates

### Roles and locking

- All three dates share the same lock: submission status exactly
  `office-submitted`.
- This disables the date triggers and other editable report fields and hides
  action buttons.
- Exact lock message:
  `This report has been submitted by office and is locked.`
- Vessel submission does not lock the dates.
- General NC status `Closed` alone is not the disabling condition.
- Surrounding RH record, vessel or review locks are not passed into this dialog.
- Ship users do not see Submit (Office).
- Office closure fields are not independently read-only just because the user is
  a Ship user.
- Verifier Position is always a non-editable display.
- No corresponding role/transition/date-required enforcement was found in the
  traced NC server save path.

### Save and status transitions

- Save has no submission-required checks.
- Save always writes `draft` / `Open`.
- Saving a vessel-submitted report therefore returns it to draft/Open.
- Submit (Vessel) writes `vessel-submitted` / `Open`.
- Submit (Office) writes `office-submitted` / `Closed`.
- Save/Submit success refreshes NC queries and updates local status, but keeps
  the popup open.
- Action buttons are disabled while the request is pending; the date triggers
  themselves use the read-only status rule, not that pending flag.
- Failure message: `Failed to save NC report. Please try again.`
- Success messages distinguish saved, submitted by vessel and submitted by
  office.

### Loading, resetting and entry points

- The same implementation is used from crew records, NC overview, vessel NC list
  and the vessel/office review popup; these are not separate date definitions.
- Existing values are reconstructed with new Date, without date-only
  normalization.
- A new report resets all three dates to undefined, preventive status to Pending
  and general status to Open.
- The reset/load effect follows existing-report data, not a dedicated close
  reset. The query is enabled when the popup is open and a crew ID exists.
- Most callers key the dialog by crew/vessel/month, recreating it on selection
  changes. The vessel NC list does not provide the same key.
- Closing does not explicitly clear the fields; same-record reopening and
  switching records depend on query reloads and the caller's remount behaviour.
- Existing loading issue: lookup fetches all reports and takes the first matching
  crew member, without also matching vessel/month. Multiple reports for that
  crew can lead to loading the wrong report.

### Storage, validation and downstream behaviour

- All three columns are nullable timestamps, not date-only strings.
- Save sends all three Date/undefined values alongside the other report fields.
- Existing reports are updated by UUID; otherwise a new report is created.
- Normal JSON serialization produces timestamp text for Date values.
- Server conversion applies only to present, non-null date fields.
- There is no matching server required-date, chronological, past/future or
  report-month validation; create requires vessel and crew IDs.
- The server date conversion does not explicitly reject an invalid parsed Date.
  Storage/runtime failures are not equivalent to a business validation rule.
- The generated insert schema adds no custom business-date checks and is not a
  substitute for checks absent from the actual controller/service path.
- Overview/list status derives from report status/submission status, not these
  three dates.
- No date-driven due/overdue calculation, automatic completion, closure,
  compliance recalculation or aggregation using these three values was found in
  the traced consumers.
- Violation dates come from actual daily records and are independent of these
  three form dates.

## 6. Variable Task — Start Date

### New and existing tasks

- New task starts blank, not today or the first day of the selected month.
- Edit loads from the saved start date/time display text.
- Start Time loads separately from that same text.
- Start Date and Start Time are separate form fields.
- Add/Edit reset follows the selected edit record; closing alone is not an
  explicit reset.

### Entry and validation

- Native browser date input; calendar/keyboard behaviour depends on the browser.
- It can be cleared during editing.
- Both Save (Draft) and Submit require it.
- Exact message: `Start date is required`.
- Start Time is also required: `Start time is required`.
- The form schema checks nonempty strings, not full date shape/correctness.
- No configured minimum or maximum; past and future dates are allowed.
- It need not be in the selected RH month.
- No check requires Start Date to be on or before Finish Date.

### Effects of changing it

- Does not automatically change Finish Date or either time.
- Changes eligible crew.
- Changes the historical-rank lookup date.
- On saving, Start Date determines the task's saved month.
- A move to another month can remove the task from the current filtered list.
- Cross-month message:
  `Task saved under [month and year]. Switch the period filter to view it.`
- That message is shown for a differing, normally formatted year-month after
  save succeeds.

## 7. Variable Task — Finish Date

### New and existing tasks

- New task starts blank, not copied from Start Date.
- Edit loads from the saved finish date/time display text.
- Finish Time remains separate.

### Entry and validation

- Native browser date input; it can be cleared while editing.
- Required for both Save (Draft) and Submit.
- Exact message: `Finish date is required`.
- Finish Time is also required: `Finish time is required`.
- The form schema checks nonempty strings, not full date shape/correctness.
- No configured minimum or maximum; past and future dates are allowed.
- Not restricted to the selected RH month.
- It may be in a different month from Start Date.
- No check rejects a finish date earlier than the start date.
- Equal dates are allowed.
- No check rejects an earlier finish time on the same day or equal timestamps.

### Effects of changing it

- Does not automatically move Start Date or change either time.
- Changes eligible crew.
- Does not determine the saved month; Start Date does.

## 8. Rules shared by both Variable Task dates

### Permissions, statuses and other controls

- Add/Edit access uses the existing Rest Hours Plan permissions.
- Add requires a selected vessel and period.
- Once open, the date inputs have no separate read-only/disabled rule.
- Planned versus Completed does not lock the dates.
- Task versus Port Call does not lock, fill or clear them.
- Changing dates does not automatically change times, status, record type, task
  selections, crew-group selections or comments.
- Task/Port Call switching hides/shows task controls rather than clearing saved
  task selections; this must not be confused with a date side effect.

### Crew eligibility

- Initially restrict to the selected vessel and OnBoard assignments.
- Also require overlap with the currently selected RH month:
  - Exclude sign-on after its last day.
  - Exclude sign-off before its first day.
  - Equality at month boundaries is allowed.
- Further restrict using task dates when either date is entered:
  - Exclude sign-on after Finish Date, when both values exist.
  - Exclude sign-off before Start Date, when both values exist.
  - Equality at either boundary is allowed.
- Missing sign-on/sign-off does not itself exclude under that comparison.
- These are string comparisons relying on normal ISO date strings.
- Recalculate eligibility when either task date, selected vessel/month or source
  crew list changes.
- Date changes do not explicitly prune already-selected crew IDs/groups.
- Saving rebuilds crew details from the currently eligible, categorised crew;
  previously selected but now-ineligible crew can disappear from saved details.
- Start Date supplies the historical-rank lookup date.
- Finish Date can also change the rank-query roster by changing eligible crew,
  but it is not the historical-rank date.
- Crew department categorisation uses current rank designation; displayed/stored
  historical rank is resolved as of task start.
- No required-crew/task or overlap-conflict blocking validation was found in this
  form's date-save path.

### Time inputs remain separate

- Date edits do not change time values.
- Time inputs are text fields, maximum five characters, permitting digits/colon.
- Valid form is HH:MM from 00:00 to 23:59.
- Invalid nonblank time is cleared on blur; missing time then meets the required
  validation rule.
- The save schema itself checks nonempty time strings, not that regular
  expression; the formatting check is in the time input's blur handling.
- Existing time text loads from the part after ` / ` without separate validation
  during reset.
- No new time behaviour is authorised by a date-selector replacement.

### Saving, publishing and reopening

- Save (Draft) and Submit invoke the same form resolver and required date/time
  checks; draft is not an exemption.
- Save (Draft) sends isDraft true; Submit sends false through the normal save
  path.
- Form calls the parent save handler then closes immediately, without awaiting
  the server result.
- Separate Publish Draft bypasses the form and its date/time checks.
- Publish checks that the task is a draft; its specific rejection is
  `Task is not a draft`.
- Edit parses the saved display text split at ` / `, not the sortable text.
- Ordinary successful create/update refreshes task and related RH record queries.

### Stored values and server boundaries

- Display text: e.g. `29-Sep-2026 / 08:00`.
- Sortable text: e.g. `2026-09-29T08:00:00`, with no timezone offset.
- Both start and finish versions are stored as text.
- The payload does not store the two form date fields independently.
- Start Date supplies periodValue; selected period is the fallback.
- Crew detail/count, rank snapshots and isDraft are saved alongside these values.
- The date/time text columns are NOT NULL, but that is not a calendar-validity or
  nonempty-string business check.
- The create service requires vessel and period, with exact messages
  `Vessel ID is required` and `Period value is required`.
- The traced save path does not repeat form required-date/time checks or enforce
  chronological order. Update accepts partial fields.
- Legacy migration backfilled missing date/time text with empty strings.
  Such rows can load blank and then be blocked by the form's required checks
  when edited.

### RH calculations and task coverage

- Date/time range determines coverage in RH recording for selected crew.
- Draft tasks are excluded from overlays/conflict calculations.
- Multi-day tasks cover intervening days; no recurrence feature is involved.
- Coverage is calculated in half-hour blocks, through the finish block boundary
  rather than including an extra finish block.
- Finish-before-start ranges are not blocked at save but can produce no later
  coverage. Invalid/empty parsed ranges may be ignored.
- Assignment to crew uses saved crew details, not an independent task-assignment
  date field.
- Server save resolves/stamps crew ranks using task start information.
- Create/update/delete/publish trigger asynchronous conflict recalculation.
- If update changes vessel/month, both new and original vessel/month are
  recalculated.
- Existing daily recorded activities are not rewritten by date edits.
- Conflict handling excludes drafts and date-line duplicate rows; task coverage
  over a daily-record cell other than activity code `a` is flagged.
- Recalculation errors are caught/logged independently of saving, so a save may
  succeed while downstream conflict flags remain stale.
- Retrieval by selected vessel/month plus start-derived saved month means
  cross-month display/coverage should not be assumed to appear automatically in
  every touched month.

## 9. Calendar clearing, storage and already-existing issues

### A. Clearing the four popup-calendar dates

Applies to Office Review Date and all three NC dates.

- There is no dedicated Clear button.
- Installed single-selection calendar behaviour without required allows
  clicking the selected day again to set local selection to undefined.
- Selection has no explicit popup-close handler.
- No explicit displayed month/default month is passed. Navigation/focus is
  library-managed and is not constrained to the reviewed/report month.
- There are no manual-text parsing/error rules in these existing controls.
- Changing the local selection does not save automatically.

Important persistence distinction:

- Undefined date properties are omitted by JSON serialization.
- On existing-record updates/upserts, omitted dates are not overwritten, so a
  visually cleared field can leave its old timestamp stored.
- Refetch/reload can bring that old date back.
- For a new record, omission can leave the nullable date empty where the chosen
  action allows a blank date.
- Explicit null would be sent and could clear storage, but these calendar
  setters currently produce undefined, not null.
- Submission-required checks still apply. In particular, clearing Office Review
  Date prevents normal UI Submit; do not describe Submit as bypassing that check.
- NC requiredness varies by action, as recorded above.

This is an existing clearing/save issue, not authority to change blank handling.

### B. Date storage and timezone risks

- Office Review/NC dates are Date objects serialized as timestamp strings,
  stored as timestamps and reconstructed with new Date for local display.
- They are not consistently treated as timezone-free date-only strings.
- No explicit vessel-timezone or date-only normalization policy was found.
- Preserve existing values; do not silently move a saved calendar date.
- Variable Task inputs initially hold timezone-free YYYY-MM-DD strings, but the
  display formatter uses new Date(dateString) and local getters.
- Date-only ISO parsing can therefore yield a previous-day display in
  negative-offset timezones.
- Display text can disagree with sortable text, which uses the raw input string.
- Downstream task parsers use local calendar dates rather than a vessel-timezone
  conversion policy.
- These are existing risks, not permission to introduce conversions or fixes.

### C. Unusual/malformed saved values and year limits

- Popup date loading has no explicit safe rule for every malformed timestamp;
  invalid Date values can reach formatting.
- Office service converts certain invalid incoming date strings to null; NC
  service does not perform the equivalent explicit validity check.
- Variable Task editing expects DD-Mmm-YYYY / HH:MM display text.
- ISO, alternate legacy or malformed display text may load incorrectly or blank
  even where downstream overlay parsers support additional legacy formats.
- Unrecognised month abbreviations can fall back to January in edit parsing.
- Edit parsing is string-based, pads the day, and does not fully validate actual
  calendar correctness or unusual years.
- Invalid display-date parsing may produce NaN/undefined text without throwing;
  a catch block alone does not guarantee safe validation.
- Year output is not consistently zero-padded or normalised.
- No explicit shared-selector-style 0001–9999 cap is currently configured for
  these six controls. Browser/library-supported ranges are not the same as a
  declared application business rule.
- No silently corrected legacy value, new year restriction or changed
  save/reopen rule has been approved.

### D. Existing differences must remain separate from intended rules

- Office Review table and dashboard callers do not apply Completed locking in
  the same way.
- Office Review Save permits incomplete signatures; Submit requires them in the
  UI but the server has no matching signature validation.
- Two-step Office Review submission can leave saved signature data even when
  the subsequent status submission fails.
- NC office submission does not run vessel submission checks.
- NC Save returns a vessel-submitted report to draft/Open.
- NC lookup may select another report for the same crew member.
- Popup date clearing may not clear storage.
- Variable Task draft save still requires both dates and times.
- Variable Task Publish does not rerun form checks.
- Variable Task accepts reversed ranges, while downstream coverage may be empty.
- Date-based crew filtering can drop previously selected crew from saved details.
- Variable Task display formatting has timezone and malformed-value risks.
- Server date checks are not equivalent to the forms' UI checks.
- These findings are recorded for awareness. A selector replacement must not
  silently fix them, unify distinct workflows, add new mandatory dates, impose
  future-date bans/order checks, change permissions or modify unrelated logic.

## 10. Required-field summary

| Field | Save / Save Draft | Submit |
| --- | --- | --- |
| Office Review Date | Optional | Required for Office Review Submit |
| NC Due Date | Optional | Required for Submit (Vessel); not checked by Submit (Office) |
| NC Date Completed | Optional | Required for Submit (Vessel) only when preventive status is Completed |
| NC office closure Date | Optional | Required to enable Submit (Office) |
| Variable Task Start Date | Required | Required |
| Variable Task Finish Date | Required | Required |

## Source pointers from the analysis

- `client/src/modules/rest-hours/components/VesselReviewDialog.tsx`
- `client/src/modules/rest-hours/components/RHRecordsTable.tsx`
- `client/src/modules/rest-hours/components/VesselStatusChart.tsx`
- `client/src/modules/rest-hours/components/NCReportDialog.tsx`
- `client/src/modules/rest-hours/components/RHCrewRecordsTable.tsx`
- `client/src/modules/rest-hours/components/NCOverviewDialog.tsx`
- `client/src/modules/rest-hours/components/VesselNCsDialog.tsx`
- `client/src/modules/rest-hours/components/VariableTaskForm.tsx`
- `client/src/modules/rest-hours/components/VariableTasksTable.tsx`
- `client/src/modules/rest-hours/components/RHRecordingForm.tsx`
- `client/src/modules/rest-hours/api/restHoursApiV2.ts`
- `client/src/components/ui/calendar.tsx`
- `client/src/components/filters/PeriodFilter.tsx`
- `client/src/lib/queryClient.ts`
- `server/v2/rest-hours/routes.ts`
- `server/v2/rest-hours/services/officeCommentsService.ts`
- `server/v2/rest-hours/services/vesselRecordsService.ts`
- `server/v2/rest-hours/services/ncReportsService.ts`
- `server/v2/rest-hours/services/variableTasksService.ts`
- `server/v2/rest-hours/repositories/officeCommentsRepository.ts`
- `server/v2/rest-hours/repositories/ncReportsRepository.ts`
- `server/v2/rest-hours/repositories/variableTasksRepository.ts`
- `server/v2/rest-hours/controllers/commentsController.ts`
- `server/v2/rest-hours/controllers/ncReportsController.ts`
- `server/v2/rest-hours/controllers/variableTasksController.ts`
- `server/v2/rest-hours/utils/reviewStatusUtils.ts`
- `server/v2/rest-hours/utils/activityConflictHelpers.ts`
- `shared/v2/rest-hours/schema.ts`
- `shared/v2/rest-hours/types.ts`
- `migrations/0084_align_variable_tasks_v2_with_v1.sql`

## Status

Reference saved only. No shared-selector implementation, application behaviour
change, existing-issue repair, schema change or new validation is authorised by
this document.