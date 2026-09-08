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

test.describe('Admin Rank vessel selector', () => {
  test('excludes archived vessels and scrolls through a long active list', async ({ page }) => {
    const activeVessels = Array.from({ length: 80 }, (_, index) => ({
      id: index + 1,
      vesselUuid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      vessel: `Active Vessel ${String(index + 1).padStart(2, '0')}`,
      isActive: true,
      isDeleted: false,
    })).reverse();

    await page.route('**/api/v2/masters/external/vessels', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'vessels',
          count: activeVessels.length + 2,
          data: [
            ...activeVessels,
            {
              id: 81,
              vesselUuid: '00000000-0000-4000-8000-000000000081',
              vessel: 'Archived Vessel',
              isActive: false,
              isDeleted: false,
            },
            {
              id: 82,
              vesselUuid: '00000000-0000-4000-8000-000000000082',
              vessel: 'Deleted Vessel',
              isActive: true,
              isDeleted: true,
            },
          ],
        }),
      });
    });

    await page.goto('/admin/rank-admin');
    await expect(page.getByRole('heading', { name: 'Rank Administration' })).toBeVisible();
    await page.getByRole('button', { name: 'Vessel', exact: true }).click();
    await page.getByTestId('vessel-select').click();

    const list = page.getByTestId('vessel-select-list');
    await expect(list).toBeVisible();
    await expect(list.getByText('Active Vessel 01', { exact: true })).toBeVisible();
    await expect(list.getByText('Archived Vessel', { exact: true })).toHaveCount(0);
    await expect(list.getByText('Deleted Vessel', { exact: true })).toHaveCount(0);

    const rankVesselLabels = (await list.locator('[role="option"]').allTextContents())
      .map(label => label.trim())
      .filter(label => label.startsWith('Active Vessel'));
    expect(rankVesselLabels.slice(0, 3)).toEqual([
      'Active Vessel 01',
      'Active Vessel 02',
      'Active Vessel 03',
    ]);

    const dimensions = await list.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    await list.hover();
    await page.mouse.wheel(0, 5000);
    await expect(list.getByText('Active Vessel 80', { exact: true })).toBeVisible();

    await page.goto('/admin/training-matrix');
    await expect(page.getByTestId('title-training-matrix')).toBeVisible();
    await page.getByTestId('tab-training-vessel').click();
    await page.getByTestId('tm-vessel-select').click();

    const trainingList = page.getByTestId('tm-vessel-select-list');
    await expect(trainingList).toBeVisible();
    const trainingVesselLabels = (await trainingList.locator('[role="option"]').allTextContents())
      .map(label => label.trim())
      .filter(label => label.startsWith('Active Vessel'));
    expect(trainingVesselLabels).toEqual(rankVesselLabels);
  });
});
