# Test Maintenance Guide

## Overview

This guide covers ongoing maintenance tasks for the 436-test suite, including adding new tests, updating existing tests, managing test data, and handling regressions.

---

## Regular Maintenance Tasks

### Daily

| Task | Command | Purpose |
|------|---------|---------|
| Run full suite | `npm run test` | Catch regressions early |
| Check E2E | `npm run test:e2e` | Verify UI workflows |

### Weekly

| Task | Command | Purpose |
|------|---------|---------|
| Coverage check | `npm run test:coverage` | Ensure coverage maintained |
| Review failures | Check `test-results/` | Address flaky tests |

### Monthly

| Task | Action | Purpose |
|------|--------|---------|
| Audit test quality | Review test patterns | Ensure real code testing |
| Update baseline | Commit baseline.json | Track test evolution |
| Clean test data | Remove stale fixtures | Keep tests focused |

---

## Adding New Tests

### For New Features

1. **Create unit tests first**
   ```bash
   # Create test file
   touch tests/unit/modules/new-feature/validation.test.ts
   ```

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { insertNewFeatureSchema } from '@shared/schema';

   describe('New Feature Validation', () => {
     it('should validate required fields', () => {
       const result = insertNewFeatureSchema.safeParse({
         requiredField: 'value'
       });
       expect(result.success).toBe(true);
     });
   });
   ```

2. **Add integration tests**
   ```typescript
   // tests/integration/api/new-feature.test.ts
   const API_BASE = 'http://localhost:5000';

   describe('New Feature API', () => {
     it('should create new feature', async () => {
       const response = await fetch(`${API_BASE}/api/new-feature`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ requiredField: 'value' })
       });
       expect([201, 400]).toContain(response.status);
     });
   });
   ```

3. **Add E2E tests**
   ```typescript
   // tests/e2e/new-feature.spec.ts
   test('should complete new feature workflow', async ({ page }) => {
     await page.goto('/new-feature');
     // Test user workflow
   });
   ```

### Test Naming Conventions

```
tests/
├── unit/
│   └── modules/
│       └── feature-name/
│           └── feature-name-validation.test.ts
├── integration/
│   └── api/
│       └── feature-name.test.ts
└── e2e/
    └── feature-name-comprehensive.spec.ts
```

---

## Updating Existing Tests

### When Schema Changes

If a field is added/removed in `shared/schema.ts`:

1. **Find affected tests**
   ```bash
   grep -r "insertAffectedSchema" tests/
   ```

2. **Update test data**
   ```typescript
   // Before
   const data = { existingField: 'value' };
   
   // After - add new required field
   const data = { existingField: 'value', newField: 'required' };
   ```

3. **Run to verify**
   ```bash
   npm run test -- tests/unit/modules/affected/
   ```

### When API Changes

If endpoint path or response changes:

1. **Find affected tests**
   ```bash
   grep -r "/api/affected-endpoint" tests/
   ```

2. **Update endpoint/response handling**
   ```typescript
   // Before
   const response = await fetch(`${API_BASE}/api/old-path`);
   
   // After
   const response = await fetch(`${API_BASE}/api/new-path`);
   ```

3. **Update expected status codes if needed**
   ```typescript
   expect([200, 201]).toContain(response.status);
   ```

### When UI Changes

If data-testid or component structure changes:

1. **Update TEST_IDS_REFERENCE.md**

2. **Update E2E selectors**
   ```typescript
   // Before
   const button = page.getByTestId('old-button-id');
   
   // After
   const button = page.getByTestId('new-button-id');
   ```

3. **Run affected E2E tests**
   ```bash
   npm run test:e2e -- tests/e2e/affected.spec.ts
   ```

---

## Handling Test Failures

### Debugging Steps

1. **Identify failure type**
   ```bash
   npm run test 2>&1 | grep "FAIL"
   ```

2. **Run single failing test**
   ```bash
   npm run test -- tests/path/to/failing.test.ts --reporter=verbose
   ```

3. **For E2E failures**
   ```bash
   # Run with visible browser
   npm run test:e2e -- --headed tests/e2e/failing.spec.ts
   
   # Run with debug mode
   npm run test:e2e -- --debug
   ```

### Common Failure Causes

| Symptom | Cause | Solution |
|---------|-------|----------|
| "fetch is not defined" | Node < 18 | Upgrade Node.js |
| Connection refused | Server not running | Start `npm run dev` |
| Timeout | Slow/missing element | Increase timeout, check selector |
| Schema validation failed | Data structure changed | Update test data |
| 404 response | Endpoint changed | Update API path |

### Flaky Test Handling

If a test intermittently fails:

1. **Add retry**
   ```typescript
   test.describe('Flaky Module', () => {
     test.describe.configure({ retries: 2 });
     
     test('might be flaky', async ({ page }) => {
       // ...
     });
   });
   ```

2. **Add explicit waits**
   ```typescript
   await page.waitForLoadState('networkidle');
   await expect(element).toBeVisible({ timeout: 10000 });
   ```

3. **Use defensive patterns**
   ```typescript
   if (await element.count() > 0) {
     await element.click();
   }
   ```

---

## Regression Management

### Detecting Regressions

Regressions are automatically detected by comparing against baseline:

```bash
# Run tests and check for regressions
npm run test

