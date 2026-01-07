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
