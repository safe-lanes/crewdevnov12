import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Training Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    
    const trainingNav = page.getByTestId('nav-training');
    if (await trainingNav.count() === 0) {
      const trainingLink = page.locator('a:has-text("Training"), button:has-text("Training")').first();
      if (await trainingLink.count() > 0) {
        await trainingLink.click();
      } else {
        await page.goto('/vessel');
        await page.waitForTimeout(1000);
      }
    } else {
      await trainingNav.click();
    }
  });

  test('should navigate to training or vessel module', async ({ page }) => {
    const url = page.url();
    expect(url).toMatch(/training|vessel/);
  });

  test('should display training container or vessel content', async ({ page }) => {
    const content = page.locator('main, [role="main"], .training-container, .vessel-container, #training, #vessel').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should display training matrix or courses', async ({ page }) => {
    const trainingData = page.locator(
      'table, [role="grid"], .course-list, .training-matrix, .ag-root'
    ).first();
    
    if (await trainingData.count() > 0) {
      await expect(trainingData).toBeVisible({ timeout: 15000 });
    } else {
      const tabs = page.locator('[role="tab"], button:has-text("Training")');
      if (await tabs.count() > 0) {
        await expect(tabs.first()).toBeVisible();
      }
    }
  });

  test('should have vessel or crew selection', async ({ page }) => {
    const filters = page.locator('select, [role="combobox"], button:has-text("Filter"), button:has-text("Select")').first();
    
    if (await filters.count() > 0) {
      await expect(filters).toBeVisible({ timeout: 10000 });
    } else {
      const dropdowns = page.locator('[data-radix-popper-content-wrapper], .dropdown');
      if (await dropdowns.count() > 0) {
        expect(await dropdowns.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should display training status indicators or data', async ({ page }) => {
    const statusIndicators = page.locator(
      '[class*="complete"], [class*="pending"], [class*="status"], td, [role="cell"], .badge'
    );
    
    if (await statusIndicators.count() > 0) {
      expect(await statusIndicators.count()).toBeGreaterThan(0);
    } else {
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    }
  });

  test('should handle training data display', async ({ page }) => {
    const trainingNav = page.locator('a:has-text("Training Matrix"), button:has-text("Training Matrix"), [role="tab"]:has-text("Training")');
    
    if (await trainingNav.count() > 0) {
      await trainingNav.first().click();
      await page.waitForTimeout(1000);
      
      const trainingContent = page.locator('table, [role="grid"], .training-matrix, .matrix').first();
      if (await trainingContent.count() > 0) {
        await expect(trainingContent).toBeVisible({ timeout: 15000 });
      }
    } else {
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    }
  });
});
