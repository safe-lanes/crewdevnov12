# Access audit history read performance

The failing browser run took 4,715 ms for initial history and 4,751 ms
for the fixture-role search. Its 339 entries were the filtered result,
not the total size of the table. At the captured 13,867-row cutoff, the
expected entry was sixth unfiltered and second after searching.

A read-only replay of the old reader made 56 database calls per request:

| Request | Query, transfer and decoding | Sentence formatting | Text matching | Total |
| --- | ---: | ---: | ---: | ---: |
| Initial page | 2,284 ms | 61 ms | 2 ms | 2,351 ms |
| Fixture role | 2,258 ms | 63 ms | 59 ms | 2,384 ms |

The new reader uses one SQL statement for an exact count, filters and
page; the visible sentences and CSV fields still use the existing
presenter. Search uses literal case-insensitive substrings of the full
sentence, not token or key matching. An explicit CSV export omits the
page limit. Exact counts, broad substring searches and exports still
have work proportional to their match sets.

Migration 0275 adds a derived trigram search index for complete frozen
sentences. Migration 0276 adds derived portions of menu sentences,
leaving the live menu name first and the captured menu name as fallback.
Neither updates the original audit rows. Rows missing necessary captured
facts continue through database-side live presentation at read time.
The SQL and TypeScript sentence renderers must be changed together if
the search wording changes; the old-reader compatibility test protects
that contract.

## Isolated benchmark

Run `npx tsx scripts/benchmark-access-audit.ts` while the registered
test database still holds the original benchmark fixture. It clones a
test-only snapshot at the failed run's audit-ID cutoff into a private
transaction, measures five samples, expands the same mix of audit rows
to 100,000 synthetic rows, and rolls back the transaction at the end.
Timings include the PostgreSQL call and application response assembly,
not HTTP or browser rendering. They are not a production latency SLA.

| Rows | Request | Matches | Median | Maximum |
| ---: | --- | ---: | ---: | ---: |
| 13,867 | Initial page | 13,867 | 67 ms | 83 ms |
| 13,867 | Fixture-role search | 339 | 94 ms | 115 ms |
| 13,867 | Broad sentence search | 13,529 | 105 ms | 117 ms |
| 100,000 | Initial page | 100,000 | 286 ms | 306 ms |
| 100,000 | Fixture-role search | 2,373 | 624 ms | 690 ms |
| 100,000 | Broad sentence search | 97,510 | 784 ms | 807 ms |

On the 13,867-row snapshot, 332 rows had a fully materialized sentence,
11,120 had materialized menu sentence parts, and 2,415 needed the live
fallback. The 100,000-row fixture retained 19,320 fully live-fallback
rows. Each paginated request returned 20 rows.

The audit table rejects `UPDATE`, `DELETE` and `TRUNCATE` under its
append-only trigger. Test teardown removes operational fixtures, not that
trail. The guarded `npm run test:reset` is the supported way to clear it:
it recreates only the registered test database, registers the new database
identity, reapplies migrations and seeds synthetic data. This task did
not reset the test database.
