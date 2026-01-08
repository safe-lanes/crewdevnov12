# Test Suite Files Inventory

This document lists all files created for the automated test suite.

---

## Summary

| Category | Files | Tests |
|----------|-------|-------|
| Unit Tests | 11 | 223 |
| Integration Tests | 7 | 114 |
| E2E Tests | 12 | 99 |
| Fixtures | 4 | - |
| Helpers | 6 | - |
| Documentation | 6 | - |
| Scripts | 2 | - |
| Config | 2 | - |
| **Total** | **50** | **436** |

---

## Unit Tests (11 files, 223 tests)

### Business Logic Tests

| File | Tests | Purpose |
|------|-------|---------|
| `tests/unit/business-logic/compliance-engine.test.ts` | 6 | STCW compliance, work hour limits |
| `tests/unit/business-logic/experience-calculations.test.ts` | 8 | Sea time aggregation, promotion eligibility |
| `tests/unit/business-logic/violations.test.ts` | 12 | Violation detection, severity scoring |

### Utility Tests

| File | Tests | Purpose |
|------|-------|---------|
| `tests/unit/utils/crew-mapping.test.ts` | 13 | Data transformation, mapping functions |
| `tests/unit/utils/date-utils.test.ts` | 21 | Date formatting, time calculations |

### Module Validation Tests

| File | Tests | Schema Used |
|------|-------|-------------|
| `tests/unit/modules/crew-pool/crew-pool-validation.test.ts` | 25 | insertCrewMemberSchema |
| `tests/unit/modules/drugs-alcohol/drug-alcohol-testing.test.ts` | 28 | insertDrugAlcoholTestRecordSchema |
| `tests/unit/modules/promotions/promotion-workflow.test.ts` | 34 | insertPromotionHierarchySchema, insertPromotionFormSchema |
| `tests/unit/modules/recruitment/recruitment-validation.test.ts` | 25 | insertRecruitmentCandidateSchema |
| `tests/unit/modules/rotation/rotation-planning.test.ts` | 23 | insertVesselPlanningSchema |
| `tests/unit/modules/vessel/vessel-management.test.ts` | 28 | insertVesselDraftSchema, insertVesselPlanningSchema |

---

## Integration Tests (7 files, 114 tests)

All integration tests make real HTTP calls to the API (no mocks).

