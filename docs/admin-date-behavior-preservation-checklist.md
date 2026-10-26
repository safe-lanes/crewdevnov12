# Admin date behavior preservation checklist

Audit date: 2026-09-28.

## Purpose and scope

Preserve every behavior, validation and rule identified in the source-code audit before replacing these four date controls:

1. Admin → Crew Appraisal Form → Edit mode → Version Date.
2. Admin → Promotion Review Form → Edit mode → Version Date.
3. Rank Administration → Vessel → Revision → Revision date.
4. Training Matrix → Vessel → Revision → Revision date.

This document records the existing behavior, including inconsistencies and gaps. It does not authorize implementation or authorize fixing those gaps. A consistent-looking selector must not silently standardize business rules, change stored formats, or add validation.

**Evidence boundary:** The audit traced UI state, handlers, API/service/repository behavior, schemas and downstream consumers. It was not a complete live-browser or database regression run for these four fields. Source references are audit-time navigation aids; verify current code before editing. Unchecked boxes below mean “must preserve/verify,” not “known to be broken.”

## Quick comparison

| Field | Default or restored date | Empty-date behavior | Saved format | Date included in Save Draft? |
| --- | --- | --- | --- | --- |
| Appraisal Version Date | Existing draft date; today for new draft | Displays “Select date”; saving uses today | `DD-MMM-YYYY`, e.g. `28-Sep-2026` | Yes |
| Promotion Version Date | Existing draft date; today for new draft | Displays today; saving uses today | `DD-MMM-YYYY`, e.g. `28-Sep-2026` | Yes |
| Rank Vessel Revision date | Initially blank; can retain a previously loaded revision date | Submit blocked | `DD/MM/YYYY`, e.g. `28/09/2026` | No |
| Training Matrix Vessel Revision date | UTC-based today on every + Revision entry | Submit blocked | `YYYY-MM-DD`, e.g. `2026-09-28` | No |

## 1. Shared boundaries and selector identity

- [ ] Limit a future control replacement to these four fields unless further changes are explicitly approved.
- [ ] Do not alter other Appraisal/Promotion form fields, shared selector internals, backend, schemas, dependencies, permissions or unrelated formatting as part of a field-only replacement.
- [ ] Confirm what “same shared selector” means. The existing shared `FormattedDateInput` and the newly introduced Appraisals-only `AppraisalDateInput` are different components.
- [ ] Do not assume their invalid-input behavior, year support, ref handling, read-only handling or calendar activation are equivalent.
- [ ] Keep the two Version Date fields’ today fallback separate from the two Revision Date fields’ required-on-Submit behavior.
- [ ] Preserve the three different storage formats and the current conversion boundaries.
- [ ] Preserve state ownership: Version Dates use `Date | undefined`; the native vessel revision inputs use ISO date strings.
- [ ] Preserve current labels, display values, focus behavior, disabled state, modal/popover usability and relevant test identifiers.
- [ ] Do not add past/future, chronological, duplicate-date or range business restrictions that do not currently exist.
- [ ] Do not silently rewrite existing stored values when merely opening a screen.
- [ ] Keep existing errors and save/release/submit validation gates attached to their current actions.
- [ ] Preserve current version/rank-group/vessel ownership and history links.
- [ ] Do not treat a future-looking version/revision date as scheduled activation: the audited date fields are not scheduling controls.

## 2. Crew Appraisal Form — Version Date

### Entry, defaults and version selection

