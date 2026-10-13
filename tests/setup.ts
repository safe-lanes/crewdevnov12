import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import { installConnectionGuard } from '../scripts/test-database-guard.mjs';
import { verifyTestBackend } from './helpers/test-backend';
import pg from 'pg';

installConnectionGuard();
await verifyTestBackend();

// Create test results directories
const directories = [
  'test-results',
  'test-results/history',
  'test-logs',
  'coverage',
];

const cleanupPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
let startingFormIds: number[] = [];
beforeAll(async () => {
  directories.forEach((dir) => {
    const dirPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  startingFormIds = (await cleanupPool.query("SELECT id FROM adm_forms_v2")).rows.map(row => row.id);
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  // Explicit scoped cleanup, not SQL interception. Immutable requirement
  // history may pin a transient released definition; archive those leftovers
  // so their fleet-wide rules cannot affect the next serial suite.
  await cleanupPool.query(`UPDATE adm_forms_v2 SET is_deleted=true
    WHERE NOT (id=ANY($1::int[])) AND NOT is_deleted`, [startingFormIds]);
  await cleanupPool.end();
});

// Global test utilities
declare global {
  var testStartTime: number;
}

globalThis.testStartTime = Date.now();
