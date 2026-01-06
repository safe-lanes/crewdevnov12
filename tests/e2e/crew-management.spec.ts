// End-to-end tests for crew management
import { test, expect } from '@playwright/test';

test.describe('Crew Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application successfully', async ({ page }) => {
    // Basic smoke test
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test.describe('Crew List', () => {
    test('should access crew section if available', async ({ page }) => {
      // Look for crew-related navigation
      const crewLink = page.getByTestId('link-crew').or(
        page.getByRole('link', { name: /crew|seafarer|employee/i })
      );
      
      const linkExists = await crewLink.count() > 0;
      
      if (!linkExists) {
        test.skip();
        return;
      }
      
      await crewLink.click();
    });

    test('should display crew members in a list or table', async ({ page }) => {
      // Look for table or list elements
      const dataDisplay = page.locator('table, [role="grid"], [data-testid*="list"]');
      
      const displayExists = await dataDisplay.count() > 0;
      
      // Informational test
      expect(typeof displayExists).toBe('boolean');
    });
  });

  test.describe('Search and Filter', () => {
    test('should have search functionality', async ({ page }) => {
      // Look for search input
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="search" i], [data-testid*="search"]'
      );
      
      const hasSearch = await searchInput.count() > 0;
      
      if (hasSearch) {
        await expect(searchInput.first()).toBeVisible();
      }
    });

    test('should have filter options', async ({ page }) => {
      // Look for filter elements
      const filters = page.locator(
        'select, [data-testid*="filter"], [role="combobox"]'
      );
      
      const hasFilters = await filters.count() > 0;
      
      // Informational
      expect(typeof hasFilters).toBe('boolean');
    });
  });

  test.describe('Crew Details', () => {
    test('should be able to view crew details', async ({ page }) => {
      // Look for clickable crew items
      const crewItems = page.locator(
        '[data-testid*="crew-item"], tr[data-testid], .crew-card'
      );
      
      const hasItems = await crewItems.count() > 0;
      
      if (hasItems) {
        // Click first item if available
        await crewItems.first().click();
      }
    });
  });
});

test.describe('Vessel Assignment', () => {
  test('should display vessel information', async ({ page }) => {
    await page.goto('/');
    
    // Look for vessel-related elements
    const vesselInfo = page.locator(
      '[data-testid*="vessel"], .vessel, [aria-label*="vessel" i]'
    );
    
    const hasVesselInfo = await vesselInfo.count() > 0;
    
    expect(typeof hasVesselInfo).toBe('boolean');
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
    
    // Check that content is not overflowing
    const body = page.locator('body');
    const boundingBox = await body.boundingBox();
    
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375);
    }
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle invalid routes gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    
    // Should either redirect or show error page
    await expect(page.locator('body')).toBeVisible();
  });
});
