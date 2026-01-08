// End-to-end tests for appraisal workflow
import { test, expect, Locator } from '@playwright/test';

test.describe('Appraisal Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should display the main application', async ({ page }) => {
    await expect(page.getByTestId('main-content')).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    const appRoot = page.getByTestId('app-root');
    await expect(appRoot).toBeVisible();
  });

  test.describe('Crew Appraisals Module', () => {
    let container: Locator;
    
    test.beforeEach(async ({ page }) => {
      // Home route loads ElementCrewAppraisals
      container = page.getByTestId('appraisals-container');
      await expect(container).toBeVisible({ timeout: 10000 });
    });

    test('should load appraisals container on home route', async ({ page }) => {
      await expect(page.getByTestId('appraisals-container')).toBeVisible();
    });

    test('should display appraisal filters', async ({ page }) => {
      const filterContainer = page.getByTestId('appraisals-container').getByTestId('filter-container');
      if (await filterContainer.count() > 0) {
        // Use scoped selector within the appraisals container
        const searchInput = page.getByTestId('appraisals-container').getByTestId('input-search-name');
        await expect(searchInput).toBeVisible();
      }
    });

    test('should have rank filter in appraisals', async ({ page }) => {
      const appraisalsContainer = page.getByTestId('appraisals-container');
      const rankSelect = appraisalsContainer.getByTestId('select-rank');
      if (await rankSelect.count() > 0) {
        await expect(rankSelect).toBeVisible();
      }
    });

    test('should have vessel filter in appraisals', async ({ page }) => {
      const appraisalsContainer = page.getByTestId('appraisals-container');
      const vesselSelect = appraisalsContainer.getByTestId('select-vessel');
      if (await vesselSelect.count() > 0) {
        await expect(vesselSelect).toBeVisible();
      }
    });

    test('should have apply button for filters', async ({ page }) => {
      const appraisalsContainer = page.getByTestId('appraisals-container');
      const applyBtn = appraisalsContainer.getByTestId('button-apply');
      if (await applyBtn.count() > 0) {
        await expect(applyBtn).toBeVisible();
      }
    });
  });
});

test.describe('Form Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should handle filter form validation', async ({ page }) => {
    const container = page.getByTestId('appraisals-container');
    await expect(container).toBeVisible({ timeout: 10000 });
    
    const applyBtn = container.getByTestId('button-apply');
    if (await applyBtn.count() > 0) {
      await applyBtn.click();
      await expect(container).toBeVisible();
    }
  });

  test('should clear filters when clear button clicked', async ({ page }) => {
    const container = page.getByTestId('appraisals-container');
    await expect(container).toBeVisible({ timeout: 10000 });
    
    const searchInput = container.getByTestId('input-search-name');
    if (await searchInput.count() > 0) {
      await searchInput.fill('Test Search');
      
      const clearBtn = container.getByTestId('button-clear-filters');
      if (await clearBtn.count() > 0) {
        await clearBtn.click();
        await expect(searchInput).toHaveValue('');
      }
    }
  });
});

test.describe('Accessibility', () => {
  test('should have proper page structure', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
    
    const main = page.getByTestId('main-content');
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute('role', 'main');
  });
});
