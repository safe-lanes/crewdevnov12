# Management grants popup

## Placement and opening choice

**Management grants** is the first outline button in the Access Control top row,
followed by Blocking Seafarer Deployment, Access audit history and Company PDF
branding. This groups tenant-wide administration actions before the history and
branding actions. The four buttons use the existing wrapping row.

Every opening takes the grid's currently selected role as its starting target,
not the role last used in the popup. This avoids accidentally reusing an older
target. After opening, the popup's Role selector is independent. Its prominent
**Management access applies to: [role name]** line names the affected role even
when a different role is highlighted in the grid behind it. Parent category,
Management access, Save grant and the saved grant query all use this popup target.
Controls wait for the target's grant to load before allowing a change.

## Preserved contents and safeguards

The existing panel is portalled into the same viewport-bounded, scrollable Radix
Dialog pattern as the deployment policy and audit history. Its one-line
explanation, Role selector, read-only parent category, checkbox, Save grant,
manager list, Your role marker, and conditional fallback warning retain their
wording. The inline panel is removed.

The existing grant/removal review confirmation still captures the target role and
decision. Removing the authenticated user's own role still shows the existing
self-lockout warning. The server still decides eligibility and last-manager
protection. The popup does not add authority or bypass an existing check.

Today changing the grid role with unsaved menu, Company Forms or deployment
override edits opens **Discard unsaved permission changes?**. Keep editing
retains all three groups; Discard and change role resets them and selects the
requested grid role. This is unchanged. Opening this popup, or changing its
independent Role selector, neither changes the grid role nor discards grid edits,
so neither requires that grid-discard confirmation.

Grant saving still uses the same management endpoint and server audit writer.
There are no controller, policy, audit-capture, schema, migration or business-data
changes.

## Verification

The main-preview verification script is
`scripts/verify-deployment-policy-dialog.mjs --management`. It uses the existing
Admin development persona, blocks every API mutation, displays the live management
state, checks independent selection and captures desktop and 390 px screenshots.
It is not normal parent-SSO verification. The `before --management` and
`after --management` modes compare all development public-table row counts and
content fingerprints and column definitions.

The isolated browser integration test in
`tests/integration/company-form-combined-grid-browser.test.ts` routes all actual
API requests to the registered test backend/database. It captures the normal
state, Your role marker, grant confirmation and own-role removal warning at
desktop and narrow widths, saves a grant, and verifies its frozen server audit
identity, affected-role name, permission label, time and before/after values. It
also verifies a dirty grid survives independent popup selection, reopening resets
to the grid role, and switching the grid role still asks for confirmation.
The fallback scenario is arranged only in the isolated test database; affected
role flags, grant values and category readiness are restored in a finally block.

Automated fixtures exist only in the isolated test database and are normally
cleaned up; append-only audit history is retained. No development fixtures or
grants are created or modified.

## Closing gates

- Focused checks: **26 passed / zero failed**.
- Full suite: **2,280 passed / 162 failed / 67 pending**.
- All 101 discovered Company Forms files: **717 passed / zero failed / zero
  skipped**.
- TypeScript: **222 diagnostics**, with none in the changed TypeScript files.

The full suite remains within the agreed ceiling, not fully green. Commit and
post-commit backend start times, closing screenshots, and the post-restart
development-integrity result are reported with the delivery.
