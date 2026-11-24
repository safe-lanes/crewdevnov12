import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Isolated renderer/adapter tests only; never start or reset a tenant database.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    "@": path.resolve("client/src"),
    "@shared": path.resolve("shared"),
  } },
  test: {
    environment: "happy-dom",
    setupFiles: ["tests/wage-revisions/setup.ts", "tests/helpers/forbid-database-connections.ts"],
    include: [
      "tests/point-comments/*.test.tsx",
      "tests/unit/configured-form-renderer.test.tsx",
      "tests/unit/briefing-live-submission-host.test.ts",
      "tests/unit/debriefing-live-submission-host.test.ts",
      "tests/unit/interview-live-submission-host.test.ts",
      "tests/unit/company-form-render-contract.test.tsx",
    ],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
