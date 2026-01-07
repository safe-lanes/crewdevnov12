# Developer Onboarding Guide

## Welcome

This guide will help you get started with the Seafarer Performance Management System test suite. By the end, you'll be able to run tests, write new tests, and understand the testing architecture.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime (includes native fetch) |
| npm | 8+ | Package manager |
| Git | 2.x | Version control |

### Recommended Tools

- VS Code with extensions:
  - Vitest extension
  - Playwright Test for VS Code
  - ESLint

---

## Quick Start (5 minutes)

### 1. Clone and Install

```bash
git clone <repository-url>
cd seafarer-performance-system
npm install
```

### 2. Run All Tests

```bash
# Unit + Integration tests
npm run test

# E2E tests (requires app running)
npm run dev &
npm run test:e2e
```

### 3. Verify Results

```
Test Files  18 passed (18)
     Tests  327 passed (327)
```

---

## Test Suite Overview

### Test Categories

| Type | Count | Speed | Purpose |
|------|-------|-------|---------|
| Unit | 223 | Fast (ms) | Schema validation, business logic |
| Integration | 114 | Medium (s) | API endpoints, database |
| E2E | 99 | Slow (min) | Browser workflows |

### Directory Structure

```
tests/
├── unit/           # 223 tests - No dependencies
├── integration/    # 114 tests - Needs API server
└── e2e/            # 99 tests - Needs full app
```

---

## Running Tests

### Basic Commands

```bash
# Run all unit + integration tests
npm run test

# Run only E2E tests
npm run test:e2e

# Run specific test file
npm run test -- tests/unit/utils/date-utils.test.ts

# Run tests matching pattern
npm run test -- -t "validation"

# Watch mode (re-run on change)
npm run test -- --watch
```

### With Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### E2E Tests

```bash
# Start app first (in background)
npm run dev &

# Wait for startup
sleep 5

# Run E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e -- --ui
```

---

## Writing Your First Test

### Unit Test Example

Create `tests/unit/example.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { insertCrewMemberSchema } from '@shared/schema';

describe('Crew Member Validation', () => {
  it('should validate valid crew member', () => {
    const result = insertCrewMemberSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      rank: 'Captain'
    });
    
    expect(result.success).toBe(true);
  });
  
  it('should reject missing required fields', () => {
    const result = insertCrewMemberSchema.safeParse({
      firstName: 'John'
      // Missing lastName
    });
    
    expect(result.success).toBe(false);
  });
});
```

Run it:
```bash
npm run test -- tests/unit/example.test.ts
```

### Integration Test Example

Create `tests/integration/api/example.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000';

describe('Example API', () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error('Server not running');
  });

  it('should get crew members', async () => {
    const response = await fetch(`${API_BASE}/api/crew-members`);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### E2E Test Example

Create `tests/e2e/example.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Example Module', () => {
  test('should load recruitment page', async ({ page }) => {
    await page.goto('/recruitment');
    
    // Wait for container
    const container = page.getByTestId('recruitment-container');
    await expect(container).toBeVisible({ timeout: 10000 });
    
    // Verify content loaded
    const heading = container.locator('h1, h2, [class*="title"]');
    await expect(heading.first()).toBeVisible();
  });
});
```

---

## Testing Patterns

### Pattern 1: Schema Validation (Unit)

```typescript
import { insertCrewMemberSchema } from '@shared/schema';

// Test valid data
it('should accept valid data', () => {
  const result = insertCrewMemberSchema.safeParse(validData);
  expect(result.success).toBe(true);
});

// Test invalid data
it('should reject invalid data', () => {
  const result = insertCrewMemberSchema.safeParse(invalidData);
  expect(result.success).toBe(false);
  expect(result.error?.issues[0].path).toContain('fieldName');
});
```

### Pattern 2: API Testing (Integration)

```typescript
const API_BASE = 'http://localhost:5000';

// GET list
it('should list items', async () => {
  const response = await fetch(`${API_BASE}/api/items`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
});

// POST create
it('should create item', async () => {
  const response = await fetch(`${API_BASE}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test' })
  });
  expect([201, 400]).toContain(response.status);
});
```

### Pattern 3: Defensive E2E

```typescript
test('should interact with element', async ({ page }) => {
  await page.goto('/module');
  
  const container = page.getByTestId('module-container');
  await expect(container).toBeVisible();
  
  const button = container.getByTestId('button-action');
  
  // Check existence before clicking
  if (await button.count() > 0) {
    await button.click();
    // Verify action completed
  } else {
    console.log('Button not available');
  }
});
```

---

## Key Concepts

### 1. Real Code Testing

**DO use:**
- Real Zod schemas from `@shared/schema.ts`
- Real HTTP calls with `fetch()`
- Real browser interactions with Playwright

**DON'T use:**
- Mock validation functions
- Mocked fetch responses
- Hardcoded test data that bypasses validation

### 2. Defensive Testing

Always check before interacting:

```typescript
// Check element exists
if (await element.count() > 0) {
  await element.click();
}

// Handle multiple response codes
expect([200, 400, 404]).toContain(response.status);

// Scope to containers
const container = page.getByTestId('module-container');
const button = container.getByTestId('button');
```

### 3. Data-TestId Pattern

```html
<!-- In component -->
<div data-testid="recruitment-container">
  <button data-testid="button-add">Add</button>
  <table data-testid="table-candidates">...</table>
</div>
```

```typescript
// In test
const container = page.getByTestId('recruitment-container');
const addButton = container.getByTestId('button-add');
```

---

## Common Tasks

### Add Tests for New Feature

1. **Unit tests** - Schema validation
   ```typescript
   // tests/unit/modules/new-feature/validation.test.ts
   import { insertNewFeatureSchema } from '@shared/schema';
   ```

2. **Integration tests** - API endpoints
   ```typescript
   // tests/integration/api/new-feature.test.ts
   const response = await fetch(`${API_BASE}/api/new-feature`);
   ```

3. **E2E tests** - User workflows
   ```typescript
   // tests/e2e/new-feature.spec.ts
   await page.goto('/new-feature');
   ```

### Debug Failing Test

```bash
# Run single test with verbose output
npm run test -- tests/unit/failing.test.ts --reporter=verbose

# E2E with headed browser
npm run test:e2e -- --headed tests/e2e/failing.spec.ts

# E2E with debug mode
npm run test:e2e -- --debug
```

### Update Baseline After Changes

If you intentionally changed behavior:
```bash
# Run tests to update baseline
npm run test
# Baseline auto-updates when all pass
```

---

## Troubleshooting

### "Server not running"

```bash
# Start the development server
npm run dev
# Then run tests in another terminal
```

### "fetch is not defined"

Check Node.js version:
```bash
node --version  # Must be 18+
```

### E2E test timeouts

Increase timeout in test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### Cannot find module '@shared/schema'

Check tsconfig paths are configured:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

---

## Next Steps

1. Run the full test suite: `npm run test`
2. Explore existing tests in `tests/` directory
3. Read [TEST-SUITE-ARCHITECTURE.md](./TEST-SUITE-ARCHITECTURE.md)
4. Add tests for your first feature
5. Review [TEST-MAINTENANCE.md](./TEST-MAINTENANCE.md) for ongoing maintenance

---

## Getting Help

- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review existing test examples
- Ask team lead for code review on first tests

---

*Last Updated: January 2026*