- [ ] The active Admin editor is `FormEditor`, selected by the Crew Appraisal Form name through `FormEditorFactory`.
- [ ] Editable Version Date appears in configuration/edit mode. Released-version views show stored date information rather than this editable control.
- [ ] The current editable control is a popup Calendar backed by react-day-picker, not a native date input or manual text-entry field.
- [ ] Initial date state comes from the parent form’s date through `new Date(form.versionDate)` when present.
- [ ] Version queries are scoped to the form and rank group.
- [ ] Default active version is the highest numeric saved version; a draft wins an equal-version tie and can automatically reopen configuration mode.
- [ ] Explicit historical selection prevents automatic latest-version selection from immediately replacing that choice.
- [ ] Released historical dates are displayed from their saved version rows. Selecting a released row does not itself assign that row’s date into the editable date state.
- [ ] The version list can include API drafts/releases and a local draft placeholder; it creates a synthetic Draft v00 only when there are no saved rows, not a synthetic release.
- [ ] Latest-version selection uses numeric version comparison, while the displayed version list uses descending string comparison. Do not silently unify these algorithms.
- [ ] “Edit as new draft” reuses an existing draft and restores its number/date if one exists.
- [ ] Otherwise it creates the next draft, sets today, and copies configuration from the selected released version, falling back to the latest applicable release.
- [ ] Copying configuration does not copy the released version’s old Version Date.
- [ ] Starting a new draft sends a silent draft-creation request. Later date selection itself does not automatically save each change.

### Calendar selection, clearing and validation

- [ ] Calendar selection stores a local JavaScript Date; formatting happens at display/save time.
- [ ] Calendar uses single selection and initial focus, without a required-selection prop.
- [ ] There is no dedicated Clear button. If Calendar emits `undefined`, the selection can become empty.
- [ ] Empty selection displays “Select date.”
- [ ] Empty selection does not block Save Draft or Release; draft payload creation substitutes the current date.
- [ ] There is no date-specific required error, explicit min/max date, past/future ban, previous-version date comparison or duplicate-date check.
- [ ] The current calendar does not expose arbitrary manual text entry. Adding text entry requires explicit compatibility tests for partial and invalid text rather than assuming an existing typing rule.
- [ ] Save Draft in configuration mode still runs assessment-criteria validation.
- [ ] Nonempty competence and behavioural assessment arrays must retain their existing exactly-100 total-weight checks.
- [ ] Release in configuration mode uses the same configuration validation before saving/releasing.
- [ ] The non-configuration save path retains its assessment validation.

### Save, release and pending/failure behavior

- [ ] Save Draft serializes the selected date as `DD-MMM-YYYY`, with today used when selection is undefined.
- [ ] Save payload retains configuration and shared configuration; changing date does not change either payload’s structure.
- [ ] Existing draft saves update that draft rather than allocating a new version merely because the date changed.
- [ ] Configuration-mode Release saves the current in-memory date/configuration before requesting release.
- [ ] Release requires a persisted draft; without one the existing “No draft to release” handling remains.
- [ ] Outside configuration mode, Release acts on the stored draft without first saving unseen in-memory changes.
- [ ] A valid draft date survives release; the actual release timestamp is separate.
- [ ] Save success marks the configuration baseline clean, updates active version/draft state and invokes the existing parent submission callback.
- [ ] Create/save failure retains editor values/date, while the existing failure callback clears the saved-draft flag and displays an error.
- [ ] Release success refreshes version data, exits configuration mode and resets selection/draft flags; refetched version data determines the resulting display.
- [ ] Release failure shows an error without explicitly clearing the chosen date.
- [ ] Save Draft is disabled while its create/save mutation is pending.
- [ ] Release retains its pending-release and configuration-save pending restrictions.
- [ ] The Version Date button/Calendar itself has no separate pending-request disabled prop.

### Exit, discard and unsaved changes

- [ ] Discard of a persisted draft confirms and deletes that draft.
- [ ] Successful discard clears date/version/configuration selection state and refreshes versions.
- [ ] Discard failure does not explicitly clear current date/editor state.
- [ ] Discard without a persisted draft clears local draft/date/version state without a server deletion.
- [ ] Exit Config does not save the date and does not explicitly clear it.
- [ ] Assessment-criteria validation can prevent Exit Config.
- [ ] The header Back action can warn about unsaved configuration changes.
- [ ] Date-only changes are NOT part of the configuration-string dirty comparison and therefore do not independently trigger that warning.
- [ ] Do not turn this known date-only warning gap into a new behavior without separate approval.
- [ ] The Lock Form flag is displayed as a badge in the editor; it is not an additional Version Date editing lock.

