# Access Control: settings layout and Save actions

## Scope

Presentation and a client-side confirmation only. The permission grid and its
Save Changes footer precede Training compliance policy and Management grants.
Access audit history and Company PDF branding remain at the top.

Each training checkbox is beside its own heading and explanation. The effect
line reflects the last saved response, not a draft checkbox selection; unsaved
selections are labelled. Loading/failure states never invent an effect.
Descriptions retain the separate Override training compliance permission and
refer to planned contract end, not an actual sign-off event.

Management grants explains its purpose, usable explicit-manager role count,
temporary name-based recovery and parent-owned category. Zero usable managers
does not necessarily mean zero stored grants: a granted role without a usable
matching user is not an eligible manager. The parent category cannot be edited.
The recovery banner asks the operator to complete setup.

Save grant opens a confirmation for both granting and removing management.
It names the role and freezes the selected role UUID and decision for that
confirmation. Cancel/Escape sends nothing. Confirm sends the existing
`{allowed: boolean}` request to the existing role-management endpoint.
Existing disabled controls, permission checks, last-manager protection, audit
capture and no-change suppression are unchanged.

## What the five Save buttons save

| Button | Scope and saved values | Existing endpoint |
| --- | --- | --- |
| Save policy | Tenant-wide `blockExpiringDuringContract` and `blockMissingExpiry` training policy settings | `PUT /api/v2/admin/training-compliance/settings` |
| Save grant | Selected role's Access Control management decision | `PUT /api/v2/admin/access-control/roles/:ruid/management` |
| Save Company Forms permissions | Selected role's independent Company Forms operational grants | `PUT /api/v2/admin/access-control/roles/:ruid/action-permissions` |
| Save training compliance permission | Selected role's Override training compliance grant | `PUT /api/v2/admin/access-control/roles/:ruid/training-compliance` |
| Save Changes | Selected role's menu View/Create/Edit/Delete decisions in the main grid | Existing role-permissions save via `useSaveAccessControlPermissionsV2` |

## Recommendation only; not implemented

The three ordinary selected-role permission saves (menu grid, Company Forms
and training override) could become one **Save role permissions** action:
they configure operational permissions for the same selected role.

That should not simply fire three requests and report one success. A later
implementation needs either an atomic server operation with the same checks
or explicit per-group success/failure and retained unsaved edits. It also needs
one consistent dirty-state/navigation warning.

Keep **Save policy** separate: it changes the whole tenant, not the role.
Keep **Save grant** separate: it changes who can administer all Access Control
and requires the new explicit confirmation.

No buttons or save groups were consolidated in this change.

## Verification

Component tests exercise checkbox association and saved-effect wording, panel
order, both confirmation directions, cancellation, captured role/decision,
denied access and display of the unchanged server last-manager refusal.
Server integration tests retain their real permission/audit safeguards.

`scripts/verify-access-control-panels.mjs` reuses an existing office development
persona and existing roles. All API mutations are blocked. Real GET responses
drive both grant and removal dialogs, which are cancelled without saving.
Screenshots cover the desktop page/order, each panel, both confirmations,
and 402-pixel-wide panels/dialog. No fixtures or grants are created.
This is development-persona UI evidence, not parent sign-in verification.

Evidence is stored outside Git in `.local/verification/access-control-panels/`.
Read-only full-row fingerprints before and after verification cover every
public table, including the migration ledger. No schema or development-data
changes are required.
