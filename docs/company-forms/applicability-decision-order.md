# When this form applies — decision order

## Presentation changes

The order is now:

1. **Who this version applies to** — three mode cards.
2. **Conditions**, only for conditions mode. The existing explanation that
   conditions join with “and” and groups with “or” is unchanged.
3. **Completion obligation / When it becomes effective**, automatic modes only.
4. **Policy summary**.
5. **Test this draft**, still only for conditional drafts.
6. Existing stage information, then **Save settings**.

This supersedes the placement described in `draft-trial-promotion.md`. The stage
line retains its existing conditional-mode visibility. No new stage check or
policy setting was added.

Mode descriptions remain verbatim but no longer occupy resting card space.
Each card's help button shows the description on hover/focus and in a popover
on click/tap or Enter/Space. Escape dismisses the popover without closing the
settings dialog. Radio labels and selection handlers remain unchanged.

## Confirmation wording and unchanged discard behaviour

Previous wording:

> Changing this mode will discard some conditional or due-date settings. Continue?

New wording lists exactly what the **existing** discard booleans identify:

- “Changing this mode will discard configured conditions. Continue?”
- “Changing this mode will discard completion obligation and effective-date settings. Continue?”
- “Changing this mode will discard configured conditions and completion obligation and effective-date settings. Continue?”

The same booleans still decide whether to ask. Cancel preserves the current
values; acceptance applies the existing clear/reset logic. Switching back does
not restore discarded values. No invisible retained state was introduced.

## Verification

- Registered main-preview fixture: **TEST ONLY Approved PDF automatic rollout**.
  Existing Admin development persona; not normal parent SSO.
- Full-dialog screenshots for all three modes, description on hover, click/tap
  and keyboard, actual headed Chromium native confirmation, and 420 px narrow
  views including Save settings.
- At desktop viewport **1560 × 2200**, the full natural conditional-dialog
  height changed **1,380 → 1,348 px**, a **32 px reduction**. Measurement waits
  for fonts and completes finite animations; it does not measure an in-progress
  transformed dialog. Applies-to-all height: 566 px; manual-only: 560 px.
- At **420 × 900**, the dialog scrolls vertically and Save settings remains
  reachable. No layout override was used to capture the dialog.
- Tab navigation follows the new DOM order through mode/help controls,
  conditions, obligation/timing and draft search. Keyboard entry of a specific
  date and focus on Save settings are exercised without saving. Mode radio
  groups retain their standard arrow-key selection; nonselected radios are not
  additional Tab stops. Disabled controls remain disabled.
- The existing isolated browser API test still runs the draft check by Tab and
  Enter, preserving the existing result and caveats.
- Browser verification accepts and cancels actual confirmations. Unit tests
  separately verify preservation on cancellation, confirmed discard, no
  restored groups, and the existing Manual-only obligation/date reset.
- Verification refuses all API mutations. All development table counts,
  content fingerprints and column definitions match the before snapshot.

There are no changes to settings, conditions, mode-switch state transitions,
validation, calculation, save/payload behaviour, backend permissions or schema.
Only presentation, description access, focus order and confirmation wording
changed.

Run `node scripts/verify-form-settings-order.mjs --before` before a layout change;
then run `node scripts/verify-form-settings-order.mjs --headed --closing` after
the commit and workflow restart. `--headed` captures the actual native
confirmation using the existing X display and ImageMagick window capture.
The verifier never saves or creates development fixtures.

Evidence:

- `.local/verification/form-settings-order/` — raw screenshots, fingerprints,
  dimensions, keyboard trace and closing HEAD/backend-start report.
- `generated-artifacts/form-settings-order/review.html` — self-contained
  screenshot review.

## Closing gates

- Full suite: **2,283 passed / 162 failed / 67 pending** — within the ceiling,
  not fully green.
- Company Forms: all 101 discovered files, **720 passed / zero failed / zero
  skipped**.
- TypeScript: **222 diagnostics**.
- An initial full run had one additional timeout waiting for the Forms tab in
  the existing browser integration test. It passed on a focused rerun and in
  the closing full run. The initial cause was not established. Failure
  screenshot/network diagnostics were added; no timeout or assertion was
  weakened to make it pass.

Raw totals are in `.local/verification/form-settings-order/gates.json`.
Closing HEAD, commit time and later backend start are recorded by the
post-commit verification and in the delivery summary.
