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
| `nav-d&a-test` | HeaderComponent.tsx | Navigate to Drugs & Alcohol Testing |
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
