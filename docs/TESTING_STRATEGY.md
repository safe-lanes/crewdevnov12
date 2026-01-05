# Testing Strategy

## Current State

The Seafarer Performance Management System currently has **no automated test suite**. This document outlines the testing strategy and identifies critical areas for test coverage.

---

## Testing Framework Recommendations

### Unit Testing
- **Vitest** (Vite-native, fast, compatible with Jest API)
- **Jest** (alternative, widely used)

### Integration Testing
- **Supertest** (Express API testing)
- **node-postgres** mock for database

### E2E Testing
- **Playwright** (recommended, cross-browser)
- **Cypress** (alternative)

### Setup Files Needed
```
tests/
├── setup.ts              # Test configuration
├── fixtures/             # Test data
├── unit/                 # Unit tests
│   ├── utils/
│   └── components/
├── integration/          # API tests
│   └── api/
└── e2e/                  # End-to-end tests
    └── flows/
```

---

## Critical Paths for Testing

### Priority 1: Core Business Logic

#### Rest Hours Violation Calculations
```typescript
// Test: timelineCalculations.ts
describe('Violation Detection', () => {
  test('Code 1: Minimum 10 hours rest in 24-hour period', () => {
    // Input: 48 slots with 9 hours rest
    // Expected: Violation code 1 detected
  });

  test('Code 3: Maximum 14 hours work in 24-hour period', () => {
    // Input: 48 slots with 15 hours work
    // Expected: Violation code 3 detected
  });

  test('Cross-month boundary handling', () => {
    // Input: Work spanning Dec 31 to Jan 1
    // Expected: Correct violation assignment
  });

  test('Hybrid violation assignment strategy', () => {
    // Test: 24-hour violations on window end date
    // Test: 7-day violations on first occurrence date
  });
});
```

#### Crew Experience Calculations
```typescript
// Test: storage.ts experience functions
describe('Experience Calculations', () => {
  test('Calculate tanker experience from sea service', () => {});
  test('Calculate years in current rank', () => {});
  test('Calculate years with operator', () => {});
});
```

#### Oil Major Compliance
```typescript
// Test: complianceEngine.ts
describe('Compliance Engine', () => {
  test('Validate crew against BP requirements', () => {});
  test('Rank pair logic (Master + Chief Officer)', () => {});
  test('Handle missing data gracefully', () => {});
});
```

### Priority 2: API Endpoints

#### CRUD Operations
```typescript
// Test: routes.ts
describe('Crew Members API', () => {
  test('GET /api/crew-members returns all crew', () => {});
  test('POST /api/crew-members creates new crew', () => {});
  test('PUT /api/crew-members/:id updates crew', () => {});
  test('DELETE /api/crew-members/:id removes crew', () => {});
});

describe('Rest Hours API', () => {
  test('Upsert prevents duplicates', () => {});
  test('Unique constraint enforced', () => {});
  test('Violation backfill endpoint works', () => {});
});
```

#### Validation
```typescript
describe('Request Validation', () => {
  test('Invalid crew member data rejected', () => {});
  test('Invalid month format rejected', () => {});
  test('Missing required fields rejected', () => {});
});
```

### Priority 3: Database Operations

#### Data Integrity
```typescript
describe('Database Integrity', () => {
  test('Unique constraint on rest_hours_daily_records', () => {});
  test('Foreign key constraints enforced', () => {});
  test('Cascade delete works for form versions', () => {});
});
```

#### Migration Safety
```typescript
describe('Migrations', () => {
  test('Migration is idempotent', () => {});
  test('Rollback works correctly', () => {});
});
```

### Priority 4: UI Components

#### Form Validation
```typescript
describe('Appraisal Form', () => {
  test('Stage 1 submission requires basic info', () => {});
  test('Stage 2 requires all ratings', () => {});
  test('Score calculations are correct', () => {});
});

describe('Rest Hours Recording Form', () => {
  test('Auto-save triggers on changes', () => {});
  test('Violation highlighting works', () => {});
  test('Navigation between months works', () => {});
});
```

