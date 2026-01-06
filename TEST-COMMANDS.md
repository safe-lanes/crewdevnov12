# Test Suite Commands Reference

## Quick Reference

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm test` | Run unit + integration tests | Daily development |
| `npm run test:all` | Run ALL tests (unit + integration + E2E) | Before deployment |
| `npm run test:report` | Generate unified HTML report | After running tests |
| `npm run test:e2e` | Run E2E tests only | Browser workflow testing |

---

## Detailed Command Reference

### Core Test Commands

#### `npm test` or `npm run test`
Runs all Vitest tests (unit + integration).
- **Speed**: Fast (~5-10 seconds)
- **Output**: Console results + JSON to `test-results/results.json`
- **Use case**: Regular development cycle

#### `npm run test:all`
Runs ALL tests: Unit + Integration (Vitest) + E2E (Playwright).
- **Speed**: Slower (starts dev server, runs browser tests)
- **Output**: Combined results for unified report
- **Use case**: Pre-deployment verification, CI/CD pipelines

#### `npm run test:report`
Generates the unified interactive HTML report.
- **Output**: `test-results/index.html`
- **Features**: 
  - Dashboard with pass/fail metrics
  - Coverage visualization (if available)
  - Regression detection
  - Search/filter/export
  - Clickable test details
- **Includes**: Both Vitest and Playwright results

---

### Category-Specific Commands

#### `npm run test:unit`
Runs only unit tests from `tests/unit/`.
```bash
npm run test:unit
```

#### `npm run test:integration`
Runs only integration tests from `tests/integration/`.
```bash
npm run test:integration
```

#### `npm run test:e2e`
Runs only E2E tests using Playwright.
- Starts dev server automatically
- Runs browser-based tests
```bash
npm run test:e2e
```

#### `npm run test:e2e:headed`
Runs E2E tests with visible browser window.
```bash
npm run test:e2e:headed
```

#### `npm run test:e2e:debug`
Runs E2E tests in debug mode (step through).
```bash
npm run test:e2e:debug
```

---

### Development Commands

#### `npm run test:watch`
Runs tests in watch mode (re-runs on file changes).
```bash
npm run test:watch
```

#### `npm run test:ui`
Opens Vitest's interactive UI dashboard.
```bash
npm run test:ui
```

#### `npm run test:failed`
Runs tests and stops on first failure.
```bash
npm run test:failed
```

---

### Coverage Commands

#### `npm run test:coverage`
Runs tests with code coverage collection.
```bash
npm run test:coverage
```
- Output: `coverage/` directory with HTML report
- View: Open `coverage/index.html` in browser

---

### Report Commands

#### `npm run test:report`
Generates the unified HTML report from latest results.
```bash
npm run test:report
```

#### `npm run test:view-report`
Starts a local server to view the report.
```bash
npm run test:view-report
```
Then open: http://localhost:4173

---

## Recommended Workflows

### Daily Development
```bash
npm test                 # Run unit + integration
npm run test:report      # Generate report
```

### Before Commit
```bash
npm run test:all         # Run ALL tests including E2E
npm run test:report      # Generate unified report
```

### Pre-Deployment (CI/CD)
```bash
npm run test:all         # All tests must pass
npm run test:report      # Check for regressions
# Exit code 0 = safe to deploy
# Exit code 1 = regressions detected, blocked
```

### Debugging Failures
```bash
npm run test:watch       # Watch mode for quick iteration
npm run test:e2e:debug   # Step through E2E tests
npm run test:ui          # Interactive Vitest UI
```

---

## Output Files

| File | Description |
|------|-------------|
| `test-results/index.html` | Unified interactive report |
| `test-results/results.json` | Vitest JSON results |
| `test-results/junit.xml` | JUnit format (CI tools) |
| `test-results/playwright-results.json` | E2E test results |
| `test-results/playwright-report/` | Detailed Playwright HTML report |
| `test-results/baseline.json` | Regression detection baseline |
| `coverage/` | Code coverage reports |

---

## Regression Detection

The test suite includes smart regression detection:

- **True Regressions**: Tests that previously passed but now fail
  - **Action**: BLOCKS deployment
  
- **New Tests**: Tests not in the baseline
  - **Action**: Informational only, does NOT block

To reset the baseline:
```bash
rm test-results/baseline.json
npm run test:report
```

---

## Test File Locations

```
tests/
├── unit/           # Unit tests (fast, isolated)
├── integration/    # Integration tests (API, database)
├── e2e/            # E2E tests (Playwright, browser)
├── helpers/        # Test utilities
└── setup.ts        # Test configuration
```
