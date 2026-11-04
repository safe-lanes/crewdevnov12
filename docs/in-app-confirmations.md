# In-app confirmations, alerts and comment prompt

## Scope

Replace all native browser confirmation, alert and prompt calls in `client/`.
Messages remain verbatim, including the agreed applicability discard wording.
No settings, permissions, calculations, validation, persistence, backend or
schema changes are included.

The existing `components/ui/alert-dialog.tsx` primitives are reused. There is
no new modal component. A lifecycle hook supplies the existing AlertDialog
markup and Promise-returning decision functions to each owning screen.
The existing AlertDialog content accepts an optional overlay class so a
confirmation can appear above the Company's already-open editor/settings
dialogs; existing consumers retain their default styling.

Every consequential action has specific affirmative/negative labels.
Messages retain their exact text; titles and action labels are presentation.
The comment prompt retains its initial value and distinguishes cancellation
(`null`) from saving an empty string (`""`).

## Complete inventory before editing

Paths below are relative to `client/src/`; lines refer to the pre-change
revision `ccb72719eac6d23f4fc706129cde69ceecd062e9`.

| File:line | Screen | Exact existing message |
| --- | --- | --- |
| `components/wage/ElementLineRow.tsx:64` | Wage element row | `Are you sure you want to delete ${line.name}?` |
| `components/company-forms/CompanyFormApplicabilityEditor.tsx:234` | When this form applies: mode switch | `Changing this mode will discard ${discardedSettings.join(" and ")}. Continue?` |
| `components/company-forms/CompanyFormApplicabilityEditor.tsx:343` | When this form applies: close | `Discard unsaved applicability changes and close this window?` |
| `modules/training-retention/components/Training.tsx:148` | Training Needs | `Delete this training need?` |
| `components/dialogs/PromotionHierarchyDialog.tsx:379` | Promotion hierarchy | `Delete "${hierarchy.groupName}" hierarchy?` |
| `components/form-editor-parts/PartG.tsx:297` | Appraisal Office Review & Followup | `Enter comment:` |
| `modules/recruitment/RecruitmentModule_v2.tsx:361` | Recruitment candidate list | `Are you sure you want to delete "${candidateName}"?\n\nThis will remove the candidate from the list.\nFile No: ${params.data.fileNo}` |
| `components/configured-form/CompanyPdfActions.tsx:139` | Company Form PDF handover | `Record that this PDF was handed to the seafarer?` |
| Same file, `:149` | Company Form void notice handover | `Record that the void notice was handed to the seafarer?` |
| `modules/vessel/components/ReliefStatusEditDialog_v2.tsx:253` | Reliever Status | `Discard unsaved changes?` |
| `modules/vessel/components/TrainingMatrixCompliance.tsx:344` | Training compliance attachment, popup blocked | `The attachment could not be opened. Please allow pop-ups and try again.` |
| Same file, `:348` | Training compliance attachment, request failed | `The attachment could not be opened. Please try again.` |
| `modules/rest-hours/components/PlaceholderChart.tsx:15` | Rest Hours chart | `Download functionality will be implemented for ${title} chart` |
| `modules/admin/AdminModule.tsx:3758` | Forms Configuration: delete | `Are you sure you want to delete the form "${form.name}"?` |
| Same file, `:8546` | Forms Configuration: archive Company Form | `Archive "${form.name}"? Existing submissions will stay readable, but this form cannot be edited or used for new submissions.` |
| `modules/admin/TrainingEquivalentsEditor.tsx:95` | Training equivalents: vessel switch | `Discard unsaved equivalence changes and switch vessel?` |
| Same file, `:179` | Training equivalents: revision switch | `Discard unsaved equivalence changes and view another revision?` |
| `modules/accounts/pages/WageScalesPage.tsx:318` | Wage scales | `Delete draft "${row.scaleName}"?` |
| `modules/accounts/pages/CbaReferencePage.tsx:233` | CBA references | `Delete CBA reference "${row.cbaName}"?` |
| `modules/accounts/pages/PayElementsPage.tsx:331` | Pay elements | `Delete pay element "${row.name}"? This performs a soft-delete.` |

