# Test IDs Reference Documentation

This document catalogs all `data-testid` attributes added to the Seafarer Performance Management System for E2E testing purposes.

## Important: Scoped Selectors Pattern

**CRITICAL**: Many test IDs are reused across modules (e.g., `input-search-name`, `select-rank`, `button-apply`). To avoid selector collisions, **always scope your selectors within the module container**.

### Recommended Pattern
```typescript
// Correct: Scope within container
const container = page.getByTestId('crew-pool-container');
const searchInput = container.getByTestId('input-search-name');
await searchInput.fill('test');

// Wrong: Global selector may match multiple elements
const searchInput = page.getByTestId('input-search-name'); // May be ambiguous!
```

---

## Overview

Test IDs follow consistent naming patterns:
- **Containers**: `{module-name}-container` - **Use for scoping**
- **Navigation**: `nav-{label-lowercase-hyphenated}`
- **Buttons**: `button-{action}` or `button-{action}-{target}`
- **Inputs**: `input-{field-name}`
- **Selects**: `select-{field-name}`
- **Cells/Rows**: `cell-{section}-{field}-{index}` or `row-{section}-{id}`

---

## App-Level Containers

| Test ID | Location | Description |
|---------|----------|-------------|
| `app-root` | App.tsx | Root application container |
| `main-content` | App.tsx | Main content area with role="main" |

---

## Navigation (HeaderComponent)

All navigation links use the pattern: `nav-{label.toLowerCase().replace(' ', '-')}`

| Test ID | Location | Description |
|---------|----------|-------------|
| `nav-recruitment` | HeaderComponent.tsx | Navigate to Recruitment module |
| `nav-crew-pool` | HeaderComponent.tsx | Navigate to Crew Pool module |
| `nav-rotation` | HeaderComponent.tsx | Navigate to Rotation module |
| `nav-vessel` | HeaderComponent.tsx | Navigate to Vessel module |
| `nav-drugs-alcohol` | HeaderComponent.tsx | Navigate to Drugs & Alcohol Testing |
| `nav-promotions` | HeaderComponent.tsx | Navigate to Promotions module |
| `nav-rest-hours` | HeaderComponent.tsx | Navigate to Rest Hours module |
| `nav-training` | HeaderComponent.tsx | Navigate to Training module |
| `nav-admin` | HeaderComponent.tsx | Navigate to Admin module |

---

## Module Containers (Use for Scoping)

| Test ID | Location | Description |
|---------|----------|-------------|
| `appraisals-container` | ElementCrewAppraisals.tsx | Crew Appraisals module wrapper |
| `crew-pool-container` | CrewPoolModule.tsx | Crew Pool module wrapper |
| `rest-hours-container` | RestHoursModule.tsx | Rest Hours module wrapper |
| `vessel-container` | VesselModule.tsx | Vessel module wrapper |
| `recruitment-container` | RecruitmentModule.tsx | Recruitment module wrapper |
| `rotation-container` | RotationModule.tsx | Rotation module wrapper |
| `promotions-container` | PromotionsModule.tsx | Promotions module wrapper |
| `drugs-alcohol-container` | DrugsAlcoholModule.tsx | Drugs & Alcohol module wrapper |

---

## Shared Filter Components (Scope Within Container!)

These IDs are used in multiple modules. **Always scope within the module container**.

| Test ID | Modules Using It | Description |
|---------|------------------|-------------|
| `input-search-name` | CrewPool, Appraisals | Search by name input |
| `select-vessel` | CrewPool, Appraisals, Vessel | Filter by vessel dropdown |
| `select-rank` | CrewPool, Appraisals | Filter by rank dropdown |
| `select-nationality` | CrewPool, Appraisals | Filter by nationality |
| `button-apply` | CrewPool, Appraisals | Apply filters button |
| `button-clear` | CrewPool | Clear filters button |
| `button-clear-filters` | Appraisals, Vessel | Clear filters button |
| `filter-container` | Appraisals | Filter section wrapper |

---

## Crew Pool Module (Scope: `crew-pool-container`)

```typescript
const container = page.getByTestId('crew-pool-container');
```

### Filters
| Test ID | Description |
|---------|-------------|
| `input-search-name` | Search by crew name input |
| `select-vessel` | Filter by vessel dropdown |
| `select-rank` | Filter by rank dropdown |
| `select-nationality` | Filter by nationality dropdown |
| `select-status` | Filter by status dropdown |
| `select-relief-due` | Filter by relief due dropdown |
| `select-pool` | Filter by pool dropdown |
| `button-apply` | Apply filters button |
| `button-clear` | Clear filters button |
| `button-filters` | Toggle filters visibility |
| `button-new-crew` | Open new crew form |

### Dynamic Options
| Pattern | Description |
|---------|-------------|
| `vessel-option-{id}` | Vessel dropdown option |
| `rank-option-{value}` | Rank dropdown option |
| `nationality-option-{value}` | Nationality dropdown option |
| `pool-option-{name}` | Pool dropdown option |

---

## Crew Appraisals Module (Scope: `appraisals-container`)

