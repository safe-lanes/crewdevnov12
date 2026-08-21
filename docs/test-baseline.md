# Certified Test Baseline

**Captured:** 21-Aug-2026 (fresh full run: `npm test`)
**Compared with initial capture:** 23-Jul-2026, commit `d85774cb`
**Companion to:** `docs/tsc-baseline.md`

## Certification rule

> A failing suite belongs in this baseline only when its expectation is stale
> against intentional current behavior. A suite that exposes incorrect
> application behavior must not be certified; it blocks the task that found it.

This baseline covers the `npm test` Vitest command. The Vitest configuration
excludes `tests/e2e/**/*`; those Playwright suites are exercised by
`npm run test:e2e`, not counted here.

## Certified result

| Metric | Result |
|---|---|
| Test files | **50 total — 37 passing / 13 known-stale failing** |
| Tests | **732 total — 607 passing / 125 known-stale failing** |

The target for future work is no new failures in the 37 passing suites and no
new failing suites. The 13 failures below have been reviewed against Git
history; their assertions are stale rather than evidence of a current product
defect.

## Current suite inventory

The “23-Jul status” column says whether the suite existed in the initial
capture, and, if so, whether it was certified passing or already known stale.

| Suite | Current status | 23-Jul status |
|---|---|---|
| `tests/integration/api/accounts-reports.test.ts` | Passing (10) | Certified passing |
| `tests/integration/api/accounts-ship-access.test.ts` | Passing (36) | Not present |
| `tests/integration/api/accounts.test.ts` | Passing (9) | Certified passing |
| `tests/integration/api/approval-identity.test.ts` | Passing (8) | Not present |
| `tests/integration/api/contract-detail.test.ts` | Passing (15) | Not present |
| `tests/integration/api/crew-finance.test.ts` | Passing (16) | Certified passing |
| `tests/integration/api/crew-members.test.ts` | Failing (3 failed, 13 passed) | Known-stale failing |
| `tests/integration/api/ctm-carry-forward.test.ts` | Passing (6) | Not present |
| `tests/integration/api/drug-alcohol.test.ts` | Failing (13 failed, 4 passed) | Known-stale failing |
| `tests/integration/api/forms.test.ts` | Failing (9 failed, 11 passed) | Known-stale failing |
| `tests/integration/api/portage-auto-lock.test.ts` | Failing (1 failed, 4 passed) | Not present |
| `tests/integration/api/promotions.test.ts` | Failing (10 failed, 20 passed) | Known-stale failing |
| `tests/integration/api/recruitment.test.ts` | Failing (13 failed, 3 passed) | Known-stale failing |
| `tests/integration/api/reports.test.ts` | Passing (3) | Not present |
| `tests/integration/api/rest-hours.test.ts` | Failing (12 failed, 7 passed) | Known-stale failing |
| `tests/integration/api/rotation.test.ts` | Failing (9 failed, 3 passed) | Known-stale failing |
| `tests/integration/api/ship-reference-reads.test.ts` | Passing (19) | Not present |
| `tests/integration/api/vessel-initiated-workflow.test.ts` | Passing (14) | Not present |
| `tests/integration/api/vessel-portage-category-grids.test.ts` | Passing (15) | Not present |
| `tests/integration/api/vessel-portage.test.ts` | Passing (19) | Certified passing |
| `tests/integration/api/wage-engine-settlement-skip.test.ts` | Passing (5) | Not present |
| `tests/integration/api/wage-engine.test.ts` | Passing (35) | Certified passing |
| `tests/unit/access-control-admin-policy.test.ts` | Passing (5) | Not present |
| `tests/unit/access-control-my-permissions.test.ts` | Passing (2) | Not present |
| `tests/unit/accounts-ship-route-inventory.test.ts` | Passing (6) | Not present |
| `tests/unit/api-not-found.test.ts` | Passing (4) | Not present |
| `tests/unit/business-logic/compliance-engine.test.ts` | Passing (6) | Certified passing |
| `tests/unit/business-logic/date-joined-rules.test.ts` | Passing (21) | Certified passing |
| `tests/unit/business-logic/experience-calculations.test.ts` | Passing (8) | Certified passing |
| `tests/unit/business-logic/violations.test.ts` | Passing (10) | Certified passing |
| `tests/unit/forms-permission-route-inventory.test.ts` | Passing (3) | Not present |
| `tests/unit/modules/accounts/accounts-page-routing.test.ts` | Passing (7) | Not present |
| `tests/unit/modules/accounts/accounts-tenant-scoping.test.ts` | Passing (10) | Certified passing |
| `tests/unit/modules/accounts/engagements-scale-resolution.test.ts` | Passing (16) | Certified passing |
| `tests/unit/modules/accounts/missing-engagement-warning.test.ts` | Passing (9) | Not present |
| `tests/unit/modules/accounts/seniority-anchor-warning.test.ts` | Passing (10) | Not present |
| `tests/unit/modules/crew-pool/crew-import.test.ts` | Failing (1 failed, 2 passed) | Certified passing |
| `tests/unit/modules/crew-pool/crew-pool-validation.test.ts` | Failing (2 failed, 23 passed) | Known-stale failing |
| `tests/unit/modules/drugs-alcohol/drug-alcohol-testing.test.ts` | Failing (19 failed, 9 passed) | Known-stale failing |
| `tests/unit/modules/promotions/promotion-workflow.test.ts` | Passing (34) | Certified passing |
| `tests/unit/modules/recruitment/recruitment-validation.test.ts` | Failing (25 failed) | Known-stale failing |
| `tests/unit/modules/rotation/rotation-planning.test.ts` | Passing (22) | Certified passing |
| `tests/unit/modules/vessel/officer-matrix-coc.test.ts` | Passing (31) | Certified passing |
| `tests/unit/modules/vessel/vessel-management.test.ts` | Failing (8 failed, 20 passed) | Known-stale failing |
| `tests/unit/production-auth-wiring.test.ts` | Passing (1) | Not present |
| `tests/unit/role-resolution-and-permission.test.ts` | Passing (14) | Not present |
| `tests/unit/utils/crew-mapping.test.ts` | Passing (13) | Certified passing |
| `tests/unit/utils/date-utils.test.ts` | Passing (14) | Certified passing |
| `tests/unit/utils/email-service.test.ts` | Passing (2) | Certified passing |
| `tests/unit/wage-engine-period-math.test.ts` | Passing (30) | Certified passing |