References:
- `client/src/components/FormEditorFactory.tsx:7–11`
- `client/src/components/FormEditor.tsx:399–407,464–521,541–679,682–757,1026–1070,2100–2289`
- `client/src/components/ui/calendar.tsx`

## 3. Promotion Review Form — Version Date

### Entry, defaults and version selection

- [ ] The active editor is `PromotionFormEditor`, selected by the Promotion Review Form name.
- [ ] Editable Version Date is shown only in configuration/edit mode; outside that mode the form is a read-only preview.
- [ ] The current selector is a popup react-day-picker Calendar, not a manual date text field.
- [ ] Editable date state initially starts undefined.
- [ ] Versions are fetched for the form and filtered to the resolved rank group.
- [ ] Default active selection is the highest numeric saved version; a draft wins a tie and can reopen edit mode automatically.
- [ ] The version list includes the draft when applicable and released versions; list order is descending string comparison.
- [ ] Latest released selection compares numeric version and uses release time as a tie-break.
- [ ] Explicit historical selection pins the chosen version instead of silently reverting to latest.
- [ ] Selecting an existing draft restores its stored date and enters edit mode.
- [ ] Selecting a released version switches to preview; it does not assign the released row’s date into the editable date state.
- [ ] Configuration load precedence remains selected active version, latest released version, legacy rank-group configuration, then legacy parent form configuration.
- [ ] Entering edit reuses an existing draft/date when available.
- [ ] Otherwise it copies the currently viewed released configuration, falling back to latest, and initializes today rather than the old release date.
- [ ] Starting that draft sends a silent creation request; subsequent date changes are not individually autosaved.

### Calendar selection, clearing and validation

- [ ] Selected calendar dates are stored as local JavaScript Date values.
- [ ] Single selection and initial focus are retained.
- [ ] Calendar may emit undefined; its handler explicitly clears date state in that case.
- [ ] There is no dedicated Clear button or required-selection constraint.
- [ ] Empty selection displays today, not the Appraisal editor’s “Select date.”
- [ ] Save payload also substitutes today for undefined date state.
- [ ] Empty date does not add a required-date error or block saving/releasing.
- [ ] No explicit min/max, past/future, chronology or duplicate-date rule exists.
- [ ] Existing React Hook Form/schema configuration validation remains attached to Save Draft.
- [ ] Numeric nullable A2 criteria do not acquire new bounds through this date change.
- [ ] Existing removal of blank dynamic criteria from stored configuration stays unchanged.

### Save, release, exit and discard

- [ ] Version Date is serialized as `DD-MMM-YYYY`.
- [ ] Existing draft saves update that draft, retaining rank-group ownership.
- [ ] Release while editing saves the current date/configuration first, then releases the returned draft.
- [ ] Release outside edit mode releases the saved draft; no draft produces the existing notification.
- [ ] Valid stored Version Date is preserved during release.
- [ ] Save success refreshes version data and marks the draft saved without directly clearing the selected date.
- [ ] Save failure clears the saved-draft flag and shows an error, without explicitly clearing date state.
- [ ] Release success exits edit mode, refreshes data and resets draft/active-selection flags.
- [ ] Release failure shows an error without explicitly clearing selected date.
- [ ] Save Draft and Release retain their existing create/release pending restrictions.
- [ ] Date Calendar/button itself is not separately disabled during those requests.
- [ ] Discarding an existing draft requires confirmation and deletes it; success clears the local date/version/edit state.
- [ ] Discard failure retains that local state.
- [ ] Discard with no persisted draft only clears local state.
- [ ] Exit Config does not save, validate, clear or restore the selected date; it switches back to the latest released preview.
- [ ] The retained editable date state must not replace the released date displayed from the selected version row.
- [ ] Header Back directly calls the parent close action; there is no Appraisal-style configuration dirty-warning guard here.
- [ ] The Lock Form flag is a badge, not a separate Version Date lock.

References:
- `client/src/components/PromotionFormEditor.tsx:74–213,230–312,314–512,666–784`
- `shared/schema.ts:1069–1112`
- `client/src/components/ui/calendar.tsx`

