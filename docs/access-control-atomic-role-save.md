# Company Forms in the role permission grid

## One save, one database outcome

The final grid row is **Company Forms**. Its label occupies Menu Name; a single
multi-select spans the four action columns (Select All is intentionally empty).
The closed control shows the first three selected labels plus `+N` if needed,
**None selected** for zero, or **All 7 permissions** for all seven.
Every option retains its previous hover/focus/tap help wording.

The old Company Forms card and its separate Save button are removed. Training
compliance remains below the grid with its original layout and independent Save.
The grid preserves its column alignment and scrolls horizontally on narrow
screens; its Company Forms popup fits the viewport.

## Atomic implementation

`PUT /api/v2/admin/access-control/roles/:ruid/combined-permissions`
accepts exactly:

```json
{
  "permissions": [
    {"menuId":"menu-uuid","canview":true,"cancreate":false,"canedit":false,"candelete":false}
  ],
  "companyFormGrants": {
    "view":true,"fill_in":true,"witness":false,"sign_representative":false,
    "void":false,"void_completed":false,"override_checklist":false
  }
}
```

- The route has the existing trusted Access Control management middleware.
- `writeCombinedRoleGrants` validates the complete payload and duplicate menu
  identifiers, then enters **one** existing `managedWrite` transaction.
- That transaction takes the existing tenant advisory lock, re-resolves the
  authenticated actor/authority, calls `writeMenuDecisions` and
  `writeActionDecisions` with the **same transaction and actor**, then runs the
  existing last-manager/recovery protections before commit.
- There are no internal HTTP calls and no independently committed or nested
  writer transactions. Any validation, eligibility, SQL or audit-write failure
  rolls back both permission groups and all their audit rows.
- The old separate endpoints remain compatible; they call the same
  transaction-scoped writers through their original transaction wrapper.
- Both Company Forms entry points share the same strict grant schema.
  Browser identity, category and timestamp fields are rejected.

There are no schema changes. The meanings and category/vessel constraints of
the seven permissions have not changed.

## Audit

Both paths still use the original `appendAudit`: server-resolved identity,
server time, frozen actor and affected-role names, resource/action and exact
before/after values. Company Forms uses `resource=company_forms` as before.
Unchanged decisions cause neither grant updates nor audit entries. Initial
explicit false decisions still record their previous absence as null.
No successful audit entry survives a failed combined transaction.

## Screen outcomes

The single Save Changes sends one combined request. Both groups must load
successfully first; failed loads show a plain explanation and Retry rather than
inventing false grants. Both groups are refetched after success.

A server refusal shows **Neither group was saved. Please retry.** Both drafts
remain available for retry. The previous success toast is dismissed before the
next save. If the network loses the response, the screen instead says:
**Unable to confirm the save. Your edits are kept; retry. Menu and Company Forms
permissions are saved together, never partly.**
This avoids claiming a rollback when a response may have been lost after commit.

Changing roles with unsaved edits asks before discarding either group. Role
changes and permission edits are disabled while saving.

## Evidence and isolation

- `tests/integration/access-control-management.test.ts` exercises combined
  success, no-change suppression, frozen names, ineligible targets, missing
  menus, denied editors, invalid maps, duplicate menus and spoofed identities.
  A PostgreSQL trigger raises an error in the second writer after menu writes;
  raw SQL proves that both groups and their audit return to the prior contents.
- `tests/integration/company-form-combined-grid-browser.test.ts` clicks the
  real screen, with all API calls routed to the registered isolated test
  backend. It saves both groups, injects an actual database failure, clicks
  Save again and compares raw SQL snapshots of both groups and audit entries.
  Synthetic roles, user and menu are removed by normal isolated-test teardown;
  immutable audit history retains its frozen identities, as designed.
  No development records are created or edited.
- `scripts/verify-company-form-grid.mjs` captures actual main-preview grants,
  dropdown and help on desktop and narrow viewports, using an existing office
  development persona. All API writes are blocked. It never saves settings.

Screenshots and machine-readable reports are outside Git under
`.local/verification/company-form-grid/`. Main-preview captures and test-database
save/rollback captures are explicitly labelled separately.