---

## Test Data Fixtures

### Crew Member Fixture
```typescript
export const mockCrewMember = {
  id: 'A000001',
  firstName: 'Test',
  familyName: 'Seafarer',
  nationality: 'Philippine',
  presentRank: 'Master',
  presentVessel: '7440571a-841a-11ed-aa7c-7003bca91a86',
  vesselType: 'Oil Tanker',
  status: 'On Board',
  signOnDate: '2024-06-01',
};
```

### Rest Hours Fixture
```typescript
export const mockDailyRecord = {
  day: 1,
  dayOfWeek: 'Mon',
  hours: Array(48).fill('').map((_, i) => i < 16 ? 'w' : ''),
  isPlan: false,
  comments: '',
  violations: [],
};
```

### Violation Test Cases
```typescript
export const violationTestCases = [
  {
    name: 'No violations - adequate rest',
    hours: createHoursWithRestPattern([0, 8], [12, 4]), // 12 hours rest
    expectedViolations: [],
  },
  {
    name: 'Code 1 violation - insufficient rest',
    hours: createHoursWithWorkPattern([0, 15]), // 15 hours work = 9 hours rest
    expectedViolations: [1],
  },
  {
    name: 'Code 3 violation - excessive work',
    hours: createHoursWithWorkPattern([0, 15]), // 15 hours work
    expectedViolations: [1, 3],
  },
];
```

---

## Testing Coverage Goals

### Phase 1 (Critical)
| Area | Target Coverage |
|------|-----------------|
| Violation calculations | 90% |
| API CRUD operations | 80% |
| Data validation | 80% |

### Phase 2 (Important)
| Area | Target Coverage |
|------|-----------------|
| Experience calculations | 85% |
| Compliance engine | 85% |
| Form workflows | 75% |

### Phase 3 (Comprehensive)
| Area | Target Coverage |
|------|-----------------|
| UI components | 70% |
| Edge cases | 80% |
| Error handling | 75% |

---

## Current Testing Gaps

### Critical Gaps

1. **No automated tests exist** - All testing is manual
2. **Violation logic is complex** - 8 violation types with cross-boundary handling
3. **Database operations untested** - Upsert, unique constraints, cascades

### High-Risk Areas

| Area | Risk Level | Reason |
|------|------------|--------|
| Violation calculations | HIGH | Complex logic, regulatory compliance |
| Rest hours uniqueness | HIGH | Data integrity, recently fixed duplicate issue |
| Appraisal workflow | MEDIUM | 3-stage process with validations |
| Compliance engine | MEDIUM | Multiple oil major rules |
| Experience calculations | MEDIUM | Date arithmetic, sea service parsing |

### Recommended Immediate Actions

1. **Add unit tests for violation detection**
   - Critical for compliance
   - Well-defined inputs/outputs
   - Easy to test in isolation

2. **Add integration tests for rest hours API**
   - Verify upsert logic
   - Test unique constraint
   - Cover cross-month scenarios

3. **Add E2E test for appraisal workflow**
   - Critical user journey
   - Complex multi-stage process

---

## Test Implementation Guide

### Setting Up Vitest

```bash
# Install dependencies
npm install -D vitest @vitest/coverage-v8 @testing-library/react

# Add to package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

### Example Test File

```typescript
// tests/unit/timelineCalculations.test.ts
import { describe, test, expect } from 'vitest';
import { detectViolations } from '../../client/src/modules/rest-hours/timelineCalculations';

describe('detectViolations', () => {
  test('should detect Code 1 violation for insufficient rest', () => {
    const hours = Array(48).fill('w').slice(0, 30).concat(Array(18).fill(''));
    const result = detectViolations(hours);
    expect(result).toContain(1);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- timelineCalculations.test.ts
```

---

## CI/CD Integration

### Recommended Pipeline

```yaml
# .github/workflows/test.yml (if using GitHub Actions)
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```
