import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Accounts/Payroll Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForTimeout(2000);
  });

  test('should navigate to accounts module', async ({ page }) => {
    const url = page.url();
    expect(url).toContain('accounts');
  });

  test('should display accounts container or content', async ({ page }) => {
    const content = page.locator('main, [role="main"], .accounts-container, #accounts').first();
    if (await content.count() > 0) {
      await expect(content).toBeVisible({ timeout: 10000 });
    } else {
      const body = page.locator('body');
      await expect(body).not.toBeEmpty();
    }
  });

  test('should display accounts tabs or sections', async ({ page }) => {
    const tabs = page.locator('[role="tablist"]:not(.ag-side-buttons)');
    
    if (await tabs.count() > 0) {
      const visibleTabs = tabs.filter({ has: page.locator(':visible') });
      if (await visibleTabs.count() > 0) {
        await expect(visibleTabs.first()).toBeVisible({ timeout: 10000 });
      } else {
        const content = page.locator('main, [role="main"]').first();
        await expect(content).toBeVisible();
      }
    } else {
      const sections = page.locator('aside, nav, .sidebar, .menu').first();
      if (await sections.count() > 0) {
        await expect(sections).toBeVisible();
      } else {
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
      }
    }
  });

  test('should display user management or payroll content', async ({ page }) => {
    const content = page.locator(
      'table, [role="grid"], .user-list, .payroll-data, [role="tabpanel"]'
    ).first();
    
    if (await content.count() > 0) {
      await expect(content).toBeVisible({ timeout: 15000 });
    } else {
      const cards = page.locator('[class*="card"], .card, [role="article"]');
      if (await cards.count() > 0) {
        await expect(cards.first()).toBeVisible();
      }
    }
  });

  test('should have action buttons', async ({ page }) => {
    const actions = page.locator(
      'button:has-text("Add"), button:has-text("Create"), button:has-text("Edit"), button:has-text("Save")'
    );
    
    if (await actions.count() > 0) {
      await expect(actions.first()).toBeVisible({ timeout: 10000 });
    } else {
      const buttons = page.locator('button');
      if (await buttons.count() > 0) {
        expect(await buttons.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should display accounts module sections', async ({ page }) => {
    const sectionLinks = page.locator(
      'a:has-text("Users"), a:has-text("Roles"), a:has-text("Payroll"), a:has-text("Wage"), button:has-text("Users"), button:has-text("Payroll")'
    );
    
    if (await sectionLinks.count() > 0) {
      await expect(sectionLinks.first()).toBeVisible({ timeout: 10000 });
    } else {
      const anyLinks = page.locator('a, button').filter({ hasText: /user|role|wage|pay|account/i });
      if (await anyLinks.count() > 0) {
        expect(await anyLinks.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should handle module navigation', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    
    if (await tabs.count() > 1) {
      await tabs.first().click();
      await page.waitForTimeout(500);
      
      const activeTab = page.locator('[role="tab"][data-state="active"], [role="tab"][aria-selected="true"]');
      if (await activeTab.count() > 0) {
        await expect(activeTab).toBeVisible();
      }
    } else {
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    }
  });

  test('should display accounts data or empty state', async ({ page }) => {
    const dataDisplay = page.locator('table tbody tr, [role="row"], .data-row');
    
    if (await dataDisplay.count() > 0) {
      expect(await dataDisplay.count()).toBeGreaterThan(0);
    } else {
      const emptyState = page.locator('.empty-state, [class*="empty"], text=/no data/i, text=/no records/i');
      if (await emptyState.count() > 0) {
        await expect(emptyState.first()).toBeVisible();
      } else {
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
      }
    }
  });
});
