# Access Control: settings layout and Save actions

**Current deployment override integration:** the final role-grid checkbox row is
now **Override deployment block**, saved atomically with menus and Company Forms.
The tenant policy is **Blocking Seafarer Deployment Policy**. See
[the current layout and wording inventory](access-control-deployment-block-grid.md).
The separate training permission card/button described below is historical.

**Current Company Forms layout:** Company Forms is now the final row of the
role grid, saved atomically with menu permissions by Save Changes. See
[the atomic role-save design](access-control-atomic-role-save.md).
The separate Company Forms card/button and three-save recommendation below
describe the preceding layout, not the current implementation. Training
compliance, tenant policy and Management grants remain as described below.

## Scope

Presentation and a client-side confirmation only. The permission grid and its
Save Changes footer precede Company Forms, Training compliance (the selected
role's override permission), Training compliance policy and Management grants.
The two operational permission cards stay together immediately after the grid;
tenant-wide policy and administration authority follow them. Their original
selected-role mounting keys and management-authority condition are retained.
Access audit history and Company PDF branding remain at the top.

Each training checkbox is beside its own heading, with its explanation on hover
or keyboard focus and retained for screen readers. The effect
line reflects the last saved response, not a draft checkbox selection; unsaved
selections are labelled. Loading/failure states never invent an effect.
Descriptions retain the separate Override training compliance permission and
refer to planned contract end, not an actual sign-off event.

Management grants shows its purpose, the existing grant controls, then a named
list of every role with a stored explicit true management grant. It no longer
shows the three status boxes or an eligible-manager count. The current user's
role is marked **Your role**, using the server-resolved role UUID rather than
the selected role, a name comparison or a browser identity claim.

The read-only state endpoint adds `explicitManagers` and `currentRoleId`; its
original authority fields still come from the unchanged `authorityFor` function.
The list comes from the existing tenant-local snapshot under its existing lock.
An explicit but currently unusable grant is still listed, not confused with an
empty grant list. Missing display data shows an unavailable message with Retry.

The warning strip appears only if **both** the server mode is `name_bootstrap`
and the returned explicit-grant list is present and empty. Category availability
is mentioned only inside that strip, when the category has not been supplied.
If an explicit grant exists, no fallback/category warning appears. The server
continues to decide fallback using eligible managers, so an unusable explicit
holder can leave the server's recovery route open without making the display
claim that no explicit grants exist. No recovery or eligibility rules changed.

Save grant opens a confirmation for both granting and removing management.
It names the role and freezes the selected role UUID and decision for that
confirmation. Cancel/Escape sends nothing. Confirm sends the existing
`{allowed: boolean}` request to the existing role-management endpoint.
Existing disabled controls, permission checks, last-manager protection, audit
capture and no-change suppression are unchanged.
Removing the server-identified current role adds a prominent self-lockout
warning to the existing confirmation; it does not add a client-side refusal.

## Named-list preview evidence

Run `node scripts/verify-management-role-list.mjs` for desktop and narrow-width
screenshots of the real named list and own-role removal confirmation. It uses an
existing authorised office development persona and cancels every confirmation.
All API mutations are blocked, and SQL is read-only.

The fallback screenshots are **browser response fixtures**, not proof that the
live tenant is in bootstrap. Only that browser's state GET is replaced with a
consistent empty explicit list and `name_bootstrap` response, and its selected
role management GETs return false. Normal-state GETs are unmodified. No roles,
grants, audit entries, category state or other development records are changed.

## What the five Save buttons save

| Button | Scope and saved values | Existing endpoint |
| --- | --- | --- |
| Save policy | Tenant-wide `blockExpiringDuringContract` and `blockMissingExpiry` training policy settings | `PUT /api/v2/admin/training-compliance/settings` |
| Save grant | Selected role's Access Control management decision | `PUT /api/v2/admin/access-control/roles/:ruid/management` |
| Save Company Forms permissions | Selected role's independent Company Forms operational grants | `PUT /api/v2/admin/access-control/roles/:ruid/action-permissions` |
| Save training compliance permission | Selected role's Override training compliance grant | `PUT /api/v2/admin/access-control/roles/:ruid/training-compliance` |
| Save Changes | Selected role's menu View/Create/Edit/Delete decisions in the main grid | Existing role-permissions save via `useSaveAccessControlPermissionsV2` |

## Recommendation only; not implemented

### Separate saves: current behaviour

All three selected-role sections have independent PUT endpoints:

- Grid: `/api/v2/admin/access-control/roles/:ruid/permissions`.
- Company Forms: `/api/v2/admin/access-control/roles/:ruid/action-permissions`.
- Training override: `/api/v2/admin/access-control/roles/:ruid/training-compliance`.

Each request has its own server transaction. One button that simply called all
three would still make three separate calls; it would not make them atomic.
A successful call stays committed if another fails, even if the browser sends
them concurrently.

Today a failed grid save shows the destructive toast “Failed to save
permissions. Please try again.” Company Forms shows “Unable to save Company
Forms permissions. Please retry.” Training override shows “Unable to save
training compliance permission. Please retry.” Those section errors do not
roll back another successful section, and the failed section retains its edits.
There is no combined-button behaviour today: a future non-atomic button would
need explicit per-section results, not an unconditional overall success.

Atomic saving needs a new combined server endpoint that validates all three
payloads and uses one tenant transaction, the existing trusted actor and locking,
permission checks, safeguards, change detection and audit writes. The existing
write logic would need transaction-aware composition, rather than three HTTP
calls or independently committed transactions. The client would also need
coordinated dirty state, errors and navigation warnings. None of that is changed
by this presentation task; all three Save buttons remain separate and unchanged.

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

## Role permission card wording and help

Company Forms explains viewing, filling in, witnessing, company signing,
voiding unfinished/completed forms and eligible checklist overrides. It states
that category and vessel access still limit the available forms/actions, and
that company-representative signing is limited to office roles.

Training compliance says: “Lets this role approve a deployment that training
rules would otherwise block — for example, when a seafarer is missing a
mandatory certificate.”

Each Company Forms checkbox has its own separate information button. Hover or
keyboard focus opens a tooltip; tapping opens a dismissible popover. Help never
toggles the adjacent checkbox. Exact help wording:

| Checkbox | Explanation |
| --- | --- |
| View | Allows this role to view Company Forms. |
| Fill in | Allows this role to fill in Company Forms. |
| Witness | Records a seafarer’s signature on their behalf, with the acting user’s own identity recorded as the witness. |
| Sign as Company Representative | Allows an office user to sign a Company Form in the company representative role. |
| Void | Allows this role to void a Company Form that has not been completed. |
| Void completed | Allows this role to void a Company Form that has already been completed. |
| Override checklist | Allows this role to override unresolved mandatory or failed/pending checklist checks. It does not allow overriding unfinished required forms. |

`scripts/verify-role-permission-panels.mjs` captures the repositioned cards,
grid and all four ambiguous-label explanations at desktop and narrow widths.
It reuses an existing office development persona, uses real GET responses,
blocks every API mutation and does not create fixtures or change grants.

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
