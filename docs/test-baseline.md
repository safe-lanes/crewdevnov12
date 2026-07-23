# Certified Test Baseline

**Captured:** 23-Jul-2026 (fresh full run: `npx vitest run`)
**Companion to:** `docs/tsc-baseline.md` (220 errors / 40 files)

This document defines what "green" means for the test suite. Any task summary
should report new test failures relative to this baseline, the same way tsc
deltas are reported against the tsc baseline.

## Certified numbers

| Metric | Value |
|---|---|
| Test files | 30 total — **19 passing / 11 known-stale failing** |
| Tests | 524 total — **377 passing / 147 known-stale failing** |

**Target for every task: 0 new failing tests in the 19 passing suites, and no
new failing suites.** The 11 known-stale suites below are expected failures;
do NOT count them as regressions, and do NOT fix or delete them without a
platform-team decision.

## Passing suites (19) — must stay green

All unit suites not listed as stale, plus the live V2 integration suites,
including:

- `tests/integration/api/accounts.test.ts`
- `tests/integration/api/accounts-reports.test.ts`
- `tests/integration/api/crew-finance.test.ts`
- `tests/integration/api/wage-engine.test.ts` (34 tests)
- `tests/unit/modules/accounts/accounts-tenant-scoping.test.ts` (12 tests) —
  tenant-isolation guard for the accounts V2 ledger, engagements, and portage
  repositories. **Pilot-blocking coverage — must never be skipped or deleted.**
- `tests/unit/utils/email-service.test.ts`

## Known-stale failing suites (11) — expected failures

None of these indicate broken production code. They test the legacy pre-V2
API surface or schemas that were deliberately removed during the V2 migration.
The removed `/api/*` endpoints now fall through to the Vite catch-all, which
returns the frontend HTML with status 200, so every JSON assertion fails.
Pending a platform-team decision (delete vs. rewrite against `/api/v2/*`):

| Suite | Failing | Reason |
|---|---|---|
| `tests/unit/modules/recruitment/recruitment-validation.test.ts` | 25 | `insertRecruitmentCandidateSchema` deleted from `shared/schema.ts` |
| `tests/unit/modules/drugs-alcohol/drug-alcohol-testing.test.ts` | 19 | `insertDrugAlcoholTestRecordSchema` deleted |
| `tests/integration/api/forms.test.ts` | 17 | `/api/appraisals` removed (V2: `/api/v2/appraisals`) |
| `tests/integration/api/drug-alcohol.test.ts` | 16 | `/api/drug-alcohol-tests` removed (V2: `/api/v2/drugs-alcohol`) |
| `tests/integration/api/rest-hours.test.ts` | 15 | `/api/rest-hours-vessel-records` removed (V2: `/api/v2/rest-hours`) |
| `tests/integration/api/recruitment.test.ts` | 15 | `/api/recruitment-candidates` removed (V2: `/api/v2/recruitment`) |
| `tests/integration/api/promotions.test.ts` | 13 | `/api/promotion-hierarchies` removed (V2: `/api/v2/promotions`) |
| `tests/integration/api/rotation.test.ts` | 11 | `/api/rotation-plans` removed (V2: `/api/v2/rotation`) |
| `tests/unit/modules/vessel/vessel-management.test.ts` | 8 | `insertVesselDraftSchema` no longer exported |
| `tests/integration/api/crew-members.test.ts` | 6 | Only `GET /api/crew-members` remains; POST/PATCH/DELETE/GET-by-id removed |
| `tests/unit/modules/crew-pool/crew-pool-validation.test.ts` | 2 | Schema drift: `presentVessel`/`vesselType` deliberately made optional in `crew_members` ("not all crew are assigned to a vessel"); the two "reject missing" expectations are stale |

## History

- 23-Jul-2026: Initial capture. Prior state was 13 failing suites / 148
  failing tests. Two suites repaired to green:
  - `payruns-tenant-scoping.test.ts` (dead loader — imported the removed
    `payrunsService`) replaced by `accounts-tenant-scoping.test.ts`.
  - `email-service.test.ts` (test expected an en-dash in the subject; the
    template uses a hyphen — one-character test fix).

## How to verify

```bash
npx vitest run
# Green means: Test Files 11 failed | 19 passed (30); Tests 147 failed | 377 passed (524)
# Any failure count above these numbers, or any newly-failing suite, is a regression.
```

Integration tests require the app running on :5000 (`npm run dev` / the
"Start application" workflow).
