import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// These suites are pure calculations or mock their API/database boundaries.
// Do not use the DB-backed global setup for read-only UI regression checks.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/helpers/forbid-database-connections.ts", "@testing-library/jest-dom/vitest"],
    include: [
      "tests/unit/rotation-assignment-dates.test.ts",
      "tests/unit/reliever-status-save.test.tsx",
      "tests/unit/training-compliance-ui.test.tsx",
      "tests/unit/onboard-training-matrix-ui.test.tsx",
      "tests/unit/training-suggestion-actions-ui.test.tsx",
      "tests/unit/training-compliance-calculator.test.ts",
      "tests/unit/training-compliance-case-table.test.ts",
      "tests/unit/onboard-training-compliance.test.ts",
      "tests/unit/training-checklist-policy.test.ts",
      "tests/unit/training-checklist-combined-gate.test.ts",
    ],
    fileParallelism: false,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@server": path.resolve(import.meta.dirname, "server"),
    },
  },
});