**Total: 20 native call sites: 16 confirm, 3 alert, 1 prompt.** The additional
search match `modules/accounts/pages/EndAllotmentDialog.tsx:177` calls its own
local async `confirm` function, not a native browser dialog, and is unchanged.
No call site was omitted or left native.

## Decision and cancellation semantics

- Await the decision before entering the original mutation/discard branch.
- Cancel buttons and Escape resolve negatively. Clicking outside does not
  accidentally accept the action.
- The owner unmounting cancels a pending decision. Re-entry while a decision
  is pending is refused, rather than duplicating the action.
- Restore focus to the initiating control if it still exists.
- Parent dialog remains open when Escape dismisses the nested confirmation.
- Applicability cancellation preserves conditions, obligation and date.
  Acceptance clears exactly the settings described, with the original
  Manual-only resets; switching back does not restore discarded settings.
- PDF handover cancellation sends no request. Acceptance still sends the
  same frozen fingerprint to the same endpoint.
- Training equivalents cancellation retains its old vessel's dirty links.
  The existing previous-vessel explanation and explicit discard action stay
  unchanged. A stale asynchronous vessel decision cannot select a different
  vessel from the one the user was asked about.

## Verification

Automated coverage:

- `tests/unit/native-dialog-continuations.test.ts`: extracts and executes
  the actual source handlers for all 16 confirmations and the prompt, with
  explicit dependency spies. Each cancellation performs no continuation,
  setter, mutation, toast or invalidation; each acceptance continues once.
- `tests/unit/native-dialog-call-sites.test.tsx`: renders real wage deletion,
  Appraisal comment prompt, Rest Hours notice and CBA deletion with the real
  AlertDialog and mocked persistence. Tests both decisions and empty comment.
- Existing applicability-window, reliever-save and void-notice-handover DOM
  tests now click the real in-app actions instead of mocking native returns.
- Additional PDF handover and training-equivalents DOM tests cover both
  decisions for original/void copies and vessel/revision switches.
- `tests/unit/native-dialog-inventory.test.ts`: scans the whole client AST,
  rejecting any native call while recognizing locally declared functions.

Browser evidence:

`node scripts/verify-native-dialogs.mjs --baseline` captures read-only
development table counts, content fingerprints and column definitions.
After committing and restarting the main workflow,
`node scripts/verify-native-dialogs.mjs --closing`:

- executes all 17 actual confirmation/prompt handlers and the exact three
  notice expressions in an isolated browser harness with synthetic
  dependencies, taking a screenshot of every dialog;
- cancels and accepts all confirmations and the prompt, acknowledges all
  three alerts, and saves a screenshot of each;
- opens the actual main-preview applicability dialog with the existing Admin
  development persona and registered fixture; cancels a mode change and a
  dirty close, checks retained edits, and checks nested Escape at 420px;
- refuses all API writes and verifies development counts, content and schema
  metadata against the baseline;
- checks that the backend started after the closing commit.

The harness is a test file loaded by an intercepted browser document. No
application route, public test screen, authentication bypass or production
component was added. Main-preview checks use the existing development
persona mechanism, not parent SSO. Other screen handlers are tested with
synthetic dependencies; their screenshots are labelled as isolated handler
verification, not claimed as signed-in visits to every operational screen.

Evidence is stored outside Git:

- `.local/verification/native-dialogs/report.json` — closing identities,
  checks, screenshot inventory and zero-write/zero-native-dialog result.
- `.local/verification/native-dialogs/*.jpg` — 20 dialog screenshots plus
  desktop/narrow main-preview screenshots.
- `generated-artifacts/native-dialogs/review.html` — self-contained review
  including the previous task's actual native-browser “before” capture.

The older `scripts/verify-form-settings-order.mjs` records the preceding
layout task, including its then-native confirmation. Its native-dialog
interaction is superseded by this verifier; it should not be used as the
current confirmation verifier.

Closing gate results and exact commit/backend times are reported in the
completion summary and the verification report.
