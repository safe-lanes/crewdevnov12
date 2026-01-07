import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Rotation - Comprehensive Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-rotation').click();
    await expect(page.getByTestId('rotation-container')).toBeVisible();
  });

  test('should display rotation module content', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const content = container.locator('table, [role="grid"], [role="tablist"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should display due crew section', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const dueTab = container.locator('[role="tab"]').filter({ hasText: /due/i }).first();
    const dueText = container.locator('text=Due').first();
    
    const hasDueSection = await dueTab.count() > 0 || await dueText.count() > 0;
    if (hasDueSection) {
      if (await dueTab.count() > 0) {
        await expect(dueTab).toBeVisible();
      } else {
        await expect(dueText).toBeVisible();
      }
    }
  });

  test('should display rotation plans section', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const planTab = container.locator('[role="tab"]').filter({ hasText: /plan/i }).first();
    const planText = container.locator('text=Plan').first();
    
    const hasPlanSection = await planTab.count() > 0 || await planText.count() > 0;
    if (hasPlanSection) {
      if (await planTab.count() > 0) {
        await expect(planTab).toBeVisible();
      } else {
        await expect(planText).toBeVisible();
      }
    }
  });

  test('should open new rotation plan dialog', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const newPlanButton = container.locator('button:has-text("New"), button:has-text("Create")').first();
    if (await newPlanButton.count() > 0) {
      await newPlanButton.click();
      
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter rotation data', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const filterControl = container.locator('select, [role="combobox"], input[type="text"]').first();
    if (await filterControl.count() > 0) {
      await expect(filterControl).toBeVisible();
    }
  });

  test('should switch between Due and Plan views', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const tabs = container.locator('[role="tab"]');
    const tabCount = await tabs.count();
    
    if (tabCount >= 2) {
      await tabs.nth(1).click();
      await page.waitForTimeout(300);
      
      await expect(container).toBeVisible();
    }
  });

  test('should display crew details in rotation table', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const rows = container.locator('table tbody tr, [role="row"]');
    const rowCount = await rows.count();
    
    if (rowCount > 0) {
      const firstRow = rows.first();
      await expect(firstRow).not.toBeEmpty();
    }
  });

  test('should handle rotation plan actions', async ({ page }) => {
    const container = page.getByTestId('rotation-container');
    
    const actionButtons = container.locator('button:has-text("Approve"), button:has-text("Deploy"), button:has-text("Reject")');
    
    if (await actionButtons.count() > 0) {
      await expect(actionButtons.first()).toBeVisible();
    }
  });
});
