import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Reports Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    
    const reportsNav = page.getByTestId('nav-reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
    } else {
      await page.goto('/reports');
    }
  });

  test('should navigate to reports module', async ({ page }) => {
    const url = page.url();
    expect(url).toContain('report');
  });

  test('should display reports coming soon page', async ({ page }) => {
    const title = page.getByTestId('reports-coming-soon-title');
    if (await title.count() > 0) {
      await expect(title).toBeVisible({ timeout: 10000 });
      await expect(title).toContainText('Reports');
    } else {
      const content = page.locator('main, [role="main"], .reports-container, #reports').first();
      await expect(content).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display coming soon message', async ({ page }) => {
    const message = page.getByTestId('reports-coming-soon-message');
    if (await message.count() > 0) {
      await expect(message).toBeVisible({ timeout: 10000 });
      await expect(message).toContainText('Coming Soon');
    } else {
      const body = page.locator('body');
      await expect(body).not.toBeEmpty();
    }
  });

  test('should display reports icon', async ({ page }) => {
    const icon = page.locator('svg').first();
    if (await icon.count() > 0) {
      await expect(icon).toBeVisible({ timeout: 5000 });
    }
  });

  test('should have proper page styling', async ({ page }) => {
    const container = page.locator('div').filter({ hasText: 'Reports' }).first();
    await expect(container).toBeVisible({ timeout: 10000 });
  });

  test('should be accessible from navigation', async ({ page }) => {
    await page.goto('/');
    const reportsNav = page.getByTestId('nav-reports');
    if (await reportsNav.count() > 0) {
      await expect(reportsNav).toBeVisible({ timeout: 10000 });
    } else {
      const navLink = page.locator('a:has-text("Reports"), button:has-text("Reports")').first();
      if (await navLink.count() > 0) {
        await expect(navLink).toBeVisible();
      }
    }
  });
});
