// End-to-end tests for crew management
import { test, expect } from '@playwright/test';

// Use desktop viewport for all tests to ensure filter visibility
test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Crew Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should load the application with navigation', async ({ page }) => {
    await expect(page.getByTestId('main-content')).toBeVisible();
    
    // Navigation items should be accessible
    const navCrewPool = page.getByTestId('nav-crew-pool');
    await expect(navCrewPool).toBeVisible();
  });

  test.describe('Crew Pool Module', () => {
    test('should navigate to crew pool', async ({ page }) => {
      await page.getByTestId('nav-crew-pool').click();
      await expect(page.getByTestId('crew-pool-container')).toBeVisible({ timeout: 15000 });
    });

    test('should display filters in crew pool', async ({ page }) => {
      await page.getByTestId('nav-crew-pool').click();
      const container = page.getByTestId('crew-pool-container');
      await expect(container).toBeVisible({ timeout: 15000 });
      
      // Filters are visible by default - check for search input
      const searchInput = container.getByTestId('input-search-name');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Search and Filter', () => {
    test('should use search functionality when available', async ({ page }) => {
      await page.getByTestId('nav-crew-pool').click();
      const container = page.getByTestId('crew-pool-container');
      await expect(container).toBeVisible({ timeout: 15000 });
      
      // Filters are visible by default - use scoped search input
      const searchInput = container.getByTestId('input-search-name');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill('Test');
      
      const applyBtn = container.getByTestId('button-apply');
      await expect(applyBtn).toBeVisible({ timeout: 5000 });
      await applyBtn.click();
    });

    test('should clear filters when clear button clicked', async ({ page }) => {
      await page.getByTestId('nav-crew-pool').click();
      const container = page.getByTestId('crew-pool-container');
      await expect(container).toBeVisible({ timeout: 15000 });
      
      // Filters are visible by default
      const searchInput = container.getByTestId('input-search-name');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill('Test');
      
      // Clear filters
      const clearBtn = container.getByTestId('button-clear');
      await expect(clearBtn).toBeVisible({ timeout: 5000 });
      await clearBtn.click();
      await expect(searchInput).toHaveValue('');
    });
  });
});

test.describe('Vessel Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to vessel module', async ({ page }) => {
    await page.getByTestId('nav-vessel').click();
    await expect(page.getByTestId('vessel-container')).toBeVisible({ timeout: 15000 });
  });

  test('should display vessel container with content', async ({ page }) => {
    await page.getByTestId('nav-vessel').click();
    const container = page.getByTestId('vessel-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    // Verify the vessel module has loaded content
    await expect(container).not.toBeEmpty();
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Error Handling', () => {
  test('should handle invalid routes gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });
});