## 4. Server and historical rules common to the two Version Dates

- [ ] Normal create/save and release paths expect a real calendar date spelled exactly `DD-MMM-YYYY`, using Jan through Dec and a four-digit year.
- [ ] Missing, wrong-format or invalid dates are replaced by the server’s current date, not rejected with a date-specific validation error.
- [ ] This fallback is distinct from the client’s local-today fallback.
- [ ] Server controls version number, draft status and release timestamp; supplied client metadata does not override that lifecycle.
- [ ] Saving updates the existing draft for the rank group or allocates the next numeric version, padded to at least two digits.
- [ ] Only draft versions may be released.
- [ ] Release keeps a valid stored draft date; invalid/missing date falls back to the release day.
- [ ] Release updates parent form metadata to the highest released version across the form, not necessarily only the current rank group.
- [ ] Errors synchronizing parent metadata propagate rather than reporting a falsely successful release.
- [ ] Parent form and form-version dates are non-null text columns, not database date columns with format checks.
- [ ] The generic partial-update path does not perform the same date normalization/lifecycle checking. Do not assume every API path enforces the normal editor rules.
- [ ] The separate rank-group release service is not the active editor release path; it has different mirroring/today behavior and must not be substituted.
- [ ] Appraisal/promotion historical configuration links use form-version IDs, not Version Date.
- [ ] Existing pinned records retain their version link; unpinned/latest-release loading must not be redirected by a date-control replacement.
- [ ] Date parsing on reopen uses `new Date` on stored non-ISO `DD-MMM-YYYY` strings, so runtime parsing behavior is an existing compatibility concern.
- [ ] Preserve visible saved dates without introducing UTC conversion that shifts calendar days.

Known server edge cases, not authorized fixes:
- [ ] The `Date.UTC` round-trip rejects years 0000–0099 because JavaScript remaps those years; rejected values fall back to today.
- [ ] Years outside the four-digit format fail the server format check.
- [ ] The locale-based server fallback can produce `Sept`, while the strict validator expects `Sep`. This mismatch was reproduced without writing records.
- [ ] Release may therefore fall back again when a previously stored fallback string is not accepted by the validator.

References:
- `server/v2/admin/services/formsService.ts:12–24,268–369`
- `server/v2/admin/controllers/formsController.ts:225–270`
- `server/v2/admin/services/rankGroupsService.ts:61–137`
- `shared/v2/admin/schema.ts:12–38`
- `client/src/modules/crewing/AppraisalForm_v2.tsx:537–591`
- `server/v2/appraisals/services/appraisalResultsService.ts:292–312`
- `server/v2/promotions/services/promotionReviewsService.ts`

## 5. Rank Administration — Vessel — Revision date

### Entry, existing values and multiple vessels

- [ ] The control is currently a native `type="date"` input with ISO string state and test ID `flex-date-input`.
- [ ] It is disabled outside Revision mode.
- [ ] At least one selected vessel is needed to enter revision mode.
- [ ] Date state initially starts empty.
- [ ] + Revision does NOT set today or otherwise replace the current date.
- [ ] For one selected vessel, revision entry fetches the next revision number for display; for multiple vessels it displays Auto. This does not determine the date.
- [ ] Revision-mode loading restores rank data from a saved draft, merged over company defaults, or initializes fresh vessel data if no draft exists.
- [ ] Draft loading does not restore a date because vessel drafts have no revision-date field.
- [ ] Viewing-mode loading chooses the latest numeric R revision and restores its saved date.
- [ ] Existing `DD/MM/YYYY` dates are converted by string splitting to `YYYY-MM-DD` for the input; unexpected formats are passed through rather than explicitly validated.
- [ ] No-revision loading clears the date.
- [ ] Starting a revision after viewing a saved revision can inherit that old date.
- [ ] There is one shared date state, not one date per vessel.
- [ ] Adding/removing vessels does not directly clear the date.
- [ ] Parallel viewing-mode vessel loads can each overwrite that shared date; whichever write finishes last wins. A vessel without revisions can clear a date another vessel loaded.
- [ ] Revision-mode draft loading does not reconcile or reset this shared date.

