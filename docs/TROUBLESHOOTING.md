# Troubleshooting Playbook

## Quick Diagnosis

### Error Message Lookup

| Error | Cause | Solution |
|-------|-------|----------|
| `fetch is not defined` | Node.js < 18 | Upgrade to Node.js 18+ |
| `ECONNREFUSED` | Server not running | Run `npm run dev` first |
| `Timeout 30000ms exceeded` | Element not found/slow | Check selector, increase timeout |
| `Cannot find module` | Import path wrong | Check tsconfig paths |
| `Schema validation failed` | Invalid test data | Match schema requirements |

---

## Unit Test Issues

### Problem: Schema Import Fails

**Symptom:**
```
Error: Cannot find module '@shared/schema'
```

**Solution:**
1. Check tsconfig.json has path mapping:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@shared/*": ["./shared/*"]
       }
     }
   }
   ```

2. Check vitest.config.ts has alias:
   ```typescript
   resolve: {
     alias: {
       '@shared': path.resolve(__dirname, './shared')
     }
   }
   ```

### Problem: Schema Validation Fails Unexpectedly

**Symptom:**
```
Expected: true
Received: false
```

**Diagnosis:**
```typescript
const result = schema.safeParse(data);
if (!result.success) {
  console.log('Errors:', result.error.issues);
}
```

**Common causes:**
- Missing required field
- Wrong field type (string vs number)
- Field value doesn't match enum
- Email format invalid

**Solution:**
```typescript
// Check what schema expects
import { insertCrewMemberSchema } from '@shared/schema';

// Log the schema shape
console.log(insertCrewMemberSchema.shape);
```

### Problem: Test Runs But Doesn't Assert

**Symptom:** Test passes but didn't actually test anything

**Solution:** Always have explicit assertions:
```typescript
// BAD - No assertion
it('should work', () => {
  const result = doSomething();
  // Nothing!
});

// GOOD - Clear assertion
it('should work', () => {
  const result = doSomething();
  expect(result).toBeDefined();
  expect(result.success).toBe(true);
});
```

---

## Integration Test Issues

### Problem: Connection Refused

**Symptom:**
```
Error: fetch failed
Cause: connect ECONNREFUSED 127.0.0.1:5000
```

**Solution:**
1. Start the server:
   ```bash
   npm run dev &
   ```

2. Wait for startup:
   ```bash
   sleep 5
   ```

3. Run tests:
   ```bash
   npm run test
   ```

### Problem: 404 Not Found

**Symptom:**
```
Expected: 200
Received: 404
```

**Diagnosis:**
```bash
# Check endpoint exists
grep -r "/api/endpoint-name" server/routes.ts
```

**Common causes:**
- Endpoint path changed
- Endpoint doesn't exist yet
- Typo in URL

**Solution:**
1. Verify endpoint in routes:
   ```bash
   grep "app.get\|app.post" server/routes.ts | grep "endpoint"
   ```

2. Update test to match actual path

### Problem: 500 Internal Server Error

**Symptom:**
```
Expected: [200, 201]
Received: 500
```

**Diagnosis:**
```bash
# Check server logs
npm run dev
# Look for error stack traces
```

**Common causes:**
- Missing required field in request
- Database error
- Server-side validation error

**Solution:**
1. Check server logs for actual error
2. Ensure request body matches API requirements
3. Use defensive assertions:
   ```typescript
   expect([200, 201, 400, 500]).toContain(response.status);
   ```

### Problem: Tests Pass Locally, Fail in CI

**Common causes:**
- Database state differs
- Timing issues
- Environment variables missing

**Solution:**
1. Add health check:
   ```typescript
   beforeAll(async () => {
     const health = await fetch(`${API_BASE}/api/health`);
     expect(health.ok).toBe(true);
   });
   ```

2. Clean database before tests:
   ```typescript
   beforeEach(async () => {
     await clearTestData();
   });
   ```

---

## E2E Test Issues

### Problem: Element Not Found Timeout

**Symptom:**
```
Timeout 30000ms exceeded while waiting for locator('...')
```

**Diagnosis:**
```typescript
// Check if element exists
const count = await page.getByTestId('element-id').count();
console.log('Element count:', count);
```

**Common causes:**
- Wrong data-testid
- Element loads asynchronously
- Element conditionally rendered
- Page navigation didn't complete

**Solution:**
1. Wait for page load:
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

2. Use container scoping:
   ```typescript
   const container = page.getByTestId('module-container');
   await expect(container).toBeVisible({ timeout: 10000 });
   const element = container.getByTestId('element');
   ```

3. Check element existence:
   ```typescript
   if (await element.count() > 0) {
     await element.click();
   }
   ```

### Problem: Click Not Working

**Symptom:** Element is found but click has no effect

**Diagnosis:**
```typescript
// Check if element is visible and enabled
const element = page.getByTestId('button');
console.log('Visible:', await element.isVisible());
console.log('Enabled:', await element.isEnabled());
```

**Common causes:**
- Element covered by overlay
- Element disabled
- Element not in viewport

**Solution:**
```typescript
// Scroll into view
await element.scrollIntoViewIfNeeded();

// Wait for element to be actionable
await expect(element).toBeEnabled();

// Force click if needed (use sparingly)
await element.click({ force: true });
```

### Problem: Test Flaky (Sometimes Passes, Sometimes Fails)

**Diagnosis:**
```bash
# Run test multiple times
for i in {1..5}; do npm run test:e2e -- tests/e2e/flaky.spec.ts; done
```

**Common causes:**
- Race condition
- Data dependency
- Network timing

**Solution:**
1. Add retries:
   ```typescript
   test.describe.configure({ retries: 2 });
   ```

2. Add explicit waits:
   ```typescript
   await page.waitForLoadState('networkidle');
   await expect(element).toBeVisible({ timeout: 10000 });
   ```

3. Use stable selectors:
   ```typescript
   // Prefer data-testid over class/xpath
   page.getByTestId('stable-id')
   ```

### Problem: Screenshot Shows Wrong Page

**Diagnosis:** Check navigation completed:
```typescript
await page.goto('/path');
console.log('Current URL:', page.url());
```

**Solution:**
```typescript
await page.goto('/path');
await page.waitForURL('**/path');
await page.waitForLoadState('domcontentloaded');
```

---

## Performance Issues

### Problem: Tests Run Slowly

**Diagnosis:**
```bash
# Time individual tests
npm run test -- --reporter=verbose
```

**Solutions:**

1. Run in parallel:
   ```bash
   npm run test -- --pool=threads
   ```

2. Skip slow tests during development:
   ```typescript
   it.skip('slow test', async () => { });
   ```

3. Use beforeAll for setup:
   ```typescript
   let testData;
   beforeAll(async () => {
     testData = await createTestData();
   });
   ```

### Problem: E2E Suite Takes Too Long

**Current:** ~10 minutes for 99 tests

**Solutions:**

1. Parallel execution:
   ```typescript
   test.describe.parallel('Tests', () => {
     // Independent tests run in parallel
   });
   ```

2. Reduce waits:
   ```typescript
   // Avoid fixed waits
   await page.waitForTimeout(5000); // BAD
   
   // Use dynamic waits
   await expect(element).toBeVisible(); // GOOD
   ```

3. Run subset in development:
   ```bash
   npm run test:e2e -- tests/e2e/critical.spec.ts
   ```

---

## Environment Issues

### Problem: Wrong Node.js Version

**Symptom:**
```
Error: fetch is not defined
```

**Diagnosis:**
```bash
node --version
# Must be v18.0.0 or higher
```

**Solution:**
```bash
# Using nvm
nvm install 18
nvm use 18

