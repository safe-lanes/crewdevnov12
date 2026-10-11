# Grant-based Access Control verification

## Implementation sequence

- Foundation (management, zero-manager authority, category sealing, serialized
  audited writes and client plumbing):
  `d3e4d0df88c0ece4801862d4ae01200b7cde0ba4`, 2026-10-09 05:24:02 UTC.
- Parent synchronization wiring and recovery/readiness requirements:
  `a5bd67bd8f6f90587e9d1f40ecb0793f28e4dfbc`, 2026-10-09 05:24:02 UTC.
- Regression and closing evidence drivers:
  `71522aed258f2c5c7bee86d8f2f4f2eb061c0965`, 2026-10-09 05:38:39 UTC.
- Existing-sidebar/audit selector correction:
  `5918ca23db7c6f5aad9569d4059d2e5effa761d2`, 2026-10-09 05:41:47 UTC.
- Navigation/identity-snapshot hardening:
  `60c2e706e73b170b1b24ca3060270610248ec914`, 2026-10-09 05:53:03 UTC.
- Final recoverability corrections: the full HEAD/time is recorded in
  `.local/verification/access-control-management/report.json` after the final
  managed-backend restart. No further source commit is made during that evidence.

The first two planned steps share foundational code; last-manager locking and
grant auditing were installed with management rather than exposing an unsafe
intermediate management endpoint. Parent synchronization was wired in the next
commit. These are implementation steps, not claims of completed closing evidence.

## Automated checks

- New Access Control plus policy/my-permissions area: 63 passed, 0 failed,
  0 pending (three files; `/tmp/task382-access.json`).
- Entire discovered Company Forms/shared area: 58 files, 381 passed, 0 failed,
  0 skipped. Discovery/report:
  `.local/verification/company-forms-all-tests-2026-10-09T06-03-26-901Z.json`.
- Full suite: 1,330 total; 1,102 passed, 161 failed, 67 pending.
  `/tmp/task382-full.json`. This suite is **not green**.
- Frontend build passed.
- TypeScript is **not green**: read-only comparison against the starting HEAD
  found 226 baseline diagnostics, 222 current diagnostics, zero introduced
  diagnostics. Existing errors remain. Comparator evidence:
  `.local/verification/signoff-typescript-comparison.json`.

Real-PostgreSQL regression tests use a disposable isolated schema and exercise
authority, support self/client bootstrap, last-manager protection and serialized
queued writes; trusted category readiness and its permanence; completed role
reconciliation, retained grants/history, unchanged refreshes, recovery rejection
and rollback; browser metadata rejection; audit atomicity/immutability; and
unchanged Company Forms category restrictions. No protected tenant fixtures
are deleted by these tests. Final corrections additionally cover sole-manager
self-rename, zero-manager recovery-role deletion/deactivation/rename and duplicate
creation, explicit-category recovery lockout, orphaned manager mappings,
parent identity rollback and survival of locally created roles/grants across
parent replacement.

## Actual gate and switch implementation

The **zero-manager gate** is
`server/v2/admin/services/accessControlManagement.ts`, function `authorityFor`,
lines **43–51**, specifically the `name_bootstrap` branch at **48–49**:
an eligible role from successful trusted resolution (including a real persisted
trusted principal), tenant category readiness
false, eligible management-holder count exactly zero, and normalized role name
in exactly `Admin`, `Super Admin`, `Sail Admin`. The trusted resolver call is
`accessControlAuthority`, lines **56–63**; absent/failed resolution passes no
role and cannot reach fallback. Explicit management is checked first, at **46**.
The category recovery replacement branch is **50–51**.

The **readiness switch** is
`server/v2/admin/services/accessControlParentSync.ts`, function
`roleSyncTransition`, lines **26–34**: after the complete trusted replacement
callback, query parent-owned, nondeleted roles for the explicitly supplied
normalized `roletype='sail admin'`; if readiness was previously false and the
category was supplied, persist it true with DB time, server-derived source and
role UUID evidence. There is no reset branch. This is authoritative completed
parent synchronization evidence, not a role-name heuristic, local category
assignment, browser flag or currently available explicit upstream capability.
The role reconciliation pins incoming parent ownership; Sync All commits
master-user mapping and role eligibility together to preserve real recovery
principals when a role snapshot is rejected.

Last-manager refusal is `protectLastManager`, management service **80–83**,
called after changes while still in `managedWrite`'s serialized transaction
(**85–98**), whose authority recheck is **88–89**. Snapshot eligibility at
**25–36** requires a persisted resolvable principal, so a sole-manager
self-rename cannot strand the user while leaving a misleading holder count.
The post-write zero-manager recovery-principal check at **94–95** also protects
bootstrap role deletion/deactivation/renaming and ambiguity-inducing creation.
Parent-sync loss/gain audit is the distinct
`parent_sync_management_eligibility` event at sync service **43–52**. It stores
the retained management decision separately from eligibility, full before/after
holder counts and recovery outcome. Zero-manager snapshots with no valid recovery
principal reject at **42**; the rolled-back state is preserved and a clearly
labelled `parent_sync_rejected` event is appended at **59–65**. An unchanged
refresh skips loss auditing at **46**.

## Main-preview evidence driver

`scripts/verify-access-control-management.mjs` uses the existing managed app at
the proxied development domain, authenticated development test actors and real
screen interactions. It never starts another web server or bypasses grant guards.
The existing trusted support actor bootstraps an explicit self-grant, grants the
test-only non-whitelisted manager, then revokes its own non-last grant through
the screen. The ordinary manager grants another test-owned role Company Forms
View, sees exact authenticated before/after audit, and receives a last-manager
refusal with the grant/audit unchanged.
Management-only users see Access Control but do not inherit navigation to
ungranted Admin pages, including a legacy page missing its menu catalogue record.

The parent-sync recovery portion uses
`scripts/verify-access-control-parent-sync.ts`, a **development-only fixture
harness**, not a live upstream integration. It runs the production parent-sync
transition transaction with a server-checked persisted initiating actor and
source explicitly labelled `trusted_parent_sync:development-fixture-harness`.
It deactivates **only the test-owned manager** while evaluating the complete
tenant role state. The live main backend then denies that role, exposes
zero-manager recovery to trusted support, and shows the distinct eligibility-loss
event without reporting the retained allowed decision as revoked.

The browser recovers support's explicit management through the actual screen,
then reactivates only the test-owned role through the guarded API. Final state
retains support plus the ordinary test manager, avoiding accidental lockout of
the existing support user. Protected parent names, categories and identities
remain unchanged; all permission changes have append-only audit. Test-owned
actors/roles are retained, not SQL-cleaned around the last-manager guard.

Preparation refuses to reset category readiness or remove existing management
decisions. Subsequent evidence runs reuse only this driver's retained test roles;
the existing support management grant must already authorize them. They revoke
and re-grant the test-only manager while support remains eligible, then revoke
support's non-last grant through the guarded screen. An already stored View
decision is cleared and re-granted through the screen (false → true), rather than
claiming it was missing. No run uses SQL grant cleanup or resets readiness.
The closing report records the final full HEAD/commit time, main backend PID/start
time and identical HEAD/PID at the end; `--closing` requires start after commit.
Screenshots and report are retained in
`.local/verification/access-control-management/`.