### Required checks, formats and Save Draft

- [ ] Submit without selected vessels returns without submitting.
- [ ] Submit with an empty date is blocked with title “Date required” and description “Please provide a date before submitting”.
- [ ] Save Draft does not require a date.
- [ ] No explicit minimum, maximum, past/future, prior-revision chronology or duplicate-date restriction exists.
- [ ] Normal UI date shape is provided by the native browser input, not an additional application-level calendar parser.
- [ ] Submit converts ISO input through `new Date(flexDate)` and local year/month/day getters to `DD/MM/YYYY`.
- [ ] This conversion is timezone-dependent; do not silently replace it as an unrelated bug fix.
- [ ] The date is formatted once and reused for all selected vessels being submitted.
- [ ] Save Draft loops selected vessels with available rank data and stores rank data, vessel ID and the existing draft revision marker R1.
- [ ] Save Draft does NOT store the revision date.
- [ ] Draft upsert updates an existing draft or creates one; date persistence must not be added incidentally.
- [ ] Draft-save success/failure notices and per-vessel handling remain unchanged.

### Submit, downstream effects and result handling

- [ ] Submit filters out rows without a nonempty rank before serializing revision data.
- [ ] It submits selected vessels sequentially and continues after individual failures.
- [ ] Each vessel gets its own server-generated next revision number, starting at R0 for no existing recognized revisions.
- [ ] Submit creates a new revision, not an edit to an old revision.
- [ ] Each successfully submitted vessel’s drafts are deleted.
- [ ] Existing actual-manning rank synchronization into vessel planning remains unchanged.
- [ ] Revision date is not used to delay planning synchronization or schedule activation.
- [ ] If at least one vessel succeeds, selection/edit mode/date/loaded-vessel tracking are reset.
- [ ] The same reset occurs on partial success, with a separate notice for failed vessels.
- [ ] Failed vessels’ drafts remain; the successful reset can nevertheless remove their in-memory editing context.
- [ ] If all submissions fail, current date, selection and editing state are retained for retry.
- [ ] An outer submission error shows an error without the success reset.

### Cancel, history and effective selection

- [ ] Cancel exits revision/edit mode, clears selected vessels and clears loaded-vessel tracking.
- [ ] Cancel does NOT explicitly clear date state or delete saved drafts.
- [ ] The retained date may reappear unless a subsequent load replaces it.
- [ ] There is no separate revision reset/restore-date action.
- [ ] Submit is the effective publish/release action; these revisions do not have a separate draft/released status workflow.
- [ ] Viewing UI chooses latest by numeric revision; repository lists and downstream effective-rank selection use creation time ordering.
- [ ] Revision date does not determine “latest” or historical identity.
- [ ] Existing history remains available through revision retrieval; active routes do not expose editing/deleting a submitted revision.

References:
- `client/src/modules/admin/AdminModule.tsx:798–801,2020–2214,3076–3269,4840–4862,4923–4931`
- `server/v2/admin/services/vesselDraftsService.ts:38–46`
- `server/v2/admin/services/vesselRevisionsService.ts:65–201,231–316`
- `server/v2/admin/repositories/vesselRevisionsRepository.ts:35–94`

## 6. Training Matrix — Vessel — Revision date

### Entry, defaults and existing values

- [ ] The control is a native `type="date"` input with ISO string state and test ID `tm-flex-date-input`.
- [ ] It is disabled outside Training Matrix Revision mode.
- [ ] Date state initially starts empty.
- [ ] + Revision requires at least one selected vessel; the existing button disable/no-vessel notification remains.
- [ ] Every + Revision entry sets date to `new Date().toISOString().split('T')[0]`: UTC-based today.
- [ ] UTC today can differ from the user’s local day near midnight.
- [ ] Loading a draft or old revision does NOT restore its saved date into this control.
- [ ] Training selection hydration prefers draft data, then latest numeric revision data.
- [ ] Existing supported training-data representations and parsing remain unchanged.
- [ ] There is a single date state, not a date per selected vessel.
- [ ] Vessel switching does not separately clear or restore date state.

