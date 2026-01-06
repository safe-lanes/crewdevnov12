# Testing Guide

This document explains how to run tests, understand the regression detection system, and interpret test reports.

## Quick Start

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests with visual UI
npm run test:ui

# Run with coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── fixtures/                   # Test data
│   ├── crew-members.ts
│   ├── rest-hours.ts
│   ├── vessels.ts
│   └── forms.ts
├── helpers/                    # Utility functions
│   ├── api-helpers.ts
│   ├── database-helpers.ts
│   ├── assertion-helpers.ts
│   ├── regression-detector.js
│   ├── generate-report.js
│   └── deployment-check.js
├── unit/                       # Unit tests
│   ├── business-logic/
│   └── utils/
├── integration/                # API tests
│   └── api/
└── e2e/                        # End-to-end tests
```

## Regression Detection System

### How It Works

The regression detection system distinguishes between:

1. **TRUE REGRESSIONS** - Tests that were passing before but now fail
   - These BLOCK deployment
   - Indicate existing functionality is broken

2. **NEW FEATURE TESTS** - Tests that didn't exist in the baseline
   - These DON'T block deployment
   - Inform about new features being developed

### Detection Logic

```
If test exists in baseline AND was passing AND now fails → TRUE REGRESSION ❌
If test doesn't exist in baseline → NEW FEATURE TEST ℹ️ (not a regression)
Only TRUE REGRESSIONS block deployment
```

### Baseline

- Created automatically on first test run
- Updated when all tests pass
- Stored in `test-results/baseline.json`

## Generated Reports

After each test run:

| File | Description |
|------|-------------|
| `test-results/index.html` | Visual test report |
| `test-results/results.json` | Machine-readable results |
| `test-results/junit.xml` | CI/CD compatible format |
| `coverage/index.html` | Code coverage report |
| `test-results/REGRESSIONS.md` | Regressions (blocks deploy) |
| `test-results/NEW-FEATURES.md` | New tests (informational) |
| `test-results/FAILURES.md` | All failures with action items |
| `test-logs/test-run-*.log` | Detailed execution logs |

## Pre-Deployment Check

Before deploying, run:

```bash
npm run pre-deploy
```

This will:
1. Run all tests
2. Analyze results for regressions
3. Block deployment if TRUE regressions exist
4. Allow deployment if only NEW tests fail

### Deployment Decision Matrix

| Scenario | Deployment |
|----------|------------|
| All tests pass | ✅ Allowed |
| New tests fail (not in baseline) | ✅ Allowed (with warning) |
| Existing tests fail (were passing) | ❌ Blocked |
| Previously failing tests still fail | ✅ Allowed |

## Safety Check

Run safety checks before testing:

```bash
npm run safety-check
```

Verifies:
- Application code unchanged
- Dev script exists
- Test configuration present
- Tests directory exists
- App can start

## Test Types

### Unit Tests

Located in `tests/unit/`. Test isolated functions and logic.

```bash
npm run test:unit
```

Coverage includes:
- Violation detection
- Experience calculations
- Compliance engine
- Date utilities
- Crew mapping

### Integration Tests

Located in `tests/integration/`. Test API endpoints.

```bash
npm run test:integration
```

Coverage includes:
- Crew members API
- Rest hours API
- Forms/Appraisals API

### E2E Tests

Located in `tests/e2e/`. Test full user workflows.

```bash
npm run test:e2e
```

Coverage includes:
- Appraisal workflow
- Rest hours recording
- Crew management

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run all vitest tests |
| `npm run test:watch` | Watch mode |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:ui` | Visual test UI |
| `npm run test:coverage` | Generate coverage |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:e2e:headed` | E2E with browser visible |
| `npm run test:all` | All test types |
| `npm run pre-deploy` | Pre-deployment check |
| `npm run safety-check` | Verify app integrity |

## Interpreting Results

### Console Output

```
Running tests...
✅ 148 tests passed
❌ 2 tests failed

🔍 Regression Analysis:
  ⚠️  REGRESSIONS: 0
  ℹ️  NEW TESTS: 3 (informational)

✅ DEPLOYMENT ALLOWED
```

### REGRESSIONS.md

If this file exists, deployment is blocked. Contains:
- Which tests regressed
- Previous vs current status
- Failure details
- Action items

### NEW-FEATURES.md

Informational only. Contains:
- New tests detected
- Their pass/fail status
- Note that they don't block deployment

## Best Practices

1. **Always run tests before deploying**
   ```bash
   npm run pre-deploy
   ```

2. **Fix regressions immediately**
   - They indicate broken functionality
   - Don't ignore REGRESSIONS.md

3. **New feature test failures are OK temporarily**
   - They indicate work in progress
   - Fix them when the feature is ready

4. **Keep tests updated**
   - Add tests for new features
   - Update tests when requirements change

5. **Check coverage regularly**
   ```bash
   npm run test:coverage
   ```

## Troubleshooting

### Tests won't run

```bash
# Verify dependencies
npm install

# Check test config
cat vitest.config.ts
```

### E2E tests fail to start

```bash
# Install Playwright browsers
npx playwright install chromium
```

### Coverage not generating

```bash
# Run with coverage flag
npm run test:coverage
```

## History

Test history is stored in `test-results/history/` with daily snapshots for the last 30 days.
