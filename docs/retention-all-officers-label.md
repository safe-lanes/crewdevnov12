# All Officers retention-band label

## Scope and preflight

The Dashboard Crew Retention tile now reads **All Officers**. Admin > KPIs
reads the same label from its existing catalogue; no KPI-screen save/render
logic changes are required. The Dashboard drilldown title inherits the tile's
label. Its explanatory hover and accessible description remain unchanged:
“Measures all officers, including senior officers, following TMSA 3.4.”

Migration `0272_retention_all_officers_label.sql` was first prepared at
`.local/verification/all-officers/0272_retention_all_officers_label.sql.pending`,
outside the scanned migrations directory. Only after the read-only preflight
passed was the identical SQL added to `migrations/`.

Preflight found exactly one matching catalogue component:

| Field | Before | After |
|---|---|---|
| Label | Officers | All Officers |
| Component UUID | `74360000-0000-4000-8000-000000000012` | unchanged |
| KPI UUID | `74360000-0000-4000-8000-000000000001` | unchanged |
| Stable code | `officers` | unchanged |
| Ordering | 2 | unchanged |

The idempotent migration only updates this label. It refuses an unexpected
missing/duplicate/unrecognized catalogue entry. It neither updates targets nor
rewrites historical audit entries. Applied historical migrations are untouched.

## Frozen audit labels

The existing server capture already freezes `details.componentLabel` into each
target-change event. Existing events continue to say **Officers**; new saves
capture **All Officers**. Audit presentation/export reads the frozen label,
not the current catalogue. Preflight found one development audit entry with
the old component label.

The new integration regression writes a target with the old label, runs the
actual migration twice, proves complete target rows and the old audit event
unchanged, then saves another target and checks the new label. The isolated
browser evidence likewise captures an old-label save through the screen,
replays the migration, shows the updated KPI editor, then makes a new-label
save and shows both audit sentences. These saves do not use development data.

## Other occurrences — reported, not changed

| Location | Finding |
|---|---|
| Training & Retention > Retention (`client/src/modules/training-retention/components/Retention.tsx`) | No Officers-band label exists there. It calculates one result for the chosen rank filters, not the Dashboard's three named bands. |
| Reports (`client/src/pages/ReportsPage.tsx`, `client/src/components/reports/`, `server/v2/reports/`) | No Officers retention-band display label found. Existing report handlers were not aligned or changed. |
| Exports | Historical Access audit CSV sentences retain the frozen Officers label. No separate retention-band export label was found. |
| Dashboard help text (`CrewRetentionMetrics.tsx:269,325–326`) | Existing lower-case “all officers, including senior officers” explanation preserved exactly, as requested. |
| `docs/admin-kpi-settings.md:12,115–118` | The component table and deliberate-overlap explanation still call the band Officers. Left unchanged for the user's decision. |
| `docs/dashboard-kpi-comparisons.md:43` | The deliberate-overlap paragraph still calls the band Officers. Left unchanged. |
| Historical migration `0270_kpi_targets.sql:69` | Immutable seed still says Officers; the new migration upgrades it. |
| Tests and audit examples | Old-label states remain where needed to prove legacy frozen history. They are not a second live catalogue. |

Unrelated rank categories, vessel officer-matrix groups, “Senior Officers” and
job titles containing Officers are not this retention band and were not renamed.

## Evidence and permitted development writes

Evidence is retained under ignored `generated-artifacts/retention-band-label/`.
`scripts/retention-band-label-evidence.mjs --before` captured all 275 public
tables and schema definitions in a read-only transaction. Its post-upgrade run
requires **exactly** these differences:

1. One `kpi_components` row changes only `label` from Officers to All Officers.
2. One `schema_migrations` row records the new filename.

It checks the component's entire remaining row, every other catalogue row,
all old migration rows, every target row, the complete audit-table fingerprint,
all other public tables, columns and constraints. It refuses any unexpected
difference. No development grants, targets, fixture users, roles or audit events
are created for screenshots.

## Closing gates — 17-Nov-2026

- Focused KPI migration/audit and Dashboard card tests: 38 passed.
- Full suite: 2,388 passed, 162 failed, 67 pending. No new assertion failures
  versus the previous baseline. This is not a green full suite.
- The full run had an additional Company Forms fixture-cleanup deadlock after
  that suite's four assertions passed. The dedicated serialized Company Forms
  gate was therefore run separately: all 103 discovered suites present,
  740 passed, zero failures, skipped or missing tests. No assertion or timeout
  was weakened, and no unrelated cleanup implementation was changed.
- TypeScript: 222 diagnostics.
- Both isolated browser journeys passed. Screenshots show the Dashboard and
  KPI editor label, a frozen old-label audit sentence and a new-label sentence.
  Successful responses were real, not mocked.
- Screenshots use isolated synthetic test personas/data, not an authenticated
  main-preview session. That latter signed-in UI path is **NOT VERIFIED**.

The final development write proof is produced after the post-commit backend
restart by `node scripts/retention-band-label-evidence.mjs`. Any difference
outside the two permitted writes blocks completion.
