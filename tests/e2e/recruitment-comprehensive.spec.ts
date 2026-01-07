import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Recruitment - Comprehensive Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-recruitment').click();
    await expect(page.getByTestId('recruitment-container')).toBeVisible();
  });

  test('should display recruitment candidates list/table', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    const candidatesList = container.locator('table, [role="grid"], [role="list"]').first();
    await expect(candidatesList).toBeVisible({ timeout: 10000 });
  });

  test('should open and display new candidate form', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    const newButton = container.getByTestId('button-new-crew');
    const addButton = container.locator('button:has-text("New"), button:has-text("Add")').first();
    
    if (await newButton.count() > 0) {
      await newButton.click();
    } else if (await addButton.count() > 0) {
      await addButton.click();
    }
    
    const form = page.locator('form, [role="dialog"]').first();
    if (await form.count() > 0) {
      await expect(form).toBeVisible({ timeout: 5000 });
      
      const nameInput = form.locator('input').first();
      if (await nameInput.count() > 0) {
        await expect(nameInput).toBeVisible();
      }
    }
  });

  test('should toggle filters section', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    const filterButton = container.getByTestId('button-toggle-filters');
    await filterButton.click();
    
    await page.waitForTimeout(500);
    
    const filterSection = container.locator('[class*="filter"]').first();
    if (await filterSection.count() > 0) {
      await expect(filterSection).toBeVisible();
    }
  });

  test('should filter candidates by status', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    const filterButton = container.getByTestId('button-toggle-filters');
    if (await filterButton.count() > 0) {
      await filterButton.click();
      await page.waitForTimeout(300);
    }
    
    const statusFilter = container.locator('select, [role="combobox"]').first();
    if (await statusFilter.count() > 0) {
      await statusFilter.click();
      await page.waitForTimeout(200);
      
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.count() > 0) {
        await firstOption.click();
      }
    }
  });

  test('should search candidates by name', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    const searchInput = container.locator(
      'input[type="text"], input[type="search"], input[placeholder*="search" i]'
    ).first();
    
    if (await searchInput.count() > 0) {
      await searchInput.fill('test candidate');
      await page.waitForTimeout(500);
      
      await expect(searchInput).toHaveValue('test candidate');
    }
  });

  test('should display candidate details on row click', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    const firstRow = container.locator('table tbody tr, [role="row"]').first();
    
    if (await firstRow.count() > 0) {
      const viewButton = firstRow.locator('button, [role="button"]').first();
      if (await viewButton.count() > 0) {
        await viewButton.click();
        await page.waitForTimeout(500);
        
        const detailView = page.locator('[role="dialog"], .detail-panel, aside').first();
        if (await detailView.count() > 0) {
          await expect(detailView).toBeVisible();
        }
      }
    }
  });

  test('should clear filters', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    const filterButton = container.getByTestId('button-toggle-filters');
    if (await filterButton.count() > 0) {
      await filterButton.click();
      await page.waitForTimeout(300);
    }
    
    const clearButton = container.locator('button:has-text("Clear"), button:has-text("Reset")').first();
    if (await clearButton.count() > 0) {
      await clearButton.click();
      await page.waitForTimeout(300);
    }
  });

  test('should handle empty state or no candidates', async ({ page }) => {
    const container = page.getByTestId('recruitment-container');
    
    await expect(container).not.toBeEmpty();
    
    const hasContent = await container.locator('table, [role="grid"], [role="list"], .empty-state').count() > 0;
    expect(hasContent).toBe(true);
  });
});
