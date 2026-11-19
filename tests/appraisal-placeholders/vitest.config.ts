import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") } },
  test: {
    environment: "happy-dom",
    include: ["tests/appraisal-placeholders/*.test.tsx"],
    setupFiles: ["tests/wage-revisions/setup.ts"],
  },
});
