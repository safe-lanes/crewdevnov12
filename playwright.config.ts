import { defineConfig, devices } from '@playwright/test';
import { prepareTestEnvironment } from './scripts/test-database-guard.mjs';

await prepareTestEnvironment();

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: './test-results/playwright-report', open: 'never' }],
    ['json', { outputFile: './test-results/playwright-results.json' }],
    ['junit', { outputFile: './test-results/playwright-junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.TEST_API_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run test:backend',
    url: `${process.env.TEST_API_URL}/api/test-database-identity`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
