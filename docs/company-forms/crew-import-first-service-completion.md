# Crew list import and first-service facts

## Delivered

1. An onboard crew-list assignment writes its current company sea-service row in Part E1, using the captured contract rank identifier, its vessel and sign-on date, with no to-date.
   - An exact existing company contract (same seafarer, vessel and from-date) is retained, not duplicated.
   - Overlapping company history with a different date is retained and reported for review. Unverified vessel references are handled conservatively, not matched by name.
   - Missing dates or an unverified contract rank are reported for review rather than guessed.
   - The import transaction does **not** calculate first-ever or first-in-rank.
2. After the import commits, a separate verified backfill checks the imported current onboard assignments. It can be re-run from the result screen using **Recheck first-service facts**, or by re-importing the same workbook.
   - Exactly one company-service row must identify the current contract; that row is excluded from prior-service calculations.
   - Earlier company service includes relief service. Rank identity uses identifiers, never name matching.
   - A missing or ambiguous current row leaves the facts unresolved with a reason.
   - Only verified-backfill values are recalculated. Sign-on captures, including unresolved captures, remain untouched.
   - Every recalculation, including an unchanged result, appends a server-derived actor, timestamp, phase, and before/after record to `crew_rule_history_backfill_history`.
   - Resolved requirement snapshots are never rewritten.
3. Part E1 renders the canonical rank as its master name without changing its stored identifier. An open current contract says **On board**, not a sign-off date; its stored to-date stays null.

## Evidence

- Main API: one workbook with three retained synthetic seafarers returned **CREATED**, **ALREADY_PRESENT**, and **REVIEW**. Repeating the workbook inserted no duplicate company-contract rows.
- The new seafarer initially returned first-ever **Yes** and first-in-rank **Yes**. After earlier company relief service was added, the separate recheck returned **No** for both.
- The same assignment's three recalculations (initial import, explicit recheck, repeat import) all appear in append-only history. The audit actor was derived from authenticated server identity. Browser-supplied audit identity was refused with HTTP 400.
- A direct backfill overwrite without the trusted transaction flag was refused with PostgreSQL `23514`; the verification transaction was rolled back.
- Actual resolution-harness requirements in retained isolated schemas keep first-ever **Yes** in `deciding_evidence.values` while their assignments' latest backfills show **No**. The integration test compares the entire requirement row before and after.
- Main preview, Part E1: canonical master rank name and **On board** are visible on the imported contract; raw SQL confirms `to_date IS NULL`.
- Synthetic main-workspace fixtures and isolated-schema fixtures, including failed setup attempts, are registered in `docs/company-form-regression-fixtures.md`. No fixture was hard-deleted.

## Reproducible verification

- `tests/integration/company-form-crew-import-backfill.test.ts`: six real-workbook/database cases covering creation, exact duplicate avoidance, overlap review, recalculation/frozen requirement, untouched sign-on captures, and unresolved current-contract identification.
- `tests/unit/company-form-import-sea-service-presentation.test.ts`: canonical display and unresolved-identifier protection.
- `scripts/verify-crew-import-first-service.mjs`: retained main-workspace import, recheck, audit and repeat-import evidence.
- `scripts/verify-crew-import-first-service-preview.mjs`: read-only closing preview; verifies backend start after HEAD and preserves both HEAD and the main process.
- Local reports: `.local/verification/crew-import-first-service/`. Closing HEAD, commit time and backend start are recorded **after this document's commit** in `closing-preview.json`.

## Closing gates

- Company Forms: **81 suites, 494 passed, zero failed, zero skipped**; ownership discovery covers every suite.
- Full suite: **1,217 passed, 161 failed, 67 pending** — within the standing ceiling, not an all-green claim.
- TypeScript: **222 diagnostics**, within the standing ceiling; the pre-existing baseline remains.
- Production build: **passed**.

## Step commits

- Step 1: `27f5fa3631817eb55fa4c78cccbb3c663c9c5907`, 2026-10-12 10:10:23 UTC.
- Step 2: `bdb5ed9092033fe5d6a9c36d510f0155adeb277c`, 2026-10-12 10:22:21 UTC.
- Step 3: the commit containing this completion record and closing evidence scripts; its final hash/time is reported separately.
