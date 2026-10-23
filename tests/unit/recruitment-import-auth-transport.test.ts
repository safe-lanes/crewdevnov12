// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
vi.mock("../../server/utils/tenantConnectionManager", () => {
  class TenantNotFoundError extends Error {}
  class TenantInactiveError extends Error {}
  class TenantDatabaseError extends Error {}
  return {
    TenantNotFoundError, TenantInactiveError, TenantDatabaseError,
    tenantConnectionManager: {
      isMultiTenantEnabled: true,
      validateTuid: vi.fn(async (id: string) => {
        if (id !== "tenant-one") throw new TenantNotFoundError();
        return { domain: "company-one" };
      }),
      resolveTenant: vi.fn(async (domain: string) => ({ tuid: domain === "company-one" ? "tenant-one" : "tenant-other" })),
      runInTenantContext: vi.fn(async (_id: string, fn: () => unknown) => fn()),
    },
  };
});
let app: express.Express;
const testSigningKey = "isolated-test-fixture-not-a-real-credential";
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", testSigningKey);
  vi.stubEnv("AUTH_BYPASS", "false");
  vi.stubEnv("NODE_ENV", "production");
  const { tenantMiddleware } = await import("../../server/middleware/tenantMiddleware");
  const { authMiddleware } = await import("../../server/middleware/authMiddleware");
  app = express();
  app.use(express.json(), tenantMiddleware, authMiddleware);
  // Probe the actual authentication/tenant middleware, without changing the running app or using a real credential.
  app.all("/api/v2/recruitment/import/:action", (req, res) => res.json({ tenantId: req.tenantId, userUuid: (req.user as any).userUuid }));
});
afterAll(() => vi.unstubAllEnvs());
describe("Import transport with JWT authentication and tenant resolution enabled", () => {
  for (const action of ["template", "validate", "execute"]) it(`${action} reaches the verified user/tenant with explicit headers`, async () => {
    const token = jwt.sign({ id: 123, domain: "company-one", userType: "Office", userUuid: "verified-user" }, testSigningKey);
    const res = action === "template"
      ? await request(app).get(`/api/v2/recruitment/import/${action}`).set("Authorization", `Bearer ${token}`).set("x-tenant-id", "tenant-one")
      : await request(app).post(`/api/v2/recruitment/import/${action}`).set("Authorization", `Bearer ${token}`).set("x-tenant-id", "tenant-one").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tenantId: "tenant-one", userUuid: "verified-user" });
  });
  it("does not treat credentials/cookies as bearer authentication", async () => {
    const res = await request(app).get("/api/v2/recruitment/import/template").set("x-tenant-id", "tenant-one");
    expect(res.status).toBe(401);
  });
  it("rejects cross-tenant tokens", async () => {
    const token = jwt.sign({ id: 123, domain: "different-company", userType: "Office", userUuid: "verified-user" }, testSigningKey);
    const res = await request(app).post("/api/v2/recruitment/import/execute").set("Authorization", `Bearer ${token}`).set("x-tenant-id", "tenant-one").send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("tenant_mismatch");
  });
});