### Validation, Save Draft and Submit

- [ ] Submit without a selected vessel returns without sending a revision.
- [ ] Empty date blocks Submit with title “Date required” and description “Please select a revision date.”
- [ ] Save Draft does not require a date.
- [ ] No explicit min/max, past/future, previous-revision chronology or duplicate-date rule exists.
- [ ] Browser-native date handling currently provides normal UI date validity.
- [ ] Submit sends ISO `YYYY-MM-DD` directly; do NOT apply Rank Administration’s `DD/MM/YYYY` conversion.
- [ ] Save Draft stores applicable training IDs without the date.
- [ ] Current Save Draft and Submit handlers use only the FIRST selected vessel, despite the multi-vessel selection and “all selected vessels” wording.
- [ ] Do not silently turn those actions into a multi-vessel loop as part of this selector change.
- [ ] Submission creates a new server-numbered revision and deletes that vessel’s drafts.
- [ ] Revision numbers start at R0 and advance from recognized numeric R revisions.
- [ ] Revision date is not a future effective/activation date for training requirements.
- [ ] Save Draft success refreshes that vessel’s draft query and leaves date, selection and mode intact.
- [ ] Save Draft failure shows the existing notice and retains state.

### Cancel, success, failure and downstream behavior

- [ ] Cancel sets Revision mode false and clears the in-memory applicable-training map.
- [ ] Cancel retains date and selected vessels and does not delete a persisted draft.
- [ ] Successful Submit exits Revision mode and refreshes that vessel’s revision/next-revision/draft queries.
- [ ] Successful Submit does NOT explicitly clear date, selected vessels or the applicable-training map.
- [ ] Failed Submit shows an error and retains state for retry.
- [ ] Starting another revision replaces the retained date with UTC today again.
- [ ] Admin hydration chooses latest numeric revision; downstream Vessel training consumption chooses newest creation time.
- [ ] Neither selection is based on Revision date.
- [ ] No separate release state/action, revision reset/restore workflow or routed submitted-revision edit/delete action was found.

References:
- `client/src/modules/admin/AdminModule.tsx:806,828–1009,6568–6685`
- `server/v2/admin/services/trainingMatrixVesselRevisionsService.ts:32–58`
- `server/v2/admin/repositories/trainingMatrixVesselRevisionsRepository.ts:35–94`
- `client/src/modules/vessel/VesselModule_v2.tsx:1029–1047`

## 7. Vessel revision persistence, API and access boundaries

- [ ] Rank and Training Matrix use separate revision/draft tables.
- [ ] Revision date is non-null text; the database does not enforce a real calendar date or either screen’s string format.
- [ ] Draft tables have no dedicated revision-date column.
- [ ] No database date-range, chronological, duplicate-date or duplicate-revision constraint was identified.
- [ ] Revision allocation scans recognized R-number strings and computes max + 1; it is not an atomic unique-allocation guarantee.
- [ ] Nonconforming revision-number strings are ignored by that next-number calculation.
- [ ] One draft per vessel is intended through upsert/first-draft selection, but not guaranteed by a unique database constraint.
- [ ] Submit removes all drafts for the submitted vessel.
- [ ] Revision repositories filter non-deleted rows and list by creation time; date does not override this ordering.
- [ ] Revision create/submit controllers do not add explicit body/date/chronology validation equivalent to the native UI input.
- [ ] Database non-null constraints are not a substitute for required or valid-date validation; malformed direct requests may fail incidentally rather than with a date-specific message.
- [ ] Repository update/soft-delete capabilities do not imply those actions are exposed by active revision routes.
- [ ] No separate date-specific permission rule was found on these four controls.
- [ ] Forms-table edit entry and the vessel date/revision controls must not be confused with adjacent permission-gated Lock Form, Add Rank Group or company-edit controls.
- [ ] Preserve surrounding access controls and mode-based disabling. Do not introduce/remove permission checks in a selector-only change.
- [ ] Global authentication middleware exists, subject to the configured bypass; lack of a route-local permission check is NOT proof that the API has no authentication.
- [ ] No route/controller-level menu-permission check was identified on the audited revision endpoints.
- [ ] Audited revision controllers accept an audit-user identifier from request data; do not silently change audit provenance handling here.

