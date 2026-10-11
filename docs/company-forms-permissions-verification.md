# Access Control management update

The historical whitelist statement below describes the earlier verification
only. Access Control management now uses an explicit UUID-keyed grant with the
narrow zero-eligible-manager interim fallback. See
[management requirements](access-control-management-requirements.md) for the
exact trusted predicate, readiness switch and recovery rules, and
[management verification](access-control-management-verification.md) for current
test counts and main-preview evidence. Company Forms operational rules are unchanged.

# Company Forms independent permissions

## Delivered policy

Access Control stores six independent Company Forms decisions per parent role UUID:
View, Fill in, Witness, Sign as Company Representative, Void, and Void completed.
Navigation and Forms Configuration permissions remain separate.

Runtime enforcement uses the trusted persisted category and vessel membership.
Office actors operate across tenant vessels. Vessel/Ship actors remain within
their own vessels; a Representative grant never lets them sign as Company
Representative. Vessel Management signing retains pinned roles, own-vessel
scope, actual signer identity and the existing narrow late-signature exception.
Explicit SAIL Admin category actors can read with View but cannot operate or
sign, regardless of grants. Unknown/contradictory categories fail closed.
The parent developers still need to supply the explicit support category;
an Office role named “Sail Admin” is not treated as that category.

Fill in controls starting, drafts, submission and removal. Removal requires
that the authenticated actor signed the signature or is its recorded witness.
Submitted sections never permit removal. Signing has its own exact-type
authorization and does not require Fill in.

Void authority is checked against the actual locked submission status.
Completion while a void waits therefore switches to the Void completed grant,
not the grant appropriate to the earlier observed status.

## Upgrade and ordering

The catalogue/storage commit preceded the additive upgrade/report commit.
The upgrade was applied before the trusted runtime cutover. Thus the migration
did not leave a commit where runtime demanded grants that had not been seeded.

The original development upgrade report covers **53 roles and 318 decisions**:
`docs/company-forms-permission-upgrade-report.csv`.
View inherits relevant legacy View, Fill in inherits Edit (not Create), and
Office Witness/Representative/Void inherit Edit. Vessel effective scoped
read/fill/witness remain available; Vessel void is not inherited.
All upgrade-seeded Void completed decisions are off. Fresh tenants receive the
catalogue with operational decisions off; fresh/upgrade identity is captured
before the migration chain runs. Re-runs preserve administrator decisions.

The additional idempotent migration preserves UUID-keyed decisions across
parent role-mirror replacement. Runtime still requires the active trusted role;
retained decisions cannot authorize a missing role.

## Closing checks

- Entire discovered Company Forms/submission/shared authoring and rendering
  area: **58 test files, 381 passed, zero skipped or pending**.
- Full suite: **1,274 tests; 1,046 passed, 161 failed, 67 pending**.
  This is within the agreed 162-failure/67-pending limits, not a green suite.
- Read-only compiler-host comparison against the task starting sources:
  **226 baseline/current diagnostics; none introduced**.
- Real row-lock races cover both an in-progress Void grant becoming insufficient
  after completion, and a completed-void grant becoming sufficient after the
  locked status changes. Self-contained private fixtures replace dependence on
  missing ignored journals or retained operational records.

## Main-preview evidence

`scripts/verify-company-form-permissions.mjs prepare` creates only clearly
test-owned development identities, a released definition and crew/assignment.
Those identities are registered in `docs/company-form-regression-fixtures.md`.
Operational actors have no Forms authoring or Access Control grants.

After the final commit, restart **Start application**, then run:

```
node scripts/verify-company-form-permissions.mjs --closing
```

The closing check records final HEAD, commit time and the actual managed
backend PID/start. It requires backend start later than commit and verifies
HEAD/PID stay unchanged during the journeys:

1. A completed declaration visibly names missing Void completed; the same
   actor's browser request receives 403.
2. An existing authorized administrator grants Void completed through the
   real Access Control UI. The same actor then voids that test-owned completed
   declaration through the real viewer (204, persisted voided status).
3. The administrator deliberately grants a test-owned Vessel role Representative
   through Access Control. Its real main-browser request is still refused
   with 403 naming the Office category; no signature or attachment is written.

Both temporary grants are restored to their original off state.
Evidence and screenshots are generated under
`.local/verification/company-permissions/`, including `preview-evidence.json`.
They are generated after final commit; no tracked source is edited afterwards.
No production changes, publishing, whitelist changes, role-name impersonation,
alternate server or unrelated CRUD changes are part of this work.
