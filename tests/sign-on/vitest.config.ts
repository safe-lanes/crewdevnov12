import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Isolated checks: never bootstrap the application or reset its database.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    "@": path.resolve("client/src"),
    "@shared": path.resolve("shared"),
  } },
  test: {
    environment: "happy-dom",
    include: [
      "tests/sign-on/*.test.{ts,tsx}",
      "tests/unit/joining-company-forms.test.tsx",
      "tests/unit/modules/vessel/onboard-duration*.test.{ts,tsx}",
      "tests/unit/components/formatted-date-input.test.tsx",
    ],
    setupFiles: ["tests/wage-revisions/setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
