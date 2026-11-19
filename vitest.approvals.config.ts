import { defineConfig } from 'vitest/config';
import path from 'path';

// Approval engine + Crewing approvals unit tests. No database, no test-database guard:
//   npx vitest run --config vitest.approvals.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'server/v2/approval-engine/__tests__/**/*.test.ts',
      'server/v2/approvals/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@': path.resolve(__dirname, 'client', 'src'),
    },
  },
});