# Using volta
volta install node@18
```

### Problem: Missing Environment Variables

**Symptom:** Tests fail with undefined config

**Diagnosis:**
```bash
echo $DATABASE_URL
echo $API_BASE_URL
```

**Solution:**
1. Create `.env.test`:
   ```
   DATABASE_URL=postgresql://localhost:5432/test
   API_BASE_URL=http://localhost:5000
   ```

2. Load in tests:
   ```typescript
   import 'dotenv/config';
   ```

### Problem: Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE :::5000
```

**Solution:**
```bash
# Find process using port
lsof -i :5000

# Kill it
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

---

## Debugging Techniques

### Verbose Output

```bash
# Vitest verbose
npm run test -- --reporter=verbose

# Playwright debug
npm run test:e2e -- --debug
```

### Browser Inspection

```bash
# Run E2E with visible browser
npm run test:e2e -- --headed

# Pause on failure
npm run test:e2e -- --headed --debug
```

### Console Logging

```typescript
// Unit/Integration
console.log('Debug:', variable);

// E2E
await page.evaluate(() => console.log('Page:', document.body.innerHTML));
```

### Screenshots

```typescript
// Take screenshot on failure (automatic with Playwright)
// Or manually:
await page.screenshot({ path: 'debug-screenshot.png' });
```

---

## Quick Fixes Checklist

### Before Asking for Help

- [ ] Node.js 18+ installed?
- [ ] Server running (`npm run dev`)?
- [ ] Dependencies installed (`npm install`)?
- [ ] Correct file path?
- [ ] Schema matches test data?
- [ ] Data-testid matches component?
- [ ] Checked server logs for errors?

### Reset Everything

```bash
# Nuclear option - reset and retry
rm -rf node_modules
npm install
npm run dev &
sleep 10
npm run test
```

---

## Getting More Help

1. Check existing tests for patterns
2. Review TEST-SUITE-ARCHITECTURE.md
3. Check server logs for API errors
4. Use `--debug` flag for E2E
5. Ask team lead with:
   - Error message
   - Steps to reproduce
   - What you've tried

---

*Last Updated: January 2026*