References:
- `shared/v2/admin/schema.ts:154–190`
- `migrations/0088_create_admin_v2_extended_tables.sql:153–181`
- `server/v2/admin/routes.ts:93–128`
- `server/v2/admin/controllers/vesselRevisionsController.ts:43–73`
- `server/v2/admin/controllers/trainingMatrixVesselRevisionsController.ts:43–72`
- `client/src/modules/admin/AdminModule.tsx:8450–8559`
- `server/index.ts`

## 8. Compatibility risks when choosing a replacement

### Existing shared FormattedDateInput

- [ ] Accepts its supported manual day-month-year forms and emits canonical ISO dates for valid input.
- [ ] Invalid/incomplete manual text does not emit a replacement canonical value, potentially leaving the previously accepted date in parent state.
- [ ] On blur it reports invalidity and normally restores the controlled display; retain-invalid-draft is an option.
- [ ] Supports date-range checks and normally constrains supported years to 0001–9999.
- [ ] Uses a calendar button plus a hidden native input and programmatic `showPicker()`/click fallback.
- [ ] The cross-origin iframe fallback is not proof that opening the native calendar succeeds in the target embedded environment.
- [ ] Ref targets a wrapper div rather than the visible input.
- [ ] Date mode exposes disabled handling, not the Appraisals-only component’s equivalent readOnly support.
- [ ] Calendar input-event options and change/blur sequencing differ from the local Appraisals-only control.

### Appraisals-only AppraisalDateInput

- [ ] Emits empty canonical value for invalid/incomplete manual typing while retaining the visible draft.
- [ ] Does not add the previously deferred browser `setCustomValidity` correction or new Save Draft blocker.
- [ ] Forwards the ref to the actual visible input.
- [ ] Honors readOnly/disabled and inherited disabled fieldsets.
- [ ] Uses a transparent native date input over the calendar icon instead of programmatic showPicker.
- [ ] Handles calendar change arriving after blur without changing React’s change tracker during blur reporting.
- [ ] Supports browser-accepted extended years rather than imposing the shared selector’s four-digit-year maximum.
- [ ] Keeps exceptional stored values on the native rendering path.
- [ ] Its manual minimum rejection is opt-in; native-picker minimum rejection applies when a valid minimum is supplied.

### Required decisions and preservation checks

- [ ] Confirm the intended component before proposing code; do not assume “same” means either implementation.
- [ ] Do not claim the earlier Appraisals-only iframe fix automatically applies to the unchanged shared component.
- [ ] Define and verify the new manual-input path, especially partially typed text, impossible dates, clearing and retyping the same accepted date.
- [ ] Prevent a misleading visible invalid draft from silently saving an old date without an explicit, approved behavior decision.
- [ ] Keep blank Version Date fallback separate from required Revision date behavior.
- [ ] Do not send ISO directly to Version Date storage or to Rank revision storage without the required existing conversion.
- [ ] Do not add a new year cap or silently normalize legacy values without assessing the existing UI/API behavior.
- [ ] Verify disabled controls cannot change via either typing or calendar interaction.
- [ ] Verify keyboard navigation, focus/labels, popover stacking and embedded calendar opening after a replacement.

References:
- `client/src/components/ui/formatted-date-input.tsx`
- `client/src/components/appraisal-form-parts/AppraisalDateInput.tsx`
- `tests/unit/components/formatted-date-input.test.tsx`

## 9. Known gaps are not approved fixes

Keep these findings visible but separate from any selector-only implementation:

