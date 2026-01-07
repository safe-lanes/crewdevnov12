# Test IDs Reference

This document lists all `data-testid` attributes used in the application. When migrating the test suite to another fork, ensure these IDs exist in your components for E2E tests to work.

## Quick Start for Migration

1. Copy this file to your fork
2. Use the verification script below to check coverage
3. Add missing test IDs to your components

```bash
# Check which test IDs are missing in your fork
grep -roh 'data-testid="[^"]*"' client/src --include="*.tsx" | \
  sed 's/data-testid="//;s/"$//' | sort | uniq > your-testids.txt
```

---

## Test ID Naming Convention

| Pattern | Purpose | Example |
|---------|---------|---------|
| `button-{action}` | Clickable buttons | `button-submit`, `button-cancel` |
| `button-{action}-{target}` | Action on specific target | `button-delete-crew`, `button-edit-form` |
| `input-{field}` | Text/number inputs | `input-seafarers-name`, `input-sign-on` |
| `select-{field}` | Dropdown selects | `select-vessel`, `select-rank` |
| `textarea-{field}` | Multi-line text | `textarea-comments`, `textarea-notes` |
| `checkbox-{field}` | Checkboxes | `checkbox-active`, `checkbox-approved` |
| `radio-{option}` | Radio buttons | `radio-yes`, `radio-no` |
| `text-{content}` | Display text | `text-crew-id`, `text-vessel` |
| `badge-{status}` | Status badges | `badge-met`, `badge-pending` |
| `row-{item}-${id}` | Dynamic table rows | `row-crew-${crewId}` |
| `card-{item}-${id}` | Dynamic cards | `card-vessel-${vesselId}` |

---

## Static Test IDs by Category

### Layout & Navigation

| Test ID | Component | Purpose |
|---------|-----------|---------|
| `app-root` | App.tsx | Root application container |
| `main-layout` | Layout | Main content area |
| `sidebar-desktop` | Sidebar | Desktop sidebar container |
| `sidebar-toggle-button` | Sidebar | Toggle sidebar visibility |
| `hamburger-menu-button` | Header | Mobile menu toggle |
| `mobile-nav-menu` | Header | Mobile navigation menu |
| `menu-overlay` | Header | Mobile menu overlay |
| `header-logo` | Header | Application logo |

### Buttons - Common Actions

| Test ID | Purpose |
|---------|---------|
| `button-submit` | Submit forms |
| `button-cancel` | Cancel operations |
| `button-save` | Save changes |
| `button-save-draft` | Save as draft |
| `button-close` | Close dialogs/modals |
| `button-back` | Go back |
| `button-back-to-list` | Return to list view |
| `button-edit` | Edit mode |
| `button-delete` | Delete item |
| `button-apply` | Apply filters/changes |
| `button-clear` | Clear form/filters |
| `button-clear-filters` | Clear all filters |
| `button-filters` | Toggle filter panel |
| `button-new-entry` | Create new entry |

### Buttons - Module Specific

| Test ID | Module | Purpose |
|---------|--------|---------|
| `button-new-crew` | Crew Pool | Add new crew member |
| `button-new-plan` | Rotation | Create rotation plan |
| `button-new-training` | Training | Add training record |
| `button-new-month` | Rest Hours | Add new month |
| `button-deploy` | Vessel | Deploy crew |
| `button-check-compliance` | Compliance | Run compliance check |

### Form Inputs

| Test ID | Field Type | Used In |
|---------|------------|---------|
| `input-seafarers-name` | Text | Crew forms |
| `input-sign-on` | Date | Crew assignment |
| `input-promotion-date` | Date | Promotion forms |
| `input-handover-file` | File | Handover forms |
| `input-appraisal-period-from` | Date | Appraisal forms |
| `input-appraisal-period-to` | Date | Appraisal forms |
| `input-hierarchy-group-name` | Text | Promotion hierarchy |

### Select Dropdowns

| Test ID | Options | Used In |
|---------|---------|---------|
| `select-vessel` | Vessel list | Multiple modules |
| `select-vessel-assigned` | Assigned vessels | Crew forms |
| `select-rank-to-add` | Rank list | Admin forms |
| `select-seafarers-rank` | Rank list | Crew forms |
| `select-nationality` | Country list | Crew forms |
| `select-appraisal-type` | Appraisal types | Appraisal forms |
| `select-primary-appraiser` | User list | Appraisal forms |
| `select-pi-category` | PI categories | Appraisal forms |

### Textareas

| Test ID | Purpose |
|---------|---------|
| `textarea-seafarer-comments` | Seafarer's comments |
| `textarea-appraiser-comments` | Appraiser's comments |
| `textarea-office-review-comments` | Office review comments |
| `textarea-vessel-comment` | Vessel comments |
| `textarea-root-cause` | Root cause analysis |
| `textarea-corrective-action` | Corrective action |
| `textarea-preventive-action` | Preventive action |

### Display Text Elements

| Test ID | Content Displayed |
|---------|-------------------|
| `text-crew-id` | Crew member ID |
| `text-seafarer-name` | Seafarer full name |
| `text-present-rank` | Current rank |
| `text-vessel` | Assigned vessel |
| `text-nationality` | Nationality |
| `text-dob-age` | Date of birth/age |
| `text-joined` | Joining date |
| `text-next-availability` | Next availability |
| `text-sailing-due` | Sailing due date |
| `text-overall-score` | Overall appraisal score |
| `text-competence-score` | Competence section score |
| `text-behavioural-score` | Behavioural section score |
| `text-promotion-rank` | Target promotion rank |
| `text-promotion-title` | Promotion form title |

