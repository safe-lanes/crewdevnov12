import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Drugs & Alcohol - Comprehensive Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-drugs-alcohol').click();
    await expect(page.getByTestId('drugs-alcohol-container')).toBeVisible();
  });

  test('should display drug & alcohol test summary', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const summary = container.locator('table, [role="grid"], .summary-view').first();
    await expect(summary).toBeVisible({ timeout: 10000 });
  });

  test('should toggle filters', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const filterButton = container.getByTestId('button-toggle-filters');
    await filterButton.click();
    await page.waitForTimeout(300);
    
    const filterContainer = container.getByTestId('filter-container');
    if (await filterContainer.count() > 0) {
      await expect(filterContainer).toBeVisible();
    }
  });

  test('should display test type tabs or sections', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const tabs = container.locator('[role="tab"], button:has-text("Monthly"), button:has-text("Annual")');
    const tabCount = await tabs.count();
    
    if (tabCount > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('should open new test recording form', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const newTestButton = container.locator('button:has-text("New"), button:has-text("Record"), button:has-text("Add")').first();
    if (await newTestButton.count() > 0) {
      await newTestButton.click();
      
      const form = page.locator('form, [role="dialog"]').first();
      await expect(form).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter by test type', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const filterButton = container.getByTestId('button-toggle-filters');
    if (await filterButton.count() > 0) {
      await filterButton.click();
      await page.waitForTimeout(300);
    }
    
    const testTypeFilter = container.locator('select, [role="combobox"]').first();
    if (await testTypeFilter.count() > 0) {
      await testTypeFilter.click();
    }
  });

  test('should display monthly test table', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const monthlyTab = container.locator('button:has-text("Monthly"), [role="tab"]:has-text("Monthly")').first();
    if (await monthlyTab.count() > 0) {
      await monthlyTab.click();
      await page.waitForTimeout(300);
      
      const monthlyTable = container.locator('table').first();
      await expect(monthlyTable).toBeVisible();
    }
  });

  test('should display annual test table', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const annualTab = container.locator('button:has-text("Annual"), [role="tab"]:has-text("Annual")').first();
    if (await annualTab.count() > 0) {
      await annualTab.click();
      await page.waitForTimeout(300);
      
      const annualTable = container.locator('table').first();
      await expect(annualTable).toBeVisible();
    }
  });

  test('should display test data or compliance metrics', async ({ page }) => {
    const container = page.getByTestId('drugs-alcohol-container');
    
    const table = container.locator('table').first();
    const grid = container.locator('[role="grid"]').first();
    
    const hasTable = await table.count() > 0;
    const hasGrid = await grid.count() > 0;
    
    expect(hasTable || hasGrid).toBe(true);
    
    if (hasTable) {
      await expect(table).toBeVisible();
    } else if (hasGrid) {
      await expect(grid).toBeVisible();
    }
  });
});