# Check for regression report
cat test-results/REGRESSIONS.md
```

### Handling True Regressions

If `REGRESSIONS.md` is created:

1. **Review the report**
   ```bash
   cat test-results/REGRESSIONS.md
   ```

2. **Identify the cause**
   - Code change that broke expected behavior?
   - Test needs updating for intentional change?

3. **Fix the code or test**
   ```bash
   # Fix and re-run
   npm run test
   ```

4. **Verify regression resolved**
   - `REGRESSIONS.md` should be removed automatically

### Updating Baseline

When tests intentionally change:

```bash
# Run all tests
npm run test

# If all pass, baseline auto-updates
# Commit the updated baseline
git add test-results/baseline.json
git commit -m "Update test baseline for new feature"
```

---

## Test Data Management

### Fixtures Location

```
tests/fixtures/
├── crew-members.ts    # Crew test data
├── forms.ts           # Appraisal form data
├── rest-hours.ts      # Rest hours records
└── vessels.ts         # Vessel data
```

### Creating Fixtures

```typescript
// tests/fixtures/crew-members.ts
import { CrewMember } from '@shared/schema';

export const validCrewMember: Partial<CrewMember> = {
  firstName: 'John',
  lastName: 'Doe',
  rank: 'Captain',
  nationality: 'Philippines'
};

export const createCrewMember = (overrides = {}) => ({
  ...validCrewMember,
  ...overrides
});
```

### Using Fixtures

```typescript
import { createCrewMember } from '@fixtures/crew-members';

it('should validate crew member', () => {
  const data = createCrewMember({ rank: 'Chief Officer' });
  const result = schema.safeParse(data);
  expect(result.success).toBe(true);
});
```

---

## Coverage Maintenance

### Checking Coverage

```bash
npm run test:coverage
```

### Coverage Targets

| Type | Target | Current |
|------|--------|---------|
| Unit | 80% | 85%+ |
| Integration | 70% | 75%+ |
| E2E | 60% | 65%+ |

### Improving Coverage

1. **Find uncovered code**
   ```bash
   open coverage/index.html
   # Look for red (uncovered) lines
   ```

2. **Add targeted tests**
   ```typescript
   // Add test for uncovered function
   it('should handle edge case', () => {
     const result = uncoveredFunction(edgeCaseInput);
     expect(result).toBe(expectedOutput);
   });
   ```

---

## Performance Optimization

### Speeding Up Tests

1. **Run tests in parallel**
   ```bash
   npm run test -- --pool=threads
   ```

2. **Use `.skip` for slow tests during development**
   ```typescript
   it.skip('slow integration test', async () => {
     // Skipped during development
   });
   ```

3. **Run only affected tests**
   ```bash
   npm run test -- --changed
   ```

### E2E Performance

1. **Use `test.describe.parallel()` where possible**
   ```typescript
   test.describe.parallel('Independent tests', () => {
     test('test 1', async ({ page }) => {});
     test('test 2', async ({ page }) => {});
   });
   ```

2. **Reuse browser context**
   ```typescript
   test.beforeAll(async ({ browser }) => {
     const context = await browser.newContext();
     // Reuse context
   });
   ```

---

## CI/CD Integration

### Pre-commit Hook

```bash
# .husky/pre-commit
npm run test -- --changed
```

### Pre-push Hook

```bash
# .husky/pre-push
npm run test
node tests/helpers/deployment-check.cjs
```

### GitHub Actions

```yaml
- name: Run tests
  run: npm run test

- name: Check for regressions
  run: node tests/helpers/deployment-check.cjs
```

---

## Documentation Updates

When modifying tests, update:

1. **TEST_IDS_REFERENCE.md** - If data-testid changes
2. **TEST-SUITE-ARCHITECTURE.md** - If structure changes
3. **This file** - If maintenance procedures change

### Documentation Checklist

- [ ] Test counts updated
- [ ] New patterns documented
- [ ] Changed selectors noted
- [ ] Troubleshooting updated

---

## Quick Reference

### Commands Cheatsheet

```bash
# Run all tests
npm run test

# Run E2E
npm run test:e2e

# Single file
npm run test -- tests/path/to/file.test.ts

# Pattern match
npm run test -- -t "pattern"

# Watch mode
npm run test -- --watch

# Coverage
npm run test:coverage

# E2E headed
npm run test:e2e -- --headed

# E2E debug
npm run test:e2e -- --debug
```

### File Locations

| Purpose | Location |
|---------|----------|
| Unit tests | `tests/unit/` |
| Integration tests | `tests/integration/api/` |
| E2E tests | `tests/e2e/` |
| Fixtures | `tests/fixtures/` |
| Helpers | `tests/helpers/` |
| Results | `test-results/` |
| Coverage | `coverage/` |

---

*Last Updated: January 2026*
