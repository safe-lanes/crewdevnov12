# Prominent draft trial — presentation-only delivery

## Placement and action

The policy summary and existing draft trial are now immediately after the
completion-obligation/effective-date controls and before the condition cards.
Authors can read the consequence and test it before scrolling through long
cards. The summary directly precedes the trial.

The heading and existing run button both say **Test this draft**. The decorative
Sparkles icon was removed. The existing explanation stays verbatim, including
unsaved edits, no policy save, and no crew-fact decisions in the browser.
No additional panel, toggle or repeated trial was added.

## Keyboard and result preservation

DOM order matches the visual position; no positive tabindex or custom key
handler was introduced. Natural Tab navigation reaches the search field.
After choosing an assignment, Tab from search reaches the enabled action;
Enter runs it. The action has an explicit visible focus ring. The unchanged
dialog focus trap and closing behaviour remain.

Trial state, inputs, request construction, server calculation, permissions,
validation, saving, results, wording of results and source-fact caveats remain
unchanged. The trial is still conditional-draft-only, not shown for released
versions, applies-to-all, or manual-only.

## Height and evidence

At 1560 × 1400, measured dialog scroll height is **1,378 px before and after**.
Moving the existing blocks did not increase total measured dialog height.
Save settings is reachable by scrolling, both before running a check and after
its result. No crowding from an extra component was introduced.

- Main preview: existing Admin development persona and registered
  **TEST ONLY Approved PDF automatic rollout** draft. Before/after screenshots,
  keyboard focus on search and action, and Save settings reachability.
- That retained draft has no stage, so its existing preview endpoint refuses it
  with “Choose a subject stage before trying this rule.” The client continues
  to display its existing safe failure message. No stage was saved or guard
  changed for evidence.
- Successful result evidence uses the actual main frontend with **all API
  requests routed to the guarded isolated test backend**, not mocked results.
  A synthetic, stage-bearing draft and crew assignment created by the existing
  API test fixture are used; unsaved local conditions are checked through the
  screen. Tab/Enter produces **Result: Applies**, with the existing explanation,
  condition results and retrospective-stage caveat.
- The browser regression lives in
  `tests/integration/api/company-form-rule-editor.test.ts`; it verifies the
  policy and operational-record snapshot is unchanged. Those automated fixtures
  belong only to the isolated database, not the main-preview fixture register.
- Main-preview verification refuses every API mutation except the existing
  read-only preview POST. All development table counts, content fingerprints and
  column definitions match the before snapshot.
- Normal parent SSO was not verified.

## Files

- `CompanyFormApplicabilityEditor.tsx`: moved summary and unchanged trial props.
- `CompanyFormRuleTrial.tsx`: action heading/button label, removed decorative
  icon, focus ring; no search/request/result logic changes.
- Unit tests: renamed button expectations and assert summary → trial →
  condition-card order.
- `scripts/verify-form-settings-wording.mjs`: added before/after trial evidence,
  keyboard assertions, layout measurement and development-data verification.

Screenshot review: `generated-artifacts/form-rule-trial-promotion/review.html`.
Raw evidence: `.local/verification/form-rule-trial-promotion/`.

## Closing gates

- Full suite: **2,281 passed / 162 failed / 67 pending** — within the ceiling,
  not fully green. The new keyboard/browser result test passed in this run.
- All 101 discovered Company Forms files: **718 passed / zero failed / zero
  skipped**.
- TypeScript: **222 diagnostics**.

Commit and post-commit backend start are recorded in the closing screenshot
report and delivery summary.