### Status Badges

| Test ID | Status |
|---------|--------|
| `badge-met` | Requirement met |
| `badge-not-met` | Requirement not met |
| `badge-pending` | Pending status |
| `badge-a26-met` | A26 requirement met |
| `badge-a26-pending` | A26 pending |

### Containers

| Test ID | Contains |
|---------|----------|
| `appraisals-container` | Appraisals list |
| `vessel-container` | Vessel information |
| `vessel-types-container` | Vessel type list |
| `vessel-classes-container` | Vessel class list |
| `vessel-group-settings` | Vessel group config |

### Training Matrix

| Test ID | Purpose |
|---------|---------|
| `title-training-matrix` | Matrix title |
| `tm-vessel-select` | Vessel selector |
| `tm-vessel-group-settings` | Group settings |
| `tm-selected-vessels-indicator` | Selected count |
| `tm-save-draft-button` | Save draft |
| `tm-submit-button` | Submit matrix |
| `tm-cancel-button` | Cancel changes |
| `tm-revision-button` | View revisions |
| `tm-next-revision-display` | Next revision date |
| `tm-flex-date-input` | Flexible date input |

### Toggles & Switches

| Test ID | Purpose |
|---------|---------|
| `toggle-switch` | Generic toggle |
| `toggle-record-mode` | Record mode toggle |
| `toggle-compliance-mode` | Compliance mode toggle |

### Radio Buttons

| Test ID | Option |
|---------|--------|
| `radio-promotion-yes` | Promotion approved |
| `radio-promotion-rejected` | Promotion rejected |
| `radio-promotion-waitlist` | Promotion waitlisted |
| `radio-year-period` | Year period filter |
| `radio-date-range` | Date range filter |
| `radio-timing-on-board` | On-board timing |
| `radio-timing-prior-joining` | Prior joining timing |

---

## Dynamic Test IDs (Templates)

These IDs include dynamic values (${id}, ${index}):

### Row-Based (Tables/Lists)

```typescript
`row-vessel-${vessel.vesselId}`
`row-crew-${crew.id}`
`row-training-${training.id}`
`row-promotion-${promotion.id}`
```

### Button Actions on Items

```typescript
`button-edit-${item.id}`
`button-delete-${item.id}`
`button-view-${item.id}`
`button-attach-document-${doc.id}`
`button-attach-training-${course.id}`
```

### Form Fields in Arrays

```typescript
`input-followup-training-${index}`
`select-followup-status-${index}`
`button-delete-followup-${index}`
`textarea-new-comment-${row.id}`
```

### Status-Based

```typescript
`status-badge-${status.toLowerCase()}`
`badge-ces-pass-${test.id}`
`badge-ces-fail-${test.id}`
```

---

## Adding Test IDs to Components

### Example: Adding to a Button

```tsx
<Button 
  onClick={handleSubmit}
  data-testid="button-submit-form"
>
  Submit
</Button>
```

### Example: Adding to Dynamic List

```tsx
{items.map((item) => (
  <div key={item.id} data-testid={`row-item-${item.id}`}>
    <Button data-testid={`button-edit-${item.id}`}>Edit</Button>
    <Button data-testid={`button-delete-${item.id}`}>Delete</Button>
  </div>
))}
```

### Example: Adding to Form Fields

```tsx
<Input
  {...field}
  data-testid="input-email"
  placeholder="Enter email"
/>

<Select data-testid="select-role">
  <SelectTrigger data-testid="select-role-trigger">
    <SelectValue />
  </SelectTrigger>
</Select>
```

---

## Verification Script

Run this to verify test IDs exist in your fork:

```bash
#!/bin/bash
# verify-testids.sh

echo "Checking E2E test expectations vs actual test IDs..."

# Extract test IDs used in E2E tests
grep -roh "getByTestId('[^']*')" tests/e2e --include="*.spec.ts" | \
  sed "s/getByTestId('//;s/')//" | sort | uniq > expected-testids.txt

# Extract test IDs in codebase  
grep -roh 'data-testid="[^"]*"' client/src --include="*.tsx" | \
  sed 's/data-testid="//;s/"$//' | grep -v '\${' | sort | uniq > actual-testids.txt

# Find missing
echo "Missing test IDs (in E2E tests but not in code):"
comm -23 expected-testids.txt actual-testids.txt

rm expected-testids.txt actual-testids.txt
```

---

## Module Coverage Summary

| Module | Static IDs | Dynamic IDs | E2E Coverage |
|--------|------------|-------------|--------------|
| Crew Pool | 45+ | 15+ | Full |
| Appraisals | 60+ | 30+ | Full |
| Promotions | 40+ | 20+ | Full |
| Training Matrix | 20+ | 10+ | Full |
| Rotation | 25+ | 10+ | Full |
| Rest Hours | 30+ | 15+ | Full |
| Drug & Alcohol | 25+ | 10+ | Full |
| Recruitment | 35+ | 15+ | Full |
| Vessel Database | 40+ | 20+ | Full |
| Admin | 50+ | 25+ | Full |
| Reports | 15+ | 5+ | Partial |

---

## Troubleshooting

### E2E Test Fails with "Element not found"

1. Check if the test ID exists in your component
2. Verify spelling matches exactly (case-sensitive)
3. Check if element is conditionally rendered

### Dynamic ID Not Matching

1. Ensure the ID format matches: `prefix-${variable}`
2. Check that the variable value is consistent
3. Use `await page.getByTestId()` for async elements

### Multiple Elements with Same ID

Test IDs should be unique. If you have multiple:
1. Add index or unique identifier
2. Use `getByTestId().first()` or `.nth(index)`
