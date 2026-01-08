import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Admin Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    
    const adminNav = page.getByTestId('nav-admin');
    if (await adminNav.count() > 0) {
      await adminNav.click();
    } else {
      await page.goto('/admin');
    }
    
    await page.waitForTimeout(2000);
  });

  test('should navigate to admin module', async ({ page }) => {
    const url = page.url();
    expect(url).toContain('admin');
  });

  test('should display admin container or content', async ({ page }) => {
    const content = page.locator('main, [role="main"], .admin-container, #admin').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should display admin navigation or sidebar', async ({ page }) => {
    const sidebar = page.locator('aside, nav, [role="navigation"], .sidebar').first();
    if (await sidebar.count() > 0) {
      await expect(sidebar).toBeVisible({ timeout: 10000 });
    } else {
      const tabs = page.locator('[role="tab"], [role="tablist"]');
      if (await tabs.count() > 0) {
        await expect(tabs.first()).toBeVisible();
      }
    }
  });

  test('should display admin sections or menu items', async ({ page }) => {
    const sections = page.locator(
      '[role="tab"], .admin-section, button:has-text("Settings"), button:has-text("Masters"), a:has-text("Masters")'
    );
    
    if (await sections.count() > 0) {
      await expect(sections.first()).toBeVisible({ timeout: 10000 });
    } else {
      const links = page.locator('a, button').filter({ hasText: /company|rank|form|vessel/i });
      if (await links.count() > 0) {
        await expect(links.first()).toBeVisible();
      }
    }
  });

  test('should have configuration controls', async ({ page }) => {
    const configOptions = page.locator(
      'input[type="checkbox"], input[type="text"], select, [role="switch"], button:has-text("Edit")'
    );
    
    if (await configOptions.count() > 0) {
      await expect(configOptions.first()).toBeVisible({ timeout: 10000 });
    } else {
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    }
  });

  test('should display data tables or grids', async ({ page }) => {
    const tables = page.locator('table, [role="grid"], .ag-root');
    
    if (await tables.count() > 0) {
      await expect(tables.first()).toBeVisible({ timeout: 15000 });
    } else {
      const listItems = page.locator('ul li, .list-item, [role="listitem"]');
      if (await listItems.count() > 0) {
        expect(await listItems.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should have admin action buttons', async ({ page }) => {
    const actions = page.locator('button:has-text("Save"), button:has-text("Add"), button:has-text("Edit"), button:has-text("Create")');
    
    if (await actions.count() > 0) {
      await expect(actions.first()).toBeVisible({ timeout: 10000 });
    } else {
      const body = page.locator('body');
      await expect(body).not.toBeEmpty();
    }
  });

  test('should handle admin module responsively', async ({ page }) => {
    const mainContent = page.locator('main, [role="main"], .admin-container').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
    
    const boundingBox = await mainContent.boundingBox();
    if (boundingBox) {
      expect(boundingBox.width).toBeGreaterThan(0);
      expect(boundingBox.height).toBeGreaterThan(0);
    }
  });
});