```typescript
const container = page.getByTestId('appraisals-container');
```

### Filters
| Test ID | Description |
|---------|-------------|
| `filter-container` | Filter section wrapper |
| `input-search-name` | Search by name input |
| `select-rank` | Filter by rank dropdown |
| `select-vessel` | Filter by vessel dropdown |
| `select-vessel-type` | Filter by vessel type dropdown |
| `select-nationality` | Filter by nationality dropdown |
| `select-appraisal-type` | Filter by appraisal type |
| `select-rating` | Filter by rating dropdown |
| `button-apply` | Apply filters button |
| `button-clear-filters` | Clear filters button |
| `mobile-sidebar-toggle` | Mobile sidebar toggle button |

---

## Vessel Module (Scope: `vessel-container`)

```typescript
const container = page.getByTestId('vessel-container');
```

### Database View
| Test ID | Description |
|---------|-------------|
| `button-toggle-filters` | Toggle filter visibility |
| `button-clear-filters` | Clear all filters |
| `radio-vessel` | Vessel filter radio button |
| `radio-fleet` | Fleet filter radio button |
| `radio-addgroup` | Additional group filter radio |
| `select-vessel-value` | Vessel selection dropdown |
| `select-fleet-value` | Fleet selection dropdown |
| `select-addgroup-value` | Additional group dropdown |

### Planning Table Cells
| Pattern | Description |
|---------|-------------|
| `cell-planning-sno-{index}` | Serial number cell |
| `cell-planning-rank-{index}` | Rank cell |
| `cell-planning-onboard-name-{index}` | On board crew name cell |
| `cell-planning-relief-due-{index}` | Relief due date cell |
| `cell-planning-soff-date-{index}` | Sign off date cell |
| `cell-planning-soff-port-{index}` | Sign off port cell |
| `cell-planning-relief-status-{index}` | Relief status cell |
| `cell-planning-onboard-edit-{index}` | On board edit button cell |
| `cell-planning-reliever-name-{index}` | Reliever name cell |
| `cell-planning-joining-date-{index}` | Joining date cell |
| `cell-planning-joining-port-{index}` | Joining port cell |
| `cell-planning-joining-status-{index}` | Joining status cell |
| `cell-planning-reliever-edit-{index}` | Reliever edit button cell |

### Edit Buttons
| Pattern | Description |
|---------|-------------|
| `button-edit-onboard-{index}` | Edit on board crew button |
| `button-edit-reliever-{index}` | Edit reliever crew button |

### Dialogs
| Pattern | Description |
|---------|-------------|
| `doc-expiry-issue-{index}` | Document expiry issue row |

---

## Rest Hours Module (Scope: `rest-hours-container`)

```typescript
const container = page.getByTestId('rest-hours-container');
```

| Test ID | Description |
|---------|-------------|
| `rest-hours-container` | Rest Hours module wrapper |

---

## Recruitment Module (Scope: `recruitment-container`)

```typescript
const container = page.getByTestId('recruitment-container');
```

### Navigation
```typescript
await page.getByTestId('nav-recruitment').click();
await expect(page.getByTestId('recruitment-container')).toBeVisible();
```

### Test IDs Used in E2E Tests
| Test ID | Description |
|---------|-------------|
| `button-new-crew` | Open new recruitment form |
| `button-toggle-filters` | Toggle filter visibility |
| `filter-container` | Filter section wrapper |

---

## Rotation Module (Scope: `rotation-container`)

```typescript
const container = page.getByTestId('rotation-container');
```

### Navigation
```typescript
await page.getByTestId('nav-rotation').click();
await expect(page.getByTestId('rotation-container')).toBeVisible();
```

### Test IDs Used in E2E Tests
| Test ID | Description |
|---------|-------------|
| `filter-container` | Filter section wrapper (Due/Plan views) |

---

## Promotions Module (Scope: `promotions-container`)

```typescript
const container = page.getByTestId('promotions-container');
```

### Navigation
```typescript
await page.getByTestId('nav-promotions').click();
await expect(page.getByTestId('promotions-container')).toBeVisible();
```

### Test IDs Used in E2E Tests
| Test ID | Description |
|---------|-------------|
| `button-toggle-filters` | Toggle filter visibility |
| `filter-container` | Filter section wrapper |

---

## Drugs & Alcohol Module (Scope: `drugs-alcohol-container`)

```typescript
const container = page.getByTestId('drugs-alcohol-container');
```

### Navigation
```typescript
await page.getByTestId('nav-drugs-alcohol').click();
await expect(page.getByTestId('drugs-alcohol-container')).toBeVisible();
```

### Test IDs Used in E2E Tests
| Test ID | Description |
|---------|-------------|
| `button-toggle-filters` | Toggle filter visibility |
| `filter-container` | Filter section wrapper |

---

## Implementation Notes for Other Forks

### 1. Container Level
Wrap module returns in a div with appropriate container testid:
```tsx
return (
  <div data-testid="module-name-container">
    {/* module content */}
  </div>
);
```

