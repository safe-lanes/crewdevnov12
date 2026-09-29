# Appraisal date fields: existing behavior preservation checklist

Recorded: 2026-09-28.

Reconfirmed by the user on 2026-09-29 from the uploaded checklist:
`attached_assets/Pasted-Below-is-the-preservation-checklist-No-changes-have-bee_1790657171291.txt`.
The original uploaded text is retained unchanged. All seven sections of that
checklist are covered below. Preserve this historical behavior baseline during
the correction to use the actual shared date selector; do not treat descriptions
of the earlier native controls as claims about the current implementation.
This confirmation authorizes saving the reference only, not application changes.

## Purpose and status

This preserves the complete analysis checklist requested by the user for later
design and verification. It is a project reference document, not an agent-memory
entry, implementation plan, proposed solution, or authorization to change code.
The findings describe the code inspected during the analysis. Recheck the current
code before implementation; this document must not override later code evidence.

User requirement: include all four fields in the future shared date-selector
work, including read-only Sign On Date, while preserving existing behavior,
rules, validations, permissions, loading and saving.

## Scope and source locations

- Vessel and Appraisals open the same runtime form:
  `client/src/modules/crewing/AppraisalForm_v2.tsx`.
- Vessel entry: `client/src/modules/vessel/VesselModule_v2.tsx`.
- Appraisals entry: `client/src/modules/crewing/ElementCrewAppraisals_v2.tsx`.
- Active Part A controls:
  `client/src/components/appraisal-form-parts/PartA.tsx`.
- Active G2 control:
  `client/src/components/appraisal-form-parts/PartG.tsx`.
- Old inline Part A markup behind `false &&` is not the active implementation.
  The old `officeReview` branch is not the canonical active Part G route.
  Do not infer active behavior from those copies.
- Admin uses a separate editor (`client/src/components/FormEditor.tsx`,
  `client/src/components/FormEditorFactory.tsx`, and `form-editor-parts`).
  Its preview controls are not the runtime appraisal controls.
- The active editable date fields are Period From, Period To, and the per-row
  G2 Target or Compl. Date. Sign On is an additional read-only date field.
  Display dates and list filters are separate from these four fields.

## 1. Sign On Date — Part A

- Always read-only, including new and Draft appraisals.
- Users cannot type, clear, or select a different date.
- Skipped by Tab navigation (`tabIndex=-1`).
- Retains its grey, non-editable appearance.
- New appraisal value comes from the selected crew member's sign-on information.
- Existing appraisal value comes from saved appraisal information.
- Can remain blank if no value is available; no required-date validation.
- Opening or displaying the field must not replace its value with today or
  overwrite the saved date.
- Supplies the minimum date for Appraisal Period From.
- Also feeds the existing automatic training lookup before Stage 2: the lookup
  uses the 12 months ending on the sign-on date. Date presentation must not
  change this calculation.
- A shared-control appearance must not make its calendar button usable.

## 2. Appraisal Period From — Part A

### Initial value and editing

- New appraisal initially uses the crew member's Sign On Date.
- New-form prefill fills an empty value, without overwriting an entered value.
- Reopened appraisals use the saved value.
- Editable when Part A is unlocked.
- Can be cleared.
- Optional, including in the Part A stage-validation schema.

### Limits and dependent-field behavior

- Calendar minimum is Sign On Date.
- Equal to Sign On Date is allowed.
- No sign-on minimum is applied when Sign On Date is blank.
- No maximum date and no future-date prohibition.
- The current minimum is a browser/native constraint; there is no separate
  custom From change-handler rejection or server comparison against Sign On.
- Changing From updates the minimum for To.
- Changing From does not automatically clear, replace, or move an existing To
  value, even if the new minimum makes that value earlier than From.

## 3. Appraisal Period To — Part A

### Initial value and editing

- Blank for a new appraisal.
- Saved value used on reopening.
- Editable when Part A is unlocked.
- Can be cleared during editing.
- Keeps its required-field mark.

### Date limits

- Minimum is Appraisal Period From.
- Equal to From is allowed.
- When both dates exist, the change handler rejects an attempted To value
  earlier than From without forwarding that attempted change to the form.
- No comparison is applied when From is blank.
- No maximum date and no future-date prohibition.
- Compared directly with From, not separately with Sign On.

### Required-date validation

- Required by the Part A stage-validation schema.
- Exact existing message: `Appraisal Period To date is required`.
- Applies during Stage 1 validation, including the existing combined submission
  path that also performs Stage 1 validation.
