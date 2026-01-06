import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';

// Create test results directories
const directories = [
  'test-results',
  'test-results/history',
  'test-logs',
  'coverage',
];

beforeAll(() => {
  directories.forEach((dir) => {
    const dirPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Clean up any test artifacts if needed
});

// Global test utilities
declare global {
  var testStartTime: number;
}

globalThis.testStartTime = Date.now();
