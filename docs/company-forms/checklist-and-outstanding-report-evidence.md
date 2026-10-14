# Checklist gate and outstanding forms report

## Delivered behavior

- Explicit, default-deny Company Forms **Override checklist** grant.
- Every planning setter of checklist Yes uses the verified assignment and a
  parent-first transaction. The database rejects an unverified Yes write.
- Mandatory OUTSTANDING or STARTED forms must be completed. They cannot be
  overridden, even when an unresolved requirement or failed check also exists.
- Only unresolved mandatory requirements and pending/failed checks can be
  overridden, with the explicit grant and a written reason. The server supplies
  the audit identity and records the previous and resulting values.
- Reports → Company Forms → Outstanding forms has column filters, complete
  filtered Excel export, exact pinned form opening and check retry rows.
  Signed-off assignments remain included; cancelled assignments are excluded.
- Company Forms View opens this report without granting access to other
  reports. Vessel accounts remain limited to their trusted vessel scope.
- Stage windows separate Required forms, Other forms you can start and history.

## Main-preview browser evidence

The browser used the actual proxied main application with retained test
seafarers. No UI or API response was mocked, and no second preview server was
used. Source-module transport failures were retried against the same origin.
The evidence directory is `.local/verification/company-forms-checklist/`.
The signature and office files preserve earlier partial runs, including the
selector/navigation failure that stopped each run after its listed successful
segments. Those failures are not removed from the evidence. The later
vessel-only run verifies the corrected navigation; the closing run verifies
the saved completion and report after the final restart.

- `browser-required-completion.json`: mandatory SL01 refused checklist Yes by
  name; both the Company Representative and witnessed seafarer signatures saved;
  Submit completed the form and its requirement; checklist Yes then saved.
- `browser-office-evidence.json`: optional form permitted Yes; unresolved
  first-service facts refused ordinary Yes and accepted a reasoned override.
  A mixed OUTSTANDING/UNRESOLVED case offered no override and opened its exact
  SL01 form. The report included signed-off forms, downloaded Excel and retried
  a failed check through the screen.
- `browser.json`: a Company Forms View-only vessel actor opened the Reports
  screen, saw only the actor's vessel and opened its exact pinned form.
- `browser-closing.json`: reserved for the read-only closing journey after the
  final commit and managed restart. It records HEAD and backend process age and
  checks they remain unchanged during the journey.

## API, SQL and race evidence

- `api.json` and API verification log: grant boundaries, server audit-identity
  rejection, required/optional/unresolved cases, scoped report and pinned reads.
- `fixture-and-audit.json`: retained fixture graph and override audit rows.
  The first override records server-resolved master user 24, before false,
  after true, a server timestamp and the written reason.
- `race.log`: a real HTTPS checklist request waited behind the assignment lock.
  A newly inserted mandatory requirement under that lock caused refusal after
  release; a stale pre-check could not approve the checklist.
- `capture.log`: a failure before the original event was written remains a
  report row and can be retried using Fill in. Recovery records a FAILED event
  without reconstructing changed facts or creating requirements. If the
  deciding facts were never captured, the retry states this rather than
  pretending the check matched nothing.
- `readonly-evidence.json`: a pinned preview returned 200 with zero forms before
  and after; a foreign pinned form returned 403 despite a forged vessel claim.
  The cancelled-assignment filter returned zero report rows while 14,739
  cancelled requirement rows retained their outstanding/started/unresolved
  history in the test database.

All fixtures, partial preparations, submission descendants and audit references
are retained in `docs/company-form-regression-fixtures.md`.

## Seven-step commit record

| Step | HEAD | Commit time (UTC) |
|---|---|---|
| 1 | `26df0612320fbe24b95c2b80bc7311707307dd55` | 2026-10-12 15:18:53 |
| 2 | `5ce18289078d6767fa8e8107e7e64bf44cb473c0` | 2026-10-12 15:22:31 |
| 3 | `126b871557bcd86a85f7ec2a142625928aa6af5d` | 2026-10-12 15:27:26 |
| 4 | `1f7ed607de701b96bd6da78d4ba89214b2f17eb5` | 2026-10-12 15:37:40 |
| 5 | `71d9b7c749e41e5252a58e609895297830b14a83` | 2026-10-12 15:43:01 |
| 6 | `252be277a385e00278f0eb4857933580724e36d0` | 2026-10-12 15:47:52 |
| 7 | This evidence-and-regression commit; reported in the completion summary | See closing evidence |

## Standing gates

Final results:

- Company Forms: **85 suites, 512 passed, zero failures or skips**.
- Full suite: **1,235 passed, 161 failed, 67 pending**, within the approved
  failure/pending limits; this is not a claim that the whole suite is green.
- Unassignment regression suite: **37 passed, zero failed or pending**.
- TypeScript: **222 diagnostics**, within the approved ceiling.
- Production build: **passed**.

The gate artifacts are `company-suite.log`, `full-suite.json`,
`typescript-final.log` and `build-final.log` in the evidence directory.

The initial full run exposed legacy unassignment setup that directly inserted
checklist Yes without an assignment check and used an unbacked/mismatched token.
The fixtures now leave checklist completion unclaimed and use a retained parent
Office actor for planning writes. The legacy incumbent-reconciliation endpoint
retains its existing separate Admin-token test contract; its authorization was
not changed by this feature. The tests continue to assert cancellation,
assignment provenance, field clearing and server-derived planning audit identity.
