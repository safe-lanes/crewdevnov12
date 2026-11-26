import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared"), "@server": path.resolve("server") } },
  test: { environment: "node", include: ["tests/draft-save/*.test.ts"], fileParallelism: false, testTimeout: 20000 },
});
