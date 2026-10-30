# Audit permission-label capture and read-path diagnosis

## Diagnosis

Permission display labels were already derived from an in-memory action registry
when the readable audit popup was introduced. The deployment-override rename
changed the text, not the read query or lookup algorithm. There is no database
lookup per permission label.

The failure was intermittent: an unchanged, instrumented isolated browser run
passed its original five-second assertion. Initial history, searched history
and export HTTP requests took 1296.50, 1851.32 and 660.94 ms. There was also real
avoidable server work: every scanned row constructed two native Intl date
formatters, even when only twenty rows were returned. The fix reuses two UTC
formatters, preserving all date output, sentence search and pagination semantics.
It caches no events or names.

Tracing also found the browser fixture proxy forwarding Vite JavaScript paths
containing an `/api/` directory to the test backend. This mixed source-module
loading between two Vite servers. The proxy now forwards only URL paths starting
with `/api/`; source modules remain on the original frontend. A regression
assertion verifies every forwarded path is an actual API path.
No assertion, timeout, permission check or audit filter has been relaxed.

## Timing method and results

Historical source was replayed with read-only SQL against the same snapshot of
today's data. These are measured replays, not telemetry from those historical
deployment dates. The one-off benchmark and raw results are retained in
`.local/verification/audit-label-freeze/`.

| Implementation replay | Development, 362 rows | Isolated test database, 2089 rows |
| --- | ---: | ---: |
| Before sentence/label derivation existed | 8.21 ms | 9.54 ms |
| First readable-history implementation | 71.75 ms | 950.49 ms |
| Immediately before the deployment-override rename | 72.52 ms | 451.98 ms |
| Immediately after that rename | 71.25 ms | 399.71 ms |

The original endpoint returned at most 500 raw rows, without exact totals,
enriched names or full-history sentence search. The first two rows therefore
measure a functionality change, not the isolated cost of a label lookup.
The rename comparison does not show a regression caused by changing label text.
The first readable-history replay also paid cold query/formatter costs.

The post-fix comparison replayed both versions against the same newer snapshot:

| Same-workload comparison | Development, 362 rows | Test database, 2741 rows |
| --- | ---: | ---: |
| Pre-fix implementation | 66.07 ms | 634.04 ms |
| Reused date formatters | 12.65 ms | 129.22 ms |
| Pre-fix presentation work alone | 60.07 ms | 514.57 ms |
| Fixed presentation work alone | 2.03 ms | 13.19 ms |

These are single-run elapsed measurements, not percentile or production claims.
Subsequent screen-driven HTTP timings and final suite results are kept in the
verification report. The test database gains synthetic events between runs;
comparisons within a snapshot use identical records.

## Capture and export

`appendAudit` is the only production insert path into
`adm_access_control_audit`. All of its callers (grants, menu grants, policy,
overrides, branding and parent sync) now capture `liveAuditActionLabel` into a
text column in the same transaction as the change and its other audit facts.
The label comes from the canonical server display-label registry, not the browser
and not a possibly stale permission-catalogue label.

`auditActionLabel` prefers the stored snapshot. CSV exports two distinct fields:
the live registry label and the unchanged captured label. Spreadsheet escaping
still applies to both. Existing actor, role, before/after, details and timestamps
are not rewritten. Unknown legacy labels cannot be reconstructed honestly; NULL
labels continue to fall back to the live registry, not a guessed historical name.

## Migration preflight and legacy count

Before adding any active migration or editing watched server code:

- Took read-only counts/content fingerprints for all 271 public development
  tables, including the migration ledger.
- Inspected audit columns, table ownership, ledger and the append-only trigger.
- Verified that 0267/0268 were already applied and the new column was absent.
- Confirmed all 362 existing rows are compatible with adding nullable text;
  there is no new constraint requiring historical data changes.
- Prepared the SQL outside the active migration directory as a `.sql.pending`
  file. Only after the read-only checks passed was the identical file promoted
  to `migrations/0269_access_audit_permission_label.sql`.

The startup watcher applied 0269 after promotion. It adds one nullable column
and a column comment only. There is no UPDATE, DELETE or backfill and the
append-only trigger remains enabled. All 362 legacy development events fall
back, including 341 grant events and 7 training-override grant events.

Dropping the column after capture begins would destroy audit facts; the migration
itself documents that limitation, following 0267/0268.

## Verification

The isolated PostgreSQL tests capture a server label despite forged request
input, change the live registry label, and verify the frozen sentence/export
remain original while the separate live CSV column changes. They compare the
complete stored entry before/after the rename and verify subsequent events
capture the new label. Another test applies the migration twice to an existing
legacy row and proves only the new NULL column was added.

The browser test saves all three groups, verifies the stored label by SQL,
reads its sentence and exports CSV, then injects a real third-writer failure to
prove full rollback. It records API latency without increasing the five-second
assertion or any timeout. A unit regression prohibits per-row Intl construction.

Development acceptance is read-only. No new development fixture or audit event
is required. Schema migration adds the column and a ledger entry; these schema
and ledger changes must be distinguished from unchanged business records.

## Closing results, 30-Oct-2026

- Full suite: **2278 passed / 162 failed / 67 pending**, within the standing
  ceiling. This is not a claim that the entire repository is green.
- Company Forms: **716 passed / zero failed / zero skipped**, 101 files.
- TypeScript: **222 diagnostics**.
- Closing browser history/search/export requests: **223.27 / 184.90 / 203.06 ms**.
  All three returned 200; no source-module request was forwarded to the backend.
  The original five-second assertion and all timeouts remain unchanged.
- Isolated audit event 3199 stores actor `Atomic Verifier`, frozen fixture role
  `Atomic save browser 763af028`, `permission_display_label =
  Override deployment block`, and before/after `false → true`.
- Raw SQL compared all 271 public development tables. Every original column and
  every original migration-ledger entry has the same count and content
  fingerprint. For the audit comparison, only the newly added NULL column was
  omitted; for the ledger comparison, only the new 0269 record was omitted.
  There are no other exceptions, no development fixture writes and no audit
  row changes. All 362 existing audit rows still have NULL captured labels.
  The append-only trigger remains enabled.

The authorized database changes are exactly the new nullable column/comment and
the migration runner's ledger insertion. “No writes whatsoever” would therefore
be an inaccurate blanket claim; verified unchanged business/audit data is the
precise statement.
