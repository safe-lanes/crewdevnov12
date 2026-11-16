import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Isolated regressions: no application bootstrap, reset script or development DB.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    "@": path.resolve("client/src"),
    "@shared": path.resolve("shared"),
  } },
  test: {
    environment: "happy-dom",
    include: [
      "tests/wage-revisions/*.test.{ts,tsx}",
      "tests/unit/components/formatted-date-input.test.tsx",
      "tests/unit/wage-engine-period-math.test.ts",
    ],
    setupFiles: ["tests/wage-revisions/setup.ts"],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
