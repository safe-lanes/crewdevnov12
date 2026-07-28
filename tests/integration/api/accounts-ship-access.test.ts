import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Server } from "http";

/**
 * Ship-side default-deny regression tests with a REAL SIGNED Ship JWT
 * (AUTH_BYPASS off), covering the three endpoints confirmed reachable on
 * 27-Jul-2026 (manual-test-script Appendix B.1):
 *   POST /pay-elements   (was 201)
 *   POST /wage-scales    (was 201)
 *   POST /calc/run       (was 200)
 * plus a sample of other office-only routes, unauthenticated rejection, and
 * allowlist pass-through (guard does not block Ship on vessel routes).
 *
 * A dedicated express app is booted with the production authMiddleware and
 * the accounts router, using a test JWT_SECRET. The router-level guard
 * rejects Ship actors before any controller/database work, so no DB fixture
 * is needed for the 403 cases.
 */

const TEST_SECRET = "task167-test-secret";
const VESSEL = "11111111-2222-3333-4444-555555555555";

let server: Server;

function signShipToken(vessels: string[] = [VESSEL]): string {
  return jwt.sign(
    { id: 990167, domain: "test", userType: "Ship", vessels },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function signOfficeToken(): string {
  return jwt.sign(
    { id: 990168, domain: "test", userType: "Admin" },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const m = method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  let req = request(server)[m](`/api/v2/accounts${path}`);
  if (opts.token) req = req.set("Authorization", `Bearer ${opts.token}`);
  if (opts.body !== undefined) {
    req = req.set("Content-Type", "application/json").send(opts.body as any);
  }
  const res = await req;
  return { status: res.status, body: res.body };
}

beforeAll(async () => {
  // Real-auth mode: JWT_SECRET set, AUTH_BYPASS off — must be configured
  // BEFORE authMiddleware is imported (it reads env at module load).
  process.env.JWT_SECRET = TEST_SECRET;
  delete process.env.AUTH_BYPASS;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: accountsRouter } = await import(
    "@server/v2/accounts/routes"
  );

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/v2/accounts", accountsRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe("unauthenticated requests (auth bypass off)", () => {
  it("rejects a request with no token with 401", async () => {
    const r = await call("POST", "/pay-elements", { body: {} });
    expect(r.status).toBe(401);
  });

  it("rejects a forged (wrong-secret) token with 401", async () => {
    const forged = jwt.sign(
      { id: 1, domain: "test", userType: "Ship", vessels: [VESSEL] },
      "some-other-secret",
    );
    const r = await call("POST", "/calc/run", { token: forged, body: {} });
    expect(r.status).toBe(401);
  });
});

describe("Appendix B.1 regression — real signed Ship JWT is 403 on office actions", () => {
  const ship = signShipToken();

  it("POST /pay-elements → 403 (was 201)", async () => {
    const r = await call("POST", "/pay-elements", {
      token: ship,
      body: { code: "HACK", name: "Hack", category: "earning" },
    });
    expect(r.status).toBe(403);
  });

  it("POST /wage-scales → 403 (was 201)", async () => {
    const r = await call("POST", "/wage-scales", {
      token: ship,
      body: { name: "HACK SCALE" },
    });
    expect(r.status).toBe(403);
  });

  it("POST /calc/run → 403 (was 200)", async () => {
    const r = await call("POST", "/calc/run", {
      token: ship,
      body: { vesselUuid: VESSEL, period: "2026-03" },
    });
    expect(r.status).toBe(403);
  });
});

describe("default-deny sample across office-only route groups (signed Ship JWT)", () => {
  const ship = signShipToken();
  const cases: Array<[string, string]> = [
    ["GET", "/config"],
    ["PUT", "/config"],
    ["GET", "/pay-elements"],
    ["DELETE", "/pay-elements/some-uuid"],
    ["GET", "/wage-scales"],
    ["POST", "/wage-scales/some-uuid/activate"],
    ["GET", "/cba-reference"],
    ["GET", "/allotments"],
    ["POST", "/allotments"],
    ["GET", "/advances"],
    ["GET", "/engagements"],
    ["POST", "/engagements/sync"],
    ["POST", "/portage/some-uuid/submit"],
    ["POST", "/portage/approvals/some-uuid/decision"],
    ["GET", "/settlements"],
    ["POST", "/settlements/compute"],
    ["PATCH", "/settlements/some-uuid/remarks"],
    ["POST", "/calc/run-engagement"],
    ["POST", "/calc/adjustments"],
    ["GET", "/ledger"],
    ["GET", "/reports/gl-export"],
    ["GET", "/reports/fleet-summary"],
    ["POST", "/monthly-transactions/some-uuid/accept"],
    ["POST", "/monthly-transactions/some-uuid/reject"],
    ["POST", "/vessel-portage/some-uuid/return"],
    [
      "POST",
      `/ctm/${VESSEL}/2026-03/reconcile`, // own vessel — still office-only
    ],
    ["GET", "/bond-items"],
    ["POST", "/bond-items"],
  ];

  for (const [method, path] of cases) {
    it(`${method} ${path} → 403 for Ship`, async () => {
      const r = await call(method, path, { token: ship, body: {} });
      expect(r.status, JSON.stringify(r.body)).toBe(403);
    });
  }

  it("unknown accounts route also 403s for Ship (default-deny)", async () => {
    const r = await call("POST", "/some-future-endpoint", {
      token: ship,
      body: {},
    });
    expect(r.status).toBe(403);
  });
});

describe("allowlisted vessel routes pass the router guard for Ship", () => {
  // These reach the controllers (which enforce vessel scoping and may then
  // fail on data/DB grounds) — the point here is that the router-level guard
  // does NOT return its blanket 403 for allowlisted routes. Scope violations
  // are asserted explicitly below.
  const ship = signShipToken();

  it("GET /portage for ANOTHER vessel → 403 with scope message (not guard 403)", async () => {
    const r = await call(
      "GET",
      "/portage?vesselUuid=other-vessel-uuid&period=2026-03",
      { token: ship },
    );
    expect(r.status).toBe(403);
    expect(String(r.body?.error)).toMatch(/not assigned to this vessel/i);
  });

  it("GET /reports/payslips for ANOTHER vessel → 403 scope error", async () => {
    const r = await call(
      "GET",
      "/reports/payslips?vesselUuid=other-vessel-uuid&period=2026-03",
      { token: ship },
    );
    expect(r.status).toBe(403);
    expect(String(r.body?.error)).toMatch(/not assigned to this vessel/i);
  });

  it("GET /monthly-transactions for ANOTHER vessel → 403 scope error", async () => {
    const r = await call(
      "GET",
      "/monthly-transactions?vesselUuid=other-vessel-uuid&period=2026-03",
      { token: ship },
    );
    expect(r.status).toBe(403);
    expect(String(r.body?.error)).toMatch(/not assigned to this vessel/i);
  });

  it("Ship user with NO vessels claim is denied own-vessel route (fail-closed)", async () => {
    const r = await call(
      "GET",
      `/monthly-transactions?vesselUuid=${VESSEL}&period=2026-03`,
      { token: signShipToken([]) },
    );
    expect(r.status).toBe(403);
  });

  it("guard does not blanket-403 an office user on office routes", async () => {
    // Office actor passes the guard; any subsequent failure would be a
    // DB/data error (500/404), never the guard's office-only 403.
    const r = await call("DELETE", "/pay-elements/nonexistent-uuid", {
      token: signOfficeToken(),
    });
    expect(r.status).not.toBe(403);
  });
});
