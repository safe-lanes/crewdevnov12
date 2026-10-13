import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { prepareTestEnvironment } from './scripts/test-database-guard.mjs';

await prepareTestEnvironment();

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    environmentOptions: { happyDOM: { url: process.env.TEST_API_URL } },
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Fleet-wide automatic applicability must not resolve another suite's
    // transient applies-to-all fixture while that fixture is being exercised.
    fileParallelism: false,
    hookTimeout: 60000,
    sequence: { hooks: 'stack' },
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**/*', 'node_modules/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        '*.config.js',
        'dist/',
        'scripts/',
        'migrations/',
        'attached_assets/',
        'backups/',
        'docs/',
        'rollback_scripts/',
      ],
      all: true,
    },
    reporters: ['verbose', 'json', 'junit', 'html'],
    outputFile: {
      json: './test-results/results.json',
      junit: './test-results/junit.xml',
      html: './test-results/index.html',
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
