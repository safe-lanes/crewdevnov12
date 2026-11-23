import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Only isolated UI suites: do not initialize or reset a tenant database.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    "@": path.resolve("client/src"),
    "@shared": path.resolve("shared"),
  } },
  test: {
    environment: "happy-dom",
    include: [
      "tests/unit/signoff-planning-popup.test.tsx",
      "tests/unit/signoff-company-forms.test.tsx",
      "tests/unit/modules/vessel/onboard-duration*.test.{ts,tsx}",
    ],
    setupFiles: ["tests/wage-revisions/setup.ts"],
    fileParallelism: false,
  },
});
