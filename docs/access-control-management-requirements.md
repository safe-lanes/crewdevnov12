# Access Control management and recovery

Management is the explicit `access_control/manage` resource/action decision stored
against the stable parent role UUID. It grants no Company Forms or navigation
CRUD permissions. Company Forms categories and all six independent actions retain
their existing meanings.

## Trusted principal and exact interim predicate

The server must resolve the authenticated JWT ID to a persisted master user,
assert its user type matches, and resolve exactly one active, non-deleted role.
An eligible role also belongs to the parent mirror (`parent_owned=true`) and has
at least one persisted trusted master user with a nonempty user type whose role
resolves uniquely to that UUID.
Management-holder counts use these eligible parent roles, not browser identities
or role names. Ambiguous active names, unknown roles and inactive roles fail closed.
Grants may be provisioned to structurally active parent roles before users are
assigned. A stored allowed grant without a resolvable trusted principal does
not count as an eligible manager or disable the applicable recovery route.

The interim name route requires **all** of:
1. Successful trusted actor/role resolution to an eligible parent role.
2. Tenant-wide parent SAIL Admin category readiness is **false**.
3. The count of active eligible parent roles with an allowed management decision is **zero**.
4. The resolved parent role name, trimmed and lowercased, is exactly `admin`,
   `super admin`, or `sail admin` (the original whitelist).

Any eligible manager immediately disables this name route on the API and screen.
During bootstrap support can grant management to its own parent UUID first,
then grant the client. Each grant is audited. Granting only the client means
ungranted named support immediately loses its name-based Access Control access.
Support's explicit grant is revocable under precisely the same last-manager rule.

## Category readiness and replacement

The current upstream contract has no explicit tenant capability signal. Therefore
authoritative evidence is a **successfully completed configured parent role
synchronization snapshot** supplying at least one non-deleted parent role with
explicit trimmed/lowercase `roletype = sail admin`. That establishes the
tenant-wide persisted readiness flag, database timestamp and source/UUID evidence
in the same transaction as synchronization. The flag never resets: removing or
deactivating support roles, an incomplete mirror or missing categories must not
reactivate names. A rejected snapshot does not establish readiness.

After this switch a role merely *named* Sail Admin is not support. At zero
eligible managers, only an eligible role with the explicit parent SAIL Admin
category can use recovery authority. Explicit management grants continue to work
for any parent role category/name. Support recovery remains zero-manager-only,
so it cannot override last-manager protection.

The incremental upgrade treats existing legacy mirror rows as parent-owned;
new local role creation is unclassified and non-parent-owned. Local roles cannot
invent a category or support principal. Access Control rejects category aliases,
parent provenance, authority metadata, timestamp fields and audit identities,
including nested fields and `auditUserUuid`; categories are read-only in the UI.
Only the configured upstream synchronization supplies parent provenance/category.

## Last-manager protection and completed parent snapshots

Every Access Control write and parent role-sync transaction acquires the same
database-local advisory transaction lock. Writes re-resolve the authenticated
editor **after** obtaining that lock. Revocation, deletion or deactivation taking
a positive eligible-manager count to zero is refused and rolled back, including
support editing its own last grant and concurrent edits to different managers.
A queued editor revoked before acquiring the lock cannot complete a write.
Every serialized Access Control write also preserves a real trusted recovery
principal when the manager count is already zero. This covers renaming,
deactivation, deletion and creation that makes the final recovery name ambiguous.
Renaming the sole manager without updating its trusted parent-user mapping is
refused: its UUID alone is not evidence that anyone can authenticate for it.

Parent sync is authoritative and reconciles a complete snapshot without
truncating the mirror or dependent forms. It preserves UUID-keyed grant decisions
and append-only history. Removal/deactivation of the last holder makes its
retained allowed decision ineffective immediately upon commit. At zero managers
the applicable recovery route above becomes active; management is **not**
automatically granted. No temporary empty table exposes fallback mid-sync.

The configured Sync All endpoint commits parent users and roles arrays as one
identity snapshot under this lock. Both arrays are required; if either is missing,
neither mapping is changed. Recovery rejection also rolls back master-user
mappings, not just the role mirror, so a partially accepted user rename cannot
destroy the supposedly preserved recovery route. Existing parent user
reconciliation semantics (no removal without a lifecycle field) remain unchanged.
Absent parent-owned roles are authoritative removals. Locally created
`parent_owned=false` roles and their grants are not parent omissions and survive
the completed parent refresh.

An otherwise zero-manager snapshot must leave at least one eligible recovery
role whose name resolves uniquely and which matches a persisted master user with
a nonempty trusted user type. Before readiness that role must be whitelisted;
after readiness it must have the explicit parent SAIL Admin category. A snapshot
with neither an eligible manager nor such a trusted recovery principal is
rejected atomically; the old state remains. A distinctly labelled
`parent_sync_rejected` event is recorded after rollback with the authenticated
source, proposed counts/recovery outcome and rejection reason.

## Audit

Actual grant differences (menu CRUD, Company Forms, management) are recorded
inside the same transaction as the write. Before `null` means no stored decision,
and is not silently displayed as false. Equal stored values create no records.
Failure rolls back both grants and success audit records. Actor identity is
server-derived, and timestamp is database-generated; history cannot be updated,
deleted or truncated. UUID history survives role rename/removal/reconciliation.

Parent eligibility transitions use `parent_sync_management_eligibility`, with
affected UUIDs, unchanged stored management decisions, eligibility before/after,
holder counts, source identity, timestamp and recovery outcome. These events
are **not grant revocations**. An unchanged refresh creates no eligibility-loss
event. Readiness transitions have their own parent-sync event.

Authorized managers and zero-manager recovery actors can see the current state
and audit history with explicit Management, Void completed and Parent sync filters.
The currently returned history window is the latest 500 matching events.
