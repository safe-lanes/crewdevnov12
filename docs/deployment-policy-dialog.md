# Blocking Seafarer Deployment popup

## Presentation-only scope

Access Control's top action row opens the existing policy component in the same
Radix Dialog pattern as Access audit history: outline button, dismissible overlay,
viewport-bounded width and scrollable content. The trigger retains the original
`accessControlManagement` visibility condition. No settings/controller, permission,
transaction, lockout, audit capture, migration or schema code changes.

Both original checkbox headings, hover explanations, saved-effect lines,
unsaved-selection messages, load/retry handling, save/error handling and Save policy
button remain unchanged. Saving still uses
`PUT /api/v2/admin/training-compliance/settings`; role-grid Save Changes remains
independent. Closing does not save.

The row uses its existing `flex-wrap`. The actual checked-out row had two buttons:
Access audit history and Company PDF branding. Adding the requested button makes
three, not four. No unspecified fourth action was invented. At 390 px they stack
within the viewport; the existing grid keeps its own horizontal scroll.

## Evidence and development-data isolation

`scripts/verify-deployment-policy-dialog.mjs` uses the existing Admin development
persona in the main preview. All API mutations are blocked. It captures the row
and body with no inline panel, and both settings in the popup, at 1500 px and
390 px. This is not normal parent-SSO verification.

The existing isolated browser integration test
`tests/integration/company-form-combined-grid-browser.test.ts` uses the same UI
with every actual API request routed to the guarded test backend and registered
test database. It saves both settings through the popup, checks both saved effects,
and asserts the two existing `training_setting_changed` audit records contain
server-derived actor identity, frozen name and permission label, timestamp, and
different before/after values. It restores the isolated policy through the screen.
Screenshots include desktop and narrow saved-popup states. No development setting
is changed for evidence.

The read-only verification script's `before` and `after` modes compare counts and
content fingerprints of every public table plus the column catalogue. This covers
business data, settings, audit events and migration ledger without exceptions.

## Management grants: recommendation only

Moving Management grants into a dialog would work cleanly. It is a tenant-wide
management facility, but its edit controls affect an individual role. It already
has its own Role selector, which currently shares selection with the grid. The
panel does not technically need to remain visible while the grid is visible.

Retain that explicit role selector and clearly identify the affected role in the
dialog. Preserve the existing unsaved-grid-edits confirmation when switching roles,
the grant review confirmation, read-only parent category, manager list, recovery
information and last-manager protection. The shared selection is the awkward part:
a dialog must not silently discard pending grid edits or leave users unclear which
role a management grant will affect. Recommendation: use the same popup pattern,
keeping the explicit role selector and all existing confirmations. Not implemented.

## Gate evidence

Closing full suite: **2,278 passed / 162 failed / 67 pending**. Company Forms:
**716 passed / zero failed / zero skipped**, with all 101 discovered files
present. TypeScript: **222 diagnostics**. The full repository suite is not green;
it is within the agreed failure ceiling.

The expanded browser test passes the original atomic-save and rollback assertions
as well as popup policy saving, audit capture, restoration and wrapping checks.
No assertion or timeout was relaxed. Its exact request inventory now additionally
includes the two intentional policy save/restoration requests.

Runtime identifiers and the post-restart development-integrity comparison are
reported with the delivery and the generated review report.
