import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/production.ts"), "utf8");

describe("production API authentication wiring", () => {
  it("installs JWT authentication after tenant resolution and before API routes", () => {
    const tenantMiddlewareUse = source.indexOf("app.use(tenantMiddleware)");
    const authMiddlewareUse = source.indexOf("app.use(authMiddleware)");
    const routeRegistration = source.indexOf("registerRoutes(app)");

    expect(source).toContain(
      'import { authMiddleware } from "./middleware/authMiddleware";',
    );
    expect(tenantMiddlewareUse).toBeGreaterThan(-1);
    expect(authMiddlewareUse).toBeGreaterThan(tenantMiddlewareUse);
    expect(routeRegistration).toBeGreaterThan(authMiddlewareUse);
  });
});