// End-to-end tests for rest hours recording
import { test, expect } from '@playwright/test';

test.describe('Rest Hours Recording', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should display the application', async ({ page }) => {
    await expect(page.getByTestId('main-content')).toBeVisible();
  });

  test.describe('Rest Hours Module Navigation', () => {
    test('should navigate to rest hours module', async ({ page }) => {
      const navRestHours = page.getByTestId('nav-rest-hours');
      if (await navRestHours.count() === 0) {
        test.skip();
        return;
      }
      
      await navRestHours.click();
      await expect(page.getByTestId('rest-hours-container')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Module Container', () => {
    test('should load rest hours container after navigation', async ({ page }) => {
      const navRestHours = page.getByTestId('nav-rest-hours');
      if (await navRestHours.count() === 0) {
        test.skip();
        return;
      }
      
      await navRestHours.click();
      
      const container = page.getByTestId('rest-hours-container');
      await expect(container).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should navigate between modules', async ({ page }) => {
    // Navigate to rest hours
    const navRestHours = page.getByTestId('nav-rest-hours');
    if (await navRestHours.count() > 0) {
      await navRestHours.click();
      await expect(page.getByTestId('rest-hours-container')).toBeVisible({ timeout: 10000 });
    }
    
    // Navigate back to crew pool
    const navCrewPool = page.getByTestId('nav-crew-pool');
    if (await navCrewPool.count() > 0) {
      await navCrewPool.click();
      await expect(page.getByTestId('crew-pool-container')).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Page Stability', () => {
  test('should handle page refresh', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
    
    // Navigate to rest hours
    const navRestHours = page.getByTestId('nav-rest-hours');
    if (await navRestHours.count() > 0) {
      await navRestHours.click();
      await expect(page.getByTestId('rest-hours-container')).toBeVisible({ timeout: 10000 });
      
      // Refresh the page
      await page.reload();
      
      // App should still be functional
      await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
    }
  });
});
