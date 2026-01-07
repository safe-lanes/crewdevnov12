// E2E tests for comprehensive module coverage
import { test, expect } from '@playwright/test';

// Use desktop viewport
test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Recruitment Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to recruitment module', async ({ page }) => {
    await page.getByTestId('nav-recruitment').click();
    await expect(page.getByTestId('recruitment-container')).toBeVisible({ timeout: 15000 });
  });

  test('should display recruitment controls', async ({ page }) => {
    await page.getByTestId('nav-recruitment').click();
    const container = page.getByTestId('recruitment-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    // Check for new crew button
    const newCrewBtn = container.getByTestId('button-new-crew');
    await expect(newCrewBtn).toBeVisible({ timeout: 5000 });
  });

  test('should have filter toggle button', async ({ page }) => {
    await page.getByTestId('nav-recruitment').click();
    const container = page.getByTestId('recruitment-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    const filterBtn = container.getByTestId('button-toggle-filters');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Rotation Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to rotation module', async ({ page }) => {
    await page.getByTestId('nav-rotation').click();
    await expect(page.getByTestId('rotation-container')).toBeVisible({ timeout: 15000 });
  });

  test('should display rotation content', async ({ page }) => {
    await page.getByTestId('nav-rotation').click();
    const container = page.getByTestId('rotation-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    // Verify the container is not empty
    await expect(container).not.toBeEmpty();
  });
});

test.describe('Promotions Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to promotions module', async ({ page }) => {
    await page.getByTestId('nav-promotions').click();
    await expect(page.getByTestId('promotions-container')).toBeVisible({ timeout: 15000 });
  });

  test('should display promotions filters', async ({ page }) => {
    await page.getByTestId('nav-promotions').click();
    const container = page.getByTestId('promotions-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    // Check for filter toggle
    const filterBtn = container.getByTestId('button-toggle-filters');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
  });

  test('should toggle filters visibility', async ({ page }) => {
    await page.getByTestId('nav-promotions').click();
    const container = page.getByTestId('promotions-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    // Toggle filters - verify button can be clicked
    const filterBtn = container.getByTestId('button-toggle-filters');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
    await filterBtn.click();
    
    // Toggle back - verify button still works
    await filterBtn.click();
    
    // Button should remain visible after toggles
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Drugs & Alcohol Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to drugs & alcohol module', async ({ page }) => {
    await page.getByTestId('nav-drugs-alcohol').click();
    await expect(page.getByTestId('drugs-alcohol-container')).toBeVisible({ timeout: 15000 });
  });

  test('should display D&A module content', async ({ page }) => {
    await page.getByTestId('nav-drugs-alcohol').click();
    const container = page.getByTestId('drugs-alcohol-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    // Verify the container is not empty
    await expect(container).not.toBeEmpty();
  });

  test('should have filter controls', async ({ page }) => {
    await page.getByTestId('nav-drugs-alcohol').click();
    const container = page.getByTestId('drugs-alcohol-container');
    await expect(container).toBeVisible({ timeout: 15000 });
    
    // Check for filter toggle button
    const filterBtn = container.getByTestId('button-toggle-filters');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Cross-Module Navigation', () => {
  test('should navigate through all modules', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
    
    // Navigate to Recruitment
    await page.getByTestId('nav-recruitment').click();
    await expect(page.getByTestId('recruitment-container')).toBeVisible({ timeout: 15000 });
    
    // Navigate to Rotation
    await page.getByTestId('nav-rotation').click();
    await expect(page.getByTestId('rotation-container')).toBeVisible({ timeout: 15000 });
    
    // Navigate to Promotions
    await page.getByTestId('nav-promotions').click();
    await expect(page.getByTestId('promotions-container')).toBeVisible({ timeout: 15000 });
    
    // Navigate to D&A
    await page.getByTestId('nav-drugs-alcohol').click();
    await expect(page.getByTestId('drugs-alcohol-container')).toBeVisible({ timeout: 15000 });
    
    // Navigate to Crew Pool
    await page.getByTestId('nav-crew-pool').click();
    await expect(page.getByTestId('crew-pool-container')).toBeVisible({ timeout: 15000 });
    
    // Navigate to Vessel
    await page.getByTestId('nav-vessel').click();
    await expect(page.getByTestId('vessel-container')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Module Container Stability', () => {
  test('should maintain container stability on refresh', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
    
    // Navigate to a module
    await page.getByTestId('nav-recruitment').click();
    await expect(page.getByTestId('recruitment-container')).toBeVisible({ timeout: 15000 });
    
    // Refresh page
    await page.reload();
    
    // Should still show app root
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });
  });
});