| File | Tests | API Endpoints |
|------|-------|---------------|
| `tests/integration/api/crew-members.test.ts` | 19 | /api/crew-members/* |
| `tests/integration/api/drug-alcohol.test.ts` | 21 | /api/drug-alcohol-tests/* |
| `tests/integration/api/forms.test.ts` | 24 | /api/forms/*, /api/rank-groups/* |
| `tests/integration/api/promotions.test.ts` | 17 | /api/promotion-hierarchies/*, /api/promotions/* |
| `tests/integration/api/recruitment.test.ts` | 22 | /api/recruitment/* |
| `tests/integration/api/rest-hours.test.ts` | 22 | /api/rest-hours/* |
| `tests/integration/api/rotation.test.ts` | 15 | /api/vessel-planning/* |

---

## E2E Tests (12 files, 99 tests)

All E2E tests use Playwright with defensive patterns (existence checks before interaction).

| File | Tests | Module Coverage |
|------|-------|-----------------|
| `tests/e2e/accounts-module.spec.ts` | 8 | User accounts, authentication |
| `tests/e2e/admin-module.spec.ts` | 12 | Admin settings, masters management |
| `tests/e2e/appraisal-workflow.spec.ts` | 10 | Appraisal creation, stage workflow |
| `tests/e2e/crew-management.spec.ts` | 9 | Crew pool, crew information |
| `tests/e2e/drugs-alcohol-comprehensive.spec.ts` | 8 | Drug & alcohol testing workflow |
| `tests/e2e/module-coverage.spec.ts` | 6 | Cross-module navigation |
| `tests/e2e/promotions-comprehensive.spec.ts` | 9 | Promotion hierarchy, reviews |
| `tests/e2e/recruitment-comprehensive.spec.ts` | 8 | Candidate management |
| `tests/e2e/reports-module.spec.ts` | 5 | Report generation |
| `tests/e2e/rest-hours-recording.spec.ts` | 10 | Rest hours recording, compliance |
| `tests/e2e/rotation-comprehensive.spec.ts` | 7 | Rotation planning |
| `tests/e2e/training-module.spec.ts` | 7 | Training matrix, requirements |

---

## Test Fixtures (4 files)

Reusable test data factories.

| File | Purpose |
|------|---------|
| `tests/fixtures/crew-members.ts` | Crew member test data |
| `tests/fixtures/forms.ts` | Form configuration test data |
| `tests/fixtures/rest-hours.ts` | Rest hours record test data |
| `tests/fixtures/vessels.ts` | Vessel test data |

---

## Test Helpers (6 files)

Utility functions and tools for testing.

| File | Purpose |
|------|---------|
| `tests/helpers/api-helpers.ts` | API request utilities |
| `tests/helpers/assertion-helpers.ts` | Custom assertions |
| `tests/helpers/database-helpers.ts` | Database utilities |
| `tests/helpers/deployment-check.cjs` | Pre-deployment validation (480 lines) |
| `tests/helpers/generate-report.cjs` | Test report generation |
| `tests/helpers/regression-detector.cjs` | Regression detection engine (480 lines) |

---

## Test Setup

| File | Purpose |
|------|---------|
| `tests/setup.ts` | Vitest global setup, test environment |

---

## Documentation (6 files)

| File | Purpose |
|------|---------|
| `docs/TEST-SUITE-ARCHITECTURE.md` | Complete technical architecture (556 lines) |
| `docs/MIGRATION-GUIDE.md` | Fork migration + test pattern migration (493 lines) |
| `docs/DEVELOPER-ONBOARDING.md` | Quick start for new developers |
| `docs/TEST-MAINTENANCE.md` | Maintenance procedures and schedules |
| `docs/TROUBLESHOOTING.md` | Common issues and solutions |
| `docs/TEST_IDS_REFERENCE.md` | All data-testid values for E2E tests |

---

## Migration Scripts (2 files)

| File | Platform | Purpose |
|------|----------|---------|
| `scripts/migrate-tests.sh` | Unix/Linux/Mac | Analyze test suite for real code patterns |
| `scripts/migrate-tests.ps1` | Windows | PowerShell version of migration analysis |

---

## Configuration Files (2 files)

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration for unit + integration tests |
| `playwright.config.ts` | Playwright configuration for E2E tests |

---

## Directory Structure

```
tests/
├── e2e/                          # 12 E2E test files
│   ├── accounts-module.spec.ts
│   ├── admin-module.spec.ts
│   ├── appraisal-workflow.spec.ts
│   ├── crew-management.spec.ts
│   ├── drugs-alcohol-comprehensive.spec.ts
│   ├── module-coverage.spec.ts
│   ├── promotions-comprehensive.spec.ts
│   ├── recruitment-comprehensive.spec.ts
│   ├── reports-module.spec.ts
│   ├── rest-hours-recording.spec.ts
│   ├── rotation-comprehensive.spec.ts
│   └── training-module.spec.ts
├── fixtures/                     # 4 fixture files
│   ├── crew-members.ts
│   ├── forms.ts
│   ├── rest-hours.ts
│   └── vessels.ts
├── helpers/                      # 6 helper files
│   ├── api-helpers.ts
│   ├── assertion-helpers.ts
│   ├── database-helpers.ts
│   ├── deployment-check.cjs
│   ├── generate-report.cjs
│   └── regression-detector.cjs
├── integration/
│   └── api/                      # 7 integration test files
│       ├── crew-members.test.ts
│       ├── drug-alcohol.test.ts
│       ├── forms.test.ts
│       ├── promotions.test.ts
│       ├── recruitment.test.ts
│       ├── rest-hours.test.ts
│       └── rotation.test.ts
├── unit/
│   ├── business-logic/           # 3 business logic test files
│   │   ├── compliance-engine.test.ts
│   │   ├── experience-calculations.test.ts
│   │   └── violations.test.ts
│   ├── modules/                  # 6 module validation test files
│   │   ├── crew-pool/
│   │   │   └── crew-pool-validation.test.ts
│   │   ├── drugs-alcohol/
│   │   │   └── drug-alcohol-testing.test.ts
│   │   ├── promotions/
│   │   │   └── promotion-workflow.test.ts
│   │   ├── recruitment/
│   │   │   └── recruitment-validation.test.ts
│   │   ├── rotation/
│   │   │   └── rotation-planning.test.ts
│   │   └── vessel/
│   │       └── vessel-management.test.ts
│   └── utils/                    # 2 utility test files
│       ├── crew-mapping.test.ts
│       └── date-utils.test.ts
└── setup.ts                      # Test setup file

docs/
├── TEST-SUITE-ARCHITECTURE.md
├── MIGRATION-GUIDE.md
├── DEVELOPER-ONBOARDING.md
├── TEST-MAINTENANCE.md
├── TROUBLESHOOTING.md
└── TEST_IDS_REFERENCE.md

scripts/
├── migrate-tests.sh
└── migrate-tests.ps1

# Root config files
vitest.config.ts
playwright.config.ts
```

---

## Quick Copy Command

To copy all test suite files to another fork:

```bash
cp -r tests scripts docs/TEST*.md docs/MIGRATION*.md docs/DEVELOPER*.md \
  docs/TROUBLESHOOTING.md vitest.config.ts playwright.config.ts /path/to/new-fork/
```
