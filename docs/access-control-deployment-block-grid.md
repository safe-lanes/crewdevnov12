# Deployment override in the role grid

## Current layout and save

The final two rows of the role grid are Company Forms and **Override deployment
block**. The latter has one checkbox centred across the four action columns,
not under View, Create, Edit or Delete: it is one independent grant, not a
CRUD action. An information button provides the same hover/focus tooltip and
tap popover pattern as Company Forms:

> Lets this role approve a deployment that training rules would otherwise block — for example a seafarer missing a mandatory certificate.

There is no separate training permission Save button. **Save Changes** calls
`PUT /api/v2/admin/access-control/roles/:ruid/combined-permissions` with
`permissions`, `companyFormGrants` and required boolean
`trainingComplianceAllowed`. All three use the same existing `managedWrite`
transaction, lock, authenticated actor and audit writer. Any rejection rolls
back all three groups and their audit entries. Invalid or missing boolean input
is refused before writes. The internal grant remains
`training_compliance / override`: no schema, stored grant or enforcement change.

All three role-bound drafts must finish loading before editing. Load failures
have Retry and disable Save; they never become invented false grants.
Failed saves retain all drafts. A server refusal says:
“None of the permission changes were saved. Please retry.”
An uncertain network response instead says the save cannot be confirmed.
The existing dirty-role-switch confirmation covers all three drafts.

The tenant's **Blocking Seafarer Deployment Policy** remains a separate setting,
with its existing Save policy action. It now opens from **Blocking Seafarer
Deployment**, immediately before Access audit history in the wrapping top action
row, instead of appearing below the grid. This does not change policy values.
See [popup verification](deployment-policy-dialog.md).

## Wording inventory

| Location | Wording changed |
|---|---|
| `client/src/modules/admin/AccessControlPage.tsx` | Final grid row, load/error text, three-group save and unsaved-edit explanation |
| `client/src/modules/vessel/components/TrainingComplianceAccessEditors.tsx` | Controlled checkbox and exact help, policy heading, policy descriptions naming the permission, policy loading/error accessibility text |
| `client/src/modules/vessel/components/ReliefStatusEditDialog_v2.tsx` | Missing-permission notice and request-override checkbox |
| `shared/v2/admin/accessAuditPresentation.ts` | Permission label, policy-setting labels matching the screen, policy/override event titles and override sentence |
| `server/v2/admin/controllers/trainingComplianceSettingsController.ts` | Malformed permission payload explanation |
| `server/v2/company-forms/checklistGate.ts` | Missing override permission refusal |
| `server/v2/shared/training-compliance/checklistPolicy.ts` | Gap explanation requiring the permission and a reason |
| `scripts/verify-training-checklist-browser.mjs` | Expected refusal wording |
| `docs/training-compliance-security.md`, `docs/access-audit-history.md` | Current permission and policy descriptions |
| `docs/access-control-settings-layout.md`, `docs/access-control-atomic-role-save.md` | Current-layout notices superseding the earlier separate control/save |

Both the audit history popup and CSV export consume the shared audit
presentation, through `AccessAuditHistory.tsx`, `accessAuditRead.ts` and
`shared/v2/admin/accessAuditExport.ts`. No separate CSV label replacement or
audit capture change is necessary. Tests assert the new sentence and CSV text.
Historical plans/evidence and immutable migration source retain the terminology
used when written; they are not live UI/help labels. Internal identifiers are
unchanged. The old catalogue label in existing databases is not rewritten;
the live permission row and audit/CSV presentation do not render that value.

## Historical audit entries

Audit capture now freezes the server's permission display label in
`permission_display_label`, alongside actor and affected-role names. Later label
changes do not change a frozen entry's sentence or detail heading. Legacy NULL
labels use the current display-label registry; they are not historically
backfilled. There is no alias note. See
[capture and timing evidence](access-audit-permission-label.md).

## Verification

The browser test uses main-preview frontend assets but routes every API request
to the registered isolated test database. It toggles menu View, Company Forms
Fill in and the deployment override together; verifies frozen audit identity
and before/after values; opens history and exports CSV using the new wording.
A real PostgreSQL trigger then refuses the third writer. Raw SQL proves all
three groups and every audit row equal the last successful snapshot.
Normal teardown removes synthetic operational rows; append-only audit history
is retained, never disabled or deleted.

`scripts/verify-company-form-grid.mjs` verifies the existing main-preview
persona read-only, blocks all API mutations, and captures both rows, hover/tap
help and the renamed policy. No main-preview fixture or grant is created.