- [ ] Version Date-only edits are excluded from Appraisal’s unsaved-configuration warning.
- [ ] Promotion Back/Exit Config has different warning/validation behavior from Appraisal.
- [ ] Server September fallback spelling and early-year round-trip issues.
- [ ] Runtime-dependent parsing of saved non-ISO Version Dates.
- [ ] Rank ISO-to-local-Date submission conversion can shift a calendar day in some timezones.
- [ ] Rank multi-vessel loads can overwrite the one shared displayed date.
- [ ] Rank partial success resets the editing/date context even for vessels that failed.
- [ ] Neither vessel Save Draft persists the selected date.
- [ ] Training Matrix restores training data but not a revision date into its date control.
- [ ] Training Matrix uses UTC today for its default.
- [ ] Training Matrix multi-vessel wording differs from first-vessel-only save/submit handling.
- [ ] Cancel and successful-submit date retention differ between Rank and Training Matrix.
- [ ] Numeric revision ordering and creation-time effective selection can disagree.
- [ ] Missing backend date-format enforcement, weak draft/revision uniqueness and non-atomic revision numbering.
- [ ] Adjacent permissions do not establish date/action-specific authorization; audit metadata handling has separate concerns.
- [ ] Shared-selector invalid text can leave an old accepted date in parent state.

Any correction needs explicit scope approval rather than being hidden inside a visual/control replacement.

## 10. Pre/post-change verification checklist

These are future verification requirements, not claims of completed testing for the four Admin fields.

- [ ] Recheck current code and approved file scope; stop for clarification if the agreed starting point differs.
- [ ] Record existing TypeScript/build/test diagnostics before editing.
- [ ] Verify only approved controls/adapters change; no unrelated formatting or cleanup.
- [ ] Test current date, past date, future date, leap day and impossible day/month combinations.
- [ ] Test empty, partial, invalid, corrected and same-date-reentry text; inspect both displayed text and submitted value.
- [ ] Test valid historical values, malformed/legacy saved values and year-boundary cases without rewriting on open.
- [ ] Test calendar selection, same-day reselection, deselection where supported, Escape and outside-click cancellation.
- [ ] Test native input/blur/change ordering and keyboard focus movement.
- [ ] Test the actual embedded iframe, not only a standalone page.
- [ ] Test labels, focus, tab order, narrow layouts, dialog/popover stacking and disabled/read-only controls.
- [ ] Appraisal: existing draft reopen, new draft from old release, cleared-date display, today fallback, saved-date release preservation.
- [ ] Appraisal: assessment/weight gates, historical viewing, discard success/failure, Exit Config and date-only dirty-warning behavior.
- [ ] Promotion: existing/new draft, today display when cleared, release within/outside edit, criteria validation and close/exit behavior.
- [ ] Both forms: correct rank group, server-assigned version number, parent metadata and retained historical version IDs.
- [ ] Both forms: pending-request behavior, failed save/release and external query refresh without losing or misrepresenting the date.
- [ ] Rank: initially blank/inherited date, saved revision restoration, no today on Revision entry, blank Submit and blank Save Draft.
- [ ] Rank: ISO input to slash-format payload, timezone boundaries, single/multiple vessels, shared date and per-vessel revision allocation.
- [ ] Rank: Cancel retention, successful-submit reset, partial-success reset, all-failed retry and unchanged planning side effects.
- [ ] Training Matrix: UTC-today Revision entry, no date restoration from draft/history, blank Submit and date-free Save Draft.
- [ ] Training Matrix: ISO payload, first-selected-vessel behavior, Cancel retention, success retention and failed retry.
- [ ] Confirm neither draft path unexpectedly starts storing a date.
- [ ] Confirm no new min/max, chronology, duplicate-date or scheduling restrictions.
- [ ] Test save/reopen using authorized isolated test records; do not silently mutate existing business records.
- [ ] Run relevant existing tests and focused new tests; distinguish shared-component unit coverage from field-level integration coverage.
- [ ] Existing shared-selector tests do not establish equivalence for these four fields; the audit found no dedicated tests for their date controls.
- [ ] Compare post-change diagnostics against baseline, report exact diff/file list and explicitly identify any unverified browsers, timezone cases or database paths.
- [ ] Restart and verify the running app only when implementation is actually authorized and performed.

## Documentation-only record

Creating this checklist does not apply a selector change, change memory, start a task, run database writes or authorize fixing any listed gap.