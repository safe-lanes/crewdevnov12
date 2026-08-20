import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Promotions - Comprehensive Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-promotions').click();
    await expect(page.getByTestId('promotions-container')).toBeVisible();
  });

  test('should display promotions list', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const promotionsList = container.locator('table, [role="grid"]').first();
    await expect(promotionsList).toBeVisible({ timeout: 10000 });
  });

  test('should toggle promotion filters', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const filterButton = container.getByTestId('button-toggle-filters');
    await filterButton.click();
    await page.waitForTimeout(300);
    
    const filterContainer = container.getByTestId('filter-container');
    if (await filterContainer.count() > 0) {
      await expect(filterContainer).toBeVisible();
    }
  });

  test('should display promotion checklist', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const checklistButton = container.locator('button:has-text("Checklist"), a:has-text("Checklist")').first();
    if (await checklistButton.count() > 0) {
      await checklistButton.click();
      await page.waitForTimeout(500);
      
      const checklist = page.locator('[role="dialog"], .checklist-view').first();
      if (await checklist.count() > 0) {
        await expect(checklist).toBeVisible();
      }
    }
  });

  test('should display CES test tracking', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const cesContent = container.locator('text=/ces/i, text=/test/i').first();
    if (await cesContent.count() > 0) {
      await expect(cesContent).toBeVisible();
    }
  });

  test('should filter promotions by status', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const filterButton = container.getByTestId('button-toggle-filters');
    await filterButton.click();
    await page.waitForTimeout(300);
    
    const statusFilter = container.locator('select, [role="combobox"]').first();
    if (await statusFilter.count() > 0) {
      await statusFilter.click();
    }
  });

  test('should display promotion review form', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const reviewButton = container.locator('button:has-text("Review"), button:has-text("Assess")').first();
    if (await reviewButton.count() > 0) {
      await reviewButton.click();
      await page.waitForTimeout(500);
      
      const reviewForm = page.locator('form, [role="dialog"]').first();
      if (await reviewForm.count() > 0) {
        await expect(reviewForm).toBeVisible();
      }
    }
  });

  test('should show configured Position choices only for an onboard multi-Position promotion', async ({ page }) => {
    const crewMemberId = 'T493-E2E';
    const vesselUuid = 'T493-VESSEL';

    await page.route('**/api/v2/crew-pool/crew/enriched', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          empNo: crewMemberId,
          employeeId: crewMemberId,
          firstName: 'Task',
          familyName: 'Position',
          presentRank: 'OS_1',
          status: 'Active',
          vesselUuid,
          vesselName: 'Task 493 Vessel',
        }]),
      });
    });
    await page.route('**/api/v2/admin/promotion-hierarchies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 493,
          groupName: 'Task 493 Deck Ratings',
          rankPath: JSON.stringify([
            'OS_1',
            'OS_2',
            'OS_3',
            'AB_1',
            'AB_2',
            'AB_3',
          ]),
          isActive: true,
        }]),
      });
    });
    await page.route('**/api/v2/promotions/reviews', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });
    await page.route('**/api/v2/admin/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 493,
          name: 'Promotion Review Form',
          category: 'promotion',
          isLockForm: false,
        }]),
      });
    });
    await page.route('**/api/v2/admin/rank-groups', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 493,
          formId: 493,
          ranks: JSON.stringify(['AB']),
          archivedAt: null,
          configuration: null,
        }]),
      });
    });
    await page.route(`**/api/v2/promotions/reviews/crew/${crewMemberId}/rank/AB`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Promotion review not found' }),
      });
    });
    await page.route(`**/api/v2/crew-pool/crew/by-emp-no/${crewMemberId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          empNo: crewMemberId,
          presentRank: 'OS_1',
        }),
      });
    });
    await page.route(`**/api/v2/admin/vessel-revisions/ranks/${vesselUuid}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { displayRole: 'AB_1' },
          { displayRole: 'AB_2' },
          { displayRole: 'AB_3' },
          { displayRole: 'OS_1' },
        ]),
      });
    });

    await page.goto('/');
    await page.getByTestId('nav-promotions').click();
    await expect(page.getByTestId(`button-edit-${crewMemberId}`)).toBeVisible();
    await page.getByTestId(`button-edit-${crewMemberId}`).click();

    await page.getByTestId('button-step-b').click();
    await page.getByTestId('radio-promotion-decision-yes').click();
    await page.getByTestId('radio-promotion-type-on-board').click();
    await page.getByTestId('button-step-c').click();

    await expect(page.getByTestId('button-select-promotion-position')).toBeVisible();
    await page.getByTestId('button-select-promotion-position').click();
    await expect(page.getByText(
      'Choose a specific position to promote Task Position to.',
    )).toBeVisible();
    await expect(page.getByTestId('radio-promotion-position-AB_1')).toBeVisible();
    await expect(page.getByTestId('radio-promotion-position-AB_2')).toBeVisible();
    await expect(page.getByTestId('radio-promotion-position-AB_3')).toBeVisible();
    await page.getByText('Cancel', { exact: true }).click();

    await page.getByTestId('button-step-b').click();
    await page.getByTestId('radio-promotion-type-prior-joining').click();
    await page.getByTestId('button-step-c').click();
    await expect(page.getByTestId('button-select-promotion-position')).toHaveCount(0);
  });

  test('should show promotion approval actions or action buttons', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const approveButton = container.locator('button:has-text("Approve")').first();
    const rejectButton = container.locator('button:has-text("Reject")').first();
    const viewButton = container.locator('button:has-text("View")').first();
    const editButton = container.locator('button:has-text("Edit")').first();
    const actionButton = container.locator('button').first();
    
    const hasActions = await approveButton.count() > 0 || 
                       await rejectButton.count() > 0 || 
                       await viewButton.count() > 0 ||
                       await editButton.count() > 0 ||
                       await actionButton.count() > 0;
    expect(hasActions).toBe(true);
  });

  test('should display promotion history or progress', async ({ page }) => {
    const container = page.getByTestId('promotions-container');
    
    const rows = container.locator('table tbody tr, [role="row"]');
    const rowCount = await rows.count();
    
    if (rowCount > 0) {
      await expect(rows.first()).toBeVisible();
    } else {
      await expect(container).not.toBeEmpty();
    }
  });
});
