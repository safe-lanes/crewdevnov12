# When this form applies — wording-only change

## Labels and locations

- `client/src/components/GenericFormEditor.tsx`: the configuration-header
  settings button now says **When this form applies** for both draft and
  read-only versions. The header's accessible label, loading help and
  permission-denial help use the aligned terminology.
- `client/src/components/company-forms/CompanyFormApplicabilityEditor.tsx`:
  the dialog title is **When this form applies**, retaining the **— read only**
  suffix where appropriate. The draft subtitle is:
  “Set the completion obligation, effective date and crew scope, then save
  these settings before releasing this version.”
  Released and permission-read-only subtitles name the same three settings.
  The save button says **Save settings**.
- The orphaned stage text now identifies the **stage selector in the
  configuration header**, including when no stage has been selected. This
  preserves useful context without implying that this dialog can set a stage.
- `tests/unit/company-form-applicability-window.test.tsx` and
  `tests/unit/generic-form-editor-release.test.tsx`: updated title and added
  assertions for the new button, subtitle, save label and stage pointer.
- `scripts/verify-company-form-applicability-window.mjs`: read-only title
  expectation updated; its pre-existing save/restoration journey is unchanged
  and was not used for this task.
- `docs/company-forms/applicability-window-verification.md`: historical journey
  now identifies the current button/save names.
- `scripts/verify-form-settings-wording.mjs`: new read-only preview checks and
  screenshots. It refuses all API writes and compares all development-table
  counts/content fingerprints and column definitions before and after.

No internal section heading, condition, permission, validation, event handler,
request payload, save/release guard or schema was changed. Searches found no
remaining old dialog title, subtitle or save label in client, tests, scripts
or Company Forms documentation.

## Preview evidence

The existing registered **TEST ONLY Approved PDF automatic rollout** form was
reused. No fixture was created, edited, released or saved.

- Desktop: 1560 × 1400.
- Narrow: 390 × 844.
- The new button fits on one line at both sizes, with no truncation, so no
  shortened alternative was necessary.
- The existing narrow editor toolbar already stacks, and other editor content
  is clipped horizontally. The new button itself remains fully visible.
  **A claim that the whole narrow editor is crowd-free is NOT VERIFIED**;
  fixing that broader layout is outside this wording-only task.
- Draft dialog title, subtitle and save label were checked through the screen.
- Released dialog retains read-only controls and has no Save settings action.
- Existing Admin development persona was used; normal parent SSO was not
  verified.

Screenshots and the closing report are under
`.local/verification/form-settings-wording/`; the self-contained screenshot
review is `generated-artifacts/form-settings-wording/review.html`.

## Recommendation only: make the trial more prominent

Yes. **Try this draft with a crew assignment** could be placed immediately
after the summary, before the long condition cards, with a clear
**Test this draft** action rather than relying on the decorative icon.
It should remain conditional-mode-only, read-only, and explicitly say that it
uses unsaved draft settings and creates no requirements. This would require
moving the existing trial component and updating focus order, layout tests and
browser screenshots, not a change to the server calculation or save logic.
No such prominence change was implemented.

## Closing gates

- Full suite: **2,280 passed / 162 failed / 67 pending**, within the agreed
  ceiling but not fully green.
- All 101 discovered Company Forms files: **717 passed / zero failed / zero
  skipped**.
- TypeScript: **222 diagnostics**.
- No browser page errors or API writes during the read-only journey.
- Development table counts, content fingerprints and column definitions match
  the pre-verification snapshot.

Final HEAD, commit time and post-commit backend start are captured in the closing
preview report and reported with the delivery.
