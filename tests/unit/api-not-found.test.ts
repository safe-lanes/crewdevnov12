import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import type { Server } from "http";
import { apiNotFound } from "@server/middleware/apiNotFound";

/**
 * Unmatched /api paths must return 404 JSON, not fall through to the SPA
 * catch-all (200 + index.html). The silent-200 failure mode previously made
 * a group of legacy test suites fail in ways that took real effort to
 * diagnose. Mirrors the production mounting order in server/index.ts:
 * real routes → apiNotFound on /api → SPA catch-all.
 */
let server: Server;

beforeAll(async () => {
  const app = express();
  app.get("/api/v2/known", (_req, res) => res.json({ ok: true }));
  app.use("/api", apiNotFound);
  app.use((_req, res) => res.status(200).send("<!DOCTYPE html><html></html>"));
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe("apiNotFound guard", () => {
  it("unknown /api path returns 404 JSON (not SPA HTML)", async () => {
    const res = await request(server).get("/api/v2/accounts/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toMatchObject({
      error: "Not found",
      method: "GET",
      path: "/api/v2/accounts/does-not-exist",
    });
  });

  it("wrong HTTP method on a real path also 404s loudly", async () => {
    // e.g. POST where the real route is PATCH — the exact trap that bit
    // confirm-seniority-anchors and the legacy suites.
    const res = await request(server).post("/api/v2/known");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });

  it("matched API routes are unaffected", async () => {
    const res = await request(server).get("/api/v2/known");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("non-API paths still reach the SPA catch-all", async () => {
    const res = await request(server).get("/some/spa/route");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<!DOCTYPE html>");
  });
});