- Save Draft does not require this date.
- Existing hidden-field exemptions from stage validation remain unchanged.

## 4. Target or Compl. Date — G2 Training Followup

### Row ownership and initialization

- Each row owns its own date; an edit updates only the matching row.
- Saved appraisal dates load into their associated rows.
- Configuration-provided dates are preserved.
- New manual and database-selected training rows start with blank dates.
- Adding/deleting rows and navigating sections must not mix up row dates.

### Optionality and limits

- Optional, including at Stage 3 submission.
- Can be cleared.
- No configured minimum or maximum.
- Past and future dates allowed.
- No comparison with Sign On, From, or To.
- Completed status does not automatically fill the date or make it mandatory.
- Other status selections do not automatically clear or change the date.
- Database-selected training names can be read-only while their row dates remain
  editable when G2 is unlocked.

### Interaction with row validation

- Save preparation removes a completely empty G2 row.
- Blank-row detection checks training, database reference, category, status,
  target date, and comment.
- A row containing a date is not empty.
- Entering only a date therefore retains a row that still needs a training name.
- Draft save and Stage 3 retain the exact message:
  `Training name is required in Part G2`.
- This is a training-name requirement, not a date requirement.

## 5. Section locks, roles, and status

Part A and G2 have different locking rules; do not unify them.

| Area | Existing rule |
| --- | --- |
| Sign On | Always read-only |
| Part A From/To before Stage 2 | Not locked by the Part A stage-lock rule |
| Part A From/To after Stage 2 or Stage 3 | Locked only when appraisal Lock Form is ON |
| Part A with Lock Form OFF | Stage progression alone does not lock From/To |
| G2 for Ship users | Locked, with `For Office use only` |
| G2 after Stage 3 | Locked regardless of Part A Lock Form setting |

- Stage 2-or-later states: `submitted`, `stage2_submitted`, `pending_review`,
  `reviewed`, `stage3_submitted`.
- Stage 3-or-later states: `reviewed`, `stage3_submitted`.
- Before Stage 2, Part A uses the form configuration's Lock Form setting.
- After Stage 2, it uses the saved appraisal's lock-setting snapshot.
- Typing and calendar selection must both respect locks.
- Existing disabling is inherited from section fieldsets; individual date inputs
  do not all have their own disabled prop.
- Keep existing section-view permissions and section visibility behavior.
- Do not infer unconditional Part A Stage 3 locking from older comments; the
  active Part A expression still requires Lock Form to be ON.

## 6. Loading, saving, configuration, and shared behavior

- Both Vessel and Appraisals entry points must retain the same runtime behavior.
- Keep existing section permissions and visibility rules.
- Keep Admin configuration and pinned form-version handling unchanged.
- Runtime date-control presentation is separate from Admin's preview controls.
  A runtime presentation change alone does not require a new configuration
  version or Admin preview change.
- Retain entered dates when switching sections.
- Opening, displaying, saving, and reopening must not change existing dates
  merely as a side effect of presentation.
- Values are date strings, normally `YYYY-MM-DD`, not timestamps.
- Do not introduce timezone conversion or move dates by one day.
- Keep empty-value compatibility: ordinary save paths store blank dates as
  null; G2 reload converts its empty stored date back to an empty field.
- Preserve existing load-path handling of null/empty values rather than assuming
  every header and stage endpoint normalizes them identically.
- Stage 1 sends the Part A dates.
- Stage 2 and Stage 3 do not independently rewrite those header dates.
- G2 dates remain attached to their training-followup rows in saving.
- Retain Save Draft's existing validation and workflow-status behavior.
- Preserve existing saved/configuration values rather than silently correcting
  them when mounting a new date control.

## 7. Validation boundaries and native-input behavior

- The server currently does not independently enforce date format, chronological
  ordering, or min/max limits for these four fields.
- Relevant restrictions are in native browser controls and client form logic.
- Current controls use native date-entry behavior, not the shared selector's
  custom invalid-text draft handling.
- Browser-managed editing, blank values, and uncommitted/invalid entry behavior
  need explicit consideration during later design; this analysis does not claim
  that native browser cancellation behavior was experimentally characterized.
- Do not silently add mandatory dates, future-date restrictions, automatic
  corrections, Save Draft blockers, or usable calendars on locked/read-only
  fields.
- The user accepted a cancellation limitation for Promotions previously. That
  does not by itself establish an accepted Appraisals behavior change.

## Preservation checklist status

This is a recorded analysis baseline only. No date selector has been changed,
no implementation approach has been selected here, and no new validation rule
is proposed by this document.