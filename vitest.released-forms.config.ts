import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// DB-free companion to tests/initial-standard-draft/vitest.config.ts, whose
// database suite starts and destroys its own socket-only PostgreSQL instance.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: [
      "./tests/helpers/forbid-database-connections.ts",
      "./tests/helpers/forbid-form-database.ts",
      "@testing-library/jest-dom/vitest",
    ],
    include: [
      "tests/unit/forms-rank-*.test.ts",
      "tests/unit/briefing-*.test.ts",
      "tests/unit/interview-*.test.ts",
      "tests/unit/debriefing-*.test.ts",
    ],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@server": path.resolve(import.meta.dirname, "server"),
    },
  },
});