## Failing-suite history and certification

| Suite | 23-Jul classification | Current cause / history |
|---|---|---|
| `tests/integration/api/crew-members.test.ts` | Already known stale | Legacy write/member-detail endpoints were removed; current failures remain on that old surface. |
| `tests/integration/api/drug-alcohol.test.ts` | Already known stale | Legacy `/api/drug-alcohol-tests` routes remain removed in favor of V2 routes. |
| `tests/integration/api/forms.test.ts` | Already known stale | Legacy `/api/appraisals` assertions target the removed non-V2 route. |
| `tests/integration/api/portage-auto-lock.test.ts` | Not present | Added after the initial capture. Its single stale assertion expects a missing API route to return SPA HTML. Commit `877c204f` correctly introduced JSON 404 handling for unmatched `/api` routes, so the response body is now an object. |
| `tests/integration/api/promotions.test.ts` | Already known stale | Legacy promotion-hierarchy route assertions remain stale after the V2 migration. |
| `tests/integration/api/recruitment.test.ts` | Already known stale | Legacy recruitment-candidate route assertions remain stale after the V2 migration. |
| `tests/integration/api/rest-hours.test.ts` | Already known stale | Legacy rest-hours route assertions remain stale after the V2 migration. |
| `tests/integration/api/rotation.test.ts` | Already known stale | Legacy rotation-plan route assertions remain stale after the V2 migration. |
| `tests/unit/modules/crew-pool/crew-import.test.ts` | **Certified passing** | **Started failing after the baseline.** Commit `3573d17a` (“Import row size”, 17-Aug-2026) raised the default generated-template range from 5,000 to 30,000 rows and made attachment formulas physical per-row cells. The former fixed 30-second unit-test timeout is therefore stale; the test must eventually set an intentional performance budget or a smaller test-only row limit. |
| `tests/unit/modules/crew-pool/crew-pool-validation.test.ts` | Already known stale | The two assertions still require vessel fields intentionally made optional for unassigned crew. |
| `tests/unit/modules/drugs-alcohol/drug-alcohol-testing.test.ts` | Already known stale | The deleted `insertDrugAlcoholTestRecordSchema` export is still expected by the test. |
| `tests/unit/modules/recruitment/recruitment-validation.test.ts` | Already known stale | The deleted `insertRecruitmentCandidateSchema` export is still expected by the test. |
| `tests/unit/modules/vessel/vessel-management.test.ts` | Already known stale | The deleted `insertVesselDraftSchema` export is still expected by the test. |

### Baseline-green suites that fail now

Only `tests/unit/modules/crew-pool/crew-import.test.ts` was green in the
23-Jul baseline and fails now. The breaking behavior was introduced by
`3573d17a` on 17-Aug-2026, which intentionally expanded the default workbook
from 5,000 to 30,000 rows. The test’s old timeout, not the generated workbook
feature, is what is stale.

## Phase 2 — `frm_sections` ownership guard

Before any service writes an `frm_sections` row, it must verify that the form
owning `form_part_uuid` is the same form owning `form_version_uuid`. A mismatch
must fail with a clear error. This cannot be enforced by a foreign key because
`adm_form_versions_v2` links to its form through a numeric ID rather than a
stable form UUID.

## History

- 23-Jul-2026 (`d85774cb`): initial capture — 30 suites, 19 passing and 11
  known stale.
- 29-Jul-2026: prior re-certification — 40 suites, 29 passing and 11 known
  stale.
- 21-Aug-2026: re-certified after a fresh 50-suite Vitest run. All 13 current
  failures are stale expectations as documented above.

## How to verify

```bash
npm test
# Certified result: Test Files 13 failed | 37 passed (50)
#                   Tests 125 failed | 607 passed (732)
```

Integration tests require the app running on :5000 (`npm run dev` / the
"Start application" workflow).
