import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    "@": path.resolve("client/src"), "@shared": path.resolve("shared"), "@server": path.resolve("server"),
  } },
  test: {
    environment: "happy-dom", setupFiles: ["tests/wage-revisions/setup.ts"],
    include: ["tests/initial-standard-draft/*.test.{ts,tsx}",
      "tests/unit/generic-form-editor-*.test.{ts,tsx}", "tests/unit/forms-list-*.test.{ts,tsx}",
      "tests/unit/forms-version-effectiveness.test.ts", "tests/unit/appraisal-*.test.ts"],
    fileParallelism: false, testTimeout: 20000,
  },
});
