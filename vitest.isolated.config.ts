import { defineConfig } from "vitest/config";
import path from "node:path";

// Explicitly selected tests mock their database boundaries. Database-backed
// suites must continue to use vitest.config.ts and its verified test target.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/helpers/forbid-database-connections.ts"],
    include: [
      "tests/unit/appraisal-create-version-ratings.test.ts",
      "tests/unit/appraisal-effectiveness.test.ts",
      "tests/unit/crew-reactivation.test.ts",
      "tests/unit/forms-version-effectiveness.test.ts",
      "tests/unit/attachment-converter.test.ts",
      "tests/unit/attachment-converter-training-matching.test.ts",
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
