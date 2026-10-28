import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

// APD-38: Training & Retention edits appraisal G2 rows (Part G, office-owned).
// The write took its actor from the body and never saved it, and ship users
// could make it although the appraisal itself refuses them Part G.

const { repo, resolveActor, getDbMock } = vi.hoisted(() => ({
  repo: { patchAppraisal: vi.fn() },
  resolveActor: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));
vi.mock("@server/v2/appraisals/utils/requestActor", () => ({ resolveAppraisalActor: resolveActor }));
vi.mock("@server/v2/training-needs/complianceSuggestionController", async () => {
  const { Router } = await import("express");
  return { complianceSuggestionRoutes: Router() };
});
vi.mock("@server/v2/training-needs/complianceNeedRows", () => ({ complianceNeedRows: vi.fn(async () => []) }));

const ACTOR = { name: "Thomas Xu", userUuid: "2228582e-8c50-4bb9-ad0d-58be4e02a165" };
const ROW = "40000000-0000-4000-8000-000000000038";

describe("PATCH /source/appraisal/:uuid (APD-38)", () => {
  let user: Record<string, unknown> | undefined;
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@server/v2/training-needs/repository", () => ({
      TrainingNeedsRepository: vi.fn(function () { return repo; }),
    }));
    repo.patchAppraisal.mockReset().mockResolvedValue(true);
    resolveActor.mockReset().mockResolvedValue(ACTOR);
    user = { id: 24, userType: "Office" };
    const { default: router } = await import("@server/v2/training-needs/routes");
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as any).user = user; next(); });
    app.use(router);
  });

  it("refuses a user it cannot identify, and writes nothing", async () => {
    resolveActor.mockResolvedValue(null);
    const res = await request(app).patch(`/source/appraisal/${ROW}`).send({ status: "Completed" });
    expect(res.status).toBe(401);
    expect(repo.patchAppraisal).not.toHaveBeenCalled();
  });

  it("refuses a ship user (Part G is office-owned), and writes nothing", async () => {
    user = { id: 7, userType: "Ship" };
    const res = await request(app).patch(`/source/appraisal/${ROW}`).send({ status: "Completed" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Part G is for office use only/);
    expect(repo.patchAppraisal).not.toHaveBeenCalled();
  });

  it("saves the login's user, not an auditUserUuid from the body", async () => {
    const res = await request(app).patch(`/source/appraisal/${ROW}`)
      .send({ status: "Completed", auditUserUuid: "forged-uuid" });
    expect(res.status).toBe(200);
    expect(repo.patchAppraisal).toHaveBeenCalledWith(ROW, { status: "Completed" }, ACTOR.userUuid);
  });

  it("answers 404 for a row that is missing or deleted", async () => {
    repo.patchAppraisal.mockResolvedValue(false);
    const res = await request(app).patch(`/source/appraisal/${ROW}`).send({ comments: "x" });
    expect(res.status).toBe(404);
  });
});

describe("TrainingNeedsRepository.patchAppraisal (APD-38)", () => {
  type Call = { kind: "update" | "select"; values?: Record<string, unknown> };
  let calls: Call[];
  let found: unknown[];

  beforeEach(() => {
    calls = [];
    found = [{ id: 1 }];
    getDbMock.mockReturnValue({
      update: () => ({
        set: (values: Record<string, unknown>) => {
          calls.push({ kind: "update", values });
          return { where: () => ({ returning: async () => found }) };
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => { calls.push({ kind: "select" }); return found; } }),
        }),
      }),
    });
  });

  async function repoUnderTest() {
    vi.resetModules();
    vi.doUnmock("@server/v2/training-needs/repository");
    const { TrainingNeedsRepository } = await import("@server/v2/training-needs/repository");
    return new TrainingNeedsRepository();
  }

  it("writes only the sent fields and records who wrote them", async () => {
    const r = await repoUnderTest();
    expect(await r.patchAppraisal(ROW, { status: "Completed" }, ACTOR.userUuid)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe("update");
    expect(Object.keys(calls[0].values!).sort()).toEqual(["status", "updatedAt", "updatedByUuid"]);
    expect(calls[0].values).toMatchObject({ status: "Completed", updatedByUuid: ACTOR.userUuid });
  });

  it("does not write when no field was sent, so updated_at stays", async () => {
    const r = await repoUnderTest();
    expect(await r.patchAppraisal(ROW, {}, ACTOR.userUuid)).toBe(true);
    expect(calls).toEqual([{ kind: "select" }]);
  });

  it("reports a missing row when nothing was sent", async () => {
    found = [];
    const r = await repoUnderTest();
    expect(await r.patchAppraisal(ROW, {}, ACTOR.userUuid)).toBe(false);
  });
});