### 2. Form Controls
Add testid to inputs, selects, and buttons:
```tsx
<Input data-testid="input-field-name" />
<SelectTrigger data-testid="select-field-name" />
<Button data-testid="button-action-name" />
```

### 3. Dynamic Elements
Include unique identifiers for list items:
```tsx
<div data-testid={`row-item-${item.id}`} />
```

### 4. Navigation
Follow the pattern `nav-{label.toLowerCase().replace(' ', '-')}`

---

## E2E Test Patterns

### Scoped Selectors (Recommended)
```typescript
// Navigate to module
await page.getByTestId('nav-crew-pool').click();

// Get container and scope all selectors within it
const container = page.getByTestId('crew-pool-container');
await expect(container).toBeVisible();

// Interact with scoped elements
await container.getByTestId('button-filters').click();
await container.getByTestId('input-search-name').fill('John');
await container.getByTestId('button-apply').click();
```

### Cross-Module Navigation
```typescript
// Navigate from one module to another
await page.getByTestId('nav-crew-pool').click();
await expect(page.getByTestId('crew-pool-container')).toBeVisible();

await page.getByTestId('nav-vessel').click();
await expect(page.getByTestId('vessel-container')).toBeVisible();
```

---

## Last Updated

January 2026 - Testing Fork Implementation
- Added container-level data-testids to all major modules
- Documented scoped selector pattern to avoid collisions
- Updated E2E tests to use container scoping

---

## Test Expansion Summary (January 2026)

### Modules Added/Expanded
| Module | Unit Tests | Integration Tests | E2E Tests | Status |
|--------|-----------|-------------------|-----------|--------|
| Recruitment | 35 | 22 | 3 | Complete |
| Rotation | 22 | 11 | 2 | Complete |
| Promotions | 34 | 14 | 3 | Complete |
| Drugs & Alcohol | 35 | 17 | 3 | Complete |
| Crew Pool (expansion) | 31 | - | - | Complete |
| Vessel (expansion) | 32 | - | - | Complete |

### New Test Files Created

**Unit Tests (6 modules):**
- `tests/unit/modules/recruitment/recruitment-validation.test.ts` (35 tests)
- `tests/unit/modules/rotation/rotation-planning.test.ts` (22 tests)
- `tests/unit/modules/promotions/promotion-workflow.test.ts` (34 tests)
- `tests/unit/modules/drugs-alcohol/drug-alcohol-testing.test.ts` (35 tests)
- `tests/unit/modules/crew-pool/crew-pool-validation.test.ts` (31 tests)
- `tests/unit/modules/vessel/vessel-management.test.ts` (32 tests)

**Integration Tests (4 APIs):**
- `tests/integration/api/recruitment.test.ts` (22 tests)
- `tests/integration/api/rotation.test.ts` (11 tests)
- `tests/integration/api/promotions.test.ts` (14 tests)
- `tests/integration/api/drug-alcohol.test.ts` (17 tests)

**E2E Tests:**
- `tests/e2e/module-coverage.spec.ts` (13 tests)
  - Recruitment Module (3 tests)
  - Rotation Module (2 tests)
  - Promotions Module (3 tests)
  - Drugs & Alcohol Module (3 tests)
  - Cross-Module Navigation (1 test)
  - Module Container Stability (1 test)

### Total Test Count

| Category | Before | Added | After |
|----------|--------|-------|-------|
| Unit Tests | 85 | 189 | 274 |
| Integration Tests | 0 | 64 | 64 |
| E2E Tests | 28 | 13 | 41 |
| **GRAND TOTAL** | **113** | **266** | **379** |

### New data-testid Attributes Added

| Test ID | File | Purpose |
|---------|------|---------|
| `recruitment-container` | RecruitmentModule.tsx | Module wrapper for scoped E2E tests |
| `rotation-container` | RotationModule.tsx | Module wrapper for scoped E2E tests |
| `promotions-container` | PromotionsModule.tsx | Module wrapper for scoped E2E tests |
| `drugs-alcohol-container` | DrugsAlcoholModule.tsx | Module wrapper for scoped E2E tests |

### For Other Forks

To replicate this test coverage to other forks:

1. **Copy all test files** listed above to the corresponding directories
2. **Add the 4 new data-testid attributes** to module containers:
   ```tsx
   // RecruitmentModule.tsx
   return <div data-testid="recruitment-container">...</div>
   
   // RotationModule.tsx
   return <div data-testid="rotation-container">...</div>
   
   // PromotionsModule.tsx
   return <div data-testid="promotions-container">...</div>
   
   // DrugsAlcoholModule.tsx
   return <div data-testid="drugs-alcohol-container">...</div>
   ```
3. **Verify navigation test IDs** match the HeaderComponent labels:
   - `nav-recruitment` for "Recruitment"
   - `nav-rotation` for "Rotation"
   - `nav-promotions` for "Promotions"
   - `nav-drugs-alcohol` for "Drugs Alcohol"
4. **Run test suite**:
   ```bash
   npm run test        # Unit + Integration tests (274 passing)
   npx playwright test # E2E tests (41 passing)
   ```
5. **Expected results**: ~379 tests passing
