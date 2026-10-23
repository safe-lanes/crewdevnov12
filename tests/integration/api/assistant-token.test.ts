import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createHmac } from "crypto";
import type { Server } from "http";

/**
 * GET /api/v2/assistant/token — identity for the shared SAIL chat widget (stage 1, knowledge answers).
 *
 * Runs the PRODUCTION authMiddleware with a REAL SIGNED SAILERP-style JWT (AUTH_BYPASS off), so the genuine
 * token-validation path (jwt.verify) is exercised. Only the database role lookup (resolveRequestRole) is
 * replaced by a stub keyed by user id — that function is unit-tested elsewhere and needs a tenant database.
 * This is NOT a genuine SAILERP login (that is verified on dev after deployment).
 */

const JWT_TEST_SECRET = "assistant-token-test-jwt-secret";
const SIGNING_KEY = "assistant-token-test-signing-key";

const roles: Record<number, { ok: true; role: { roleId: string; roleName: string; masterUserId: number } } | { ok: false; reason: string }> = {
  1: { ok: true, role: { roleId: "r-sa", roleName: "Sail Admin", masterUserId: 1 } },
  2: { ok: true, role: { roleId: "r-cm", roleName: "Crewing Manager", masterUserId: 2 } },
  3: { ok: false, reason: "user_not_found" },
  4: { ok: false, reason: "identity_mismatch" },
  5: { ok: true, role: { roleId: "r-sa2", roleName: "  sail admin ", masterUserId: 5 } },
};

vi.mock("@server/v2/auth/roleResolutionService", () => ({
  resolveRequestRole: async (req: any) => roles[req.user?.id] ?? { ok: false, reason: "user_not_found" },
}));

let server: Server;

function sailerpJwt(claims: Record<string, unknown>, secret = JWT_TEST_SECRET, opts: jwt.SignOptions = { expiresIn: "1h" }) {
  return jwt.sign(claims, secret, opts);
}

async function getToken(bearer?: string) {
  let r = request(server).get("/api/v2/assistant/token");
  if (bearer) r = r.set("Authorization", `Bearer ${bearer}`);
  const res = await r;
  return { status: res.status, body: res.body, headers: res.headers };
}

function decode(token: string) {
  const [body, mac] = token.split(".");
  const expected = createHmac("sha256", SIGNING_KEY).update(body).digest("base64url");
  return { validSignature: mac === expected, payload: JSON.parse(Buffer.from(body, "base64url").toString("utf8")) };
}

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_TEST_SECRET;
  delete process.env.AUTH_BYPASS;
  process.env.ASSISTANT_INSTANCE_ID = "crewing-test";
  process.env.ASSISTANT_IDENTITY_SIGNING_KEY = SIGNING_KEY;
  delete process.env.ASSISTANT_ALLOWED_ROLES;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: assistantRouter } = await import("@server/v2/assistant/routes");
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/v2/assistant", assistantRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe("assistant token endpoint", () => {
  it("Office + Sail Admin (server-resolved) gets a signed, short-lived identity for its own company", async () => {
    const r = await getToken(sailerpJwt({ id: 1, domain: "acme", userType: "Office" }));
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    const { validSignature, payload } = decode(r.body.token);
    expect(validSignature).toBe(true);
    expect(payload).toMatchObject({ userId: "1", role: "Sail Admin", userType: "Office", iss: "crewing-test", tenantDomain: "acme" });
    expect(payload.exp - payload.iat).toBe(60);
  });

  it("role match is case/space-insensitive but the token carries the resolved name", async () => {
    const r = await getToken(sailerpJwt({ id: 5, domain: "acme", userType: "Office" }));
    expect(r.status).toBe(200);
    expect(decode(r.body.token).payload.role).toBe("sail admin");
  });

  it("company isolation: the token's company is the verified login's domain, never another", async () => {
    const a = decode((await getToken(sailerpJwt({ id: 1, domain: "acme", userType: "Office" }))).body.token).payload;
    const b = decode((await getToken(sailerpJwt({ id: 1, domain: "globex", userType: "Office" }))).body.token).payload;
    expect(a.tenantDomain).toBe("acme");
    expect(b.tenantDomain).toBe("globex");
  });

  it("refuses a role outside the allow-list (403 role_not_allowed)", async () => {
    const r = await getToken(sailerpJwt({ id: 2, domain: "acme", userType: "Office" }));
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("role_not_allowed");
    expect(r.body.token).toBeUndefined();
  });

  it("refuses an unresolved role (403 role_unresolved) — no browser/profile fallback", async () => {
    for (const id of [3, 4]) {
      const r = await getToken(sailerpJwt({ id, domain: "acme", userType: "Office", role: "Sail Admin" }));
      expect(r.status).toBe(403);
      expect(r.body.error).toBe("role_unresolved");
    }
  });

  it("ignores a role claimed by the browser or in the JWT: only the server lookup counts", async () => {
    const r = await request(server)
      .get("/api/v2/assistant/token")
      .set("Authorization", `Bearer ${sailerpJwt({ id: 2, domain: "acme", userType: "Office", role: "Sail Admin" })}`)
      .set("x-user-role", "Sail Admin")
      .set("x-user-type", "Office");
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("role_not_allowed");
  });

  it("refuses Ship-type users even with an allowed role (403 user_type_not_allowed)", async () => {
    const r = await getToken(sailerpJwt({ id: 1, domain: "acme", userType: "Ship", vessels: [] }));
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("user_type_not_allowed");
  });

  it("missing, tampered and expired SAILERP tokens are rejected by the real login check (401)", async () => {
    expect((await getToken()).status).toBe(401);
    const good = sailerpJwt({ id: 1, domain: "acme", userType: "Office" });
    const [h, p, s] = good.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ id: 1, domain: "globex", userType: "Office" })).toString("base64url");
    expect((await getToken(`${h}.${forgedPayload}.${s}`)).status).toBe(401);
    expect((await getToken(sailerpJwt({ id: 1, domain: "acme", userType: "Office" }, "wrong-secret"))).status).toBe(401);
    const expired = await getToken(sailerpJwt({ id: 1, domain: "acme", userType: "Office", exp: Math.floor(Date.now() / 1000) - 60 }, JWT_TEST_SECRET, {}));
    expect(expired.status).toBe(401);
    expect(expired.body.error).toBe("token_expired");
  });

  it("not configured → 503 and no token", async () => {
    const saved = process.env.ASSISTANT_IDENTITY_SIGNING_KEY;
    delete process.env.ASSISTANT_IDENTITY_SIGNING_KEY;
    try {
      const r = await getToken(sailerpJwt({ id: 1, domain: "acme", userType: "Office" }));
      expect(r.status).toBe(503);
      expect(r.body.error).toBe("assistant_not_configured");
    } finally {
      process.env.ASSISTANT_IDENTITY_SIGNING_KEY = saved;
    }
  });

  it("ASSISTANT_ALLOWED_ROLES widens the allow-list only when configured", async () => {
    process.env.ASSISTANT_ALLOWED_ROLES = "Sail Admin, Crewing Manager";
    try {
      expect((await getToken(sailerpJwt({ id: 2, domain: "acme", userType: "Office" }))).status).toBe(200);
    } finally {
      delete process.env.ASSISTANT_ALLOWED_ROLES;
    }
  });
});
