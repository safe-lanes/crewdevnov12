import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") } },
  test: {
    environment: "happy-dom",
    include: ["tests/crew-profile-validation/*.test.{ts,tsx}",
      "tests/unit/crewD3FirstCreateLifecycle.test.ts", "tests/unit/d3MatrixDefaults.test.ts",
      "tests/unit/components/formatted-date-input.test.tsx", "tests/unit/components/da-date-input.test.tsx"],
    setupFiles: ["tests/wage-revisions/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
