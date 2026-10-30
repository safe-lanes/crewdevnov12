import { beforeEach, describe, expect, it, vi } from "vitest";

// APD-49: the competence, behavioural and overall ratings were worked out in
// the browser and stored as sent. A save built from stale Part C/D rows (another
// tab, another user, a sync) then stored ratings the merged rows did not
// support. The server now derives them from the rows it holds, in the same
// transaction that writes the rows, and ignores any rating a client sends.

const { repo, crewRepo, formsService, getDbMock } = vi.hoisted(() => ({
  repo: {
    findByAppraisalUuid: vi.fn(),
    findByAppraisalUuidIncludingDeleted: vi.fn(),
    findByAppraisalUuids: vi.fn(),
    createIfAbsent: vi.fn(),
    updateByAppraisalUuid: vi.fn(),
    applyChanges: vi.fn(),
    syncForAppraisal: vi.fn(),
    addAssignedReviewers: vi.fn(),
  },
  crewRepo: { findByUuid: vi.fn() },
  formsService: { getFormForRank: vi.fn() },
  getDbMock: vi.fn(),
}));

vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));
vi.mock("@server/v2/appraisals/repositories", () => {
  const Repo = vi.fn(function () { return repo; });
  return {
    AppraisalResultsRepository: Repo,
    ApprTrainingsRepository: Repo,
    ApprTargetsRepository: Repo,
    ApprCompetenceAssessmentsRepository: Repo,
    ApprBehaviouralAssessmentsRepository: Repo,
    ApprTrainingNeedsRepository: Repo,
    ApprRecommendationsRepository: Repo,
    ApprAppraiserCommentsRepository: Repo,
    ApprSeafarerCommentsRepository: Repo,
    ApprOfficeReviewsRepository: Repo,
    ApprTrainingFollowupsRepository: Repo,
    ApprReviewersRepository: Repo,
  };
});
vi.mock("@server/v2/crew-pool/repositories", () => ({ CrewMembersRepository: vi.fn(function () { return crewRepo; }) }));
vi.mock("@server/v2/admin/services", () => ({ formsService }));
vi.mock("@server/v2/shared/emailService", () => ({ sendEmail: vi.fn(), logEmailEvent: vi.fn() }));
// APD-56: master lookups pass values through here (see appraisal-master-refs.test.ts).
vi.mock("@server/v2/appraisals/utils/masterRefs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@server/v2/appraisals/utils/masterRefs")>()),
  loadAppraisalTypeNames: async () => new Map(),
  resolveAppraisalTypeRef: async (v: unknown) => (v == null ? "" : String(v)),
  resolveAppraisalVesselRef: async (v: unknown) => (v ? String(v) : null),
}));
vi.mock("@server/v2/appraisals/utils/requestActor", () => ({
  resolveAppraisalActor: vi.fn(async () => ({ name: "Test Officer", userUuid: "user-1" })),
}));

import { AppraisalResultsService } from "@server/v2/appraisals/services/appraisalResultsService";
import { AppraisalResultsController } from "@server/v2/appraisals/controllers/appraisalResultsController";

const UUID = "30000000-0000-4000-8000-000000000049";
const CREW = "c0000000-0000-4000-8000-000000000049";
const tx = { name: "tx" };

// Part C as the database holds it after two saves: row 1 rated 5 by one tab,
// row 2 rated 1 by another tab that still saw row 1 unrated.
const C_ROWS = [
  { competenceUuid: "c-1", weight: 50, effectiveness: "5-exceeds-expectations" },
  { competenceUuid: "c-2", weight: 50, effectiveness: "1-significantly-below-expectations" },
];
const D_ROWS = [{ behaviouralUuid: "d-1", weight: 100, effectiveness: "4-meets-expectations" }];

// The live Part C and D rows the next rating read finds (C is read first).
function rowsInDb(c: any[], d: any[] = []) {
  repo.findByAppraisalUuids
    .mockResolvedValueOnce(new Map([[UUID, c]]))
    .mockResolvedValueOnce(new Map([[UUID, d]]));
}

function stored(fields: Record<string, unknown> = {}) {
  repo.findByAppraisalUuid.mockResolvedValue({
    appraisalUuid: UUID,
    status: "draft",
    appraisalType: "Annual",
    seafarersRank: "Master",
    formVersionId: 1,
    formVersionUuid: "fv-1",
    competenceRating: null,
    behavioralRating: null,
    overallRating: null,
    ...fields,
  });
}

function fakeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  repo.findByAppraisalUuids.mockReset();
  repo.findByAppraisalUuids.mockResolvedValue(new Map());

  const where = () => Object.assign(Promise.resolve([]), { limit: () => Promise.resolve([]) });
  getDbMock.mockReturnValue({
    transaction: (fn: (t: unknown) => unknown) => fn(tx),
    select: () => ({ from: () => ({ where }) }),
  });
  repo.findByAppraisalUuidIncludingDeleted.mockResolvedValue(undefined);
  repo.createIfAbsent.mockImplementation(async (row: any) => ({ ...row, id: 1 }));
  repo.updateByAppraisalUuid.mockImplementation(async (_uuid: string, data: any) => data);
  repo.applyChanges.mockResolvedValue(1);
  repo.syncForAppraisal.mockResolvedValue(0);
  repo.addAssignedReviewers.mockResolvedValue(0);
  crewRepo.findByUuid.mockResolvedValue({ crewUuid: CREW });
  formsService.getFormForRank.mockResolvedValue({ formVersionId: 1, formVersionUuid: "fv-1", isLockForm: false });
  vi.spyOn(AppraisalResultsService.prototype as any, "resolveAppraisalPinForSubmittedStatus").mockResolvedValue(null);
  vi.spyOn(AppraisalResultsService.prototype, "getByUuid").mockResolvedValue({ appraisalUuid: UUID } as any);
});

describe("save draft derives the ratings from the merged Part C/D rows", () => {
  const service = new AppraisalResultsService();

  it("stores what the merged rows give, not what the stale form computed", async () => {
    // The first tab's save stored 5.0 from row 1 alone.
    stored({ competenceRating: "5.0", overallRating: "5.0" });
    rowsInDb(C_ROWS);

    // The second tab only knows row 2, so it computed 1.0.
    await service.update(UUID, {
      changes: {
        header: { competenceRating: "1.0", overallRating: "1.0" },
        sections: { competenceAssessments: { rows: [{ uuid: "c-2", effectiveness: "1-significantly-below-expectations" }] } },
      },
    });

    expect(repo.updateByAppraisalUuid).toHaveBeenCalledTimes(1);
    expect(repo.updateByAppraisalUuid.mock.calls[0]).toEqual([UUID, { competenceRating: "3.0", overallRating: "3.0" }, tx]);
    // Read inside the transaction, after this save's rows were written.
    for (const call of repo.findByAppraisalUuids.mock.calls) expect(call).toEqual([[UUID], tx]);
    expect(repo.applyChanges.mock.invocationCallOrder[0]).toBeLessThan(repo.findByAppraisalUuids.mock.invocationCallOrder[0]);
  });

  it("follows a Part D change too", async () => {
    stored({ competenceRating: "3.0", overallRating: "3.0" });
    rowsInDb(C_ROWS, D_ROWS);

    await service.update(UUID, {
      changes: { sections: { behaviouralAssessments: { rows: [{ uuid: "d-1", effectiveness: "4-meets-expectations" }] } } },
    });

    expect(repo.updateByAppraisalUuid.mock.calls[0][1]).toEqual({ behavioralRating: "4.0", overallRating: "3.5" });
  });

  it("clears the ratings when no row is rated any more", async () => {
    stored({ competenceRating: "3.0", overallRating: "3.0" });
    rowsInDb([{ competenceUuid: "c-1", weight: 50, effectiveness: null }]);

    await service.update(UUID, {
      changes: { sections: { competenceAssessments: { rows: [{ uuid: "c-1", effectiveness: "" }] } } },
    });

    expect(repo.updateByAppraisalUuid.mock.calls[0][1]).toEqual({ competenceRating: null, overallRating: null });
  });

  it("does not rewrite a rating that has not changed", async () => {
    stored({ competenceRating: "3.0", overallRating: "3.0" });
    rowsInDb(C_ROWS);

    await service.update(UUID, {
      changes: { sections: { competenceAssessments: { rows: [{ uuid: "c-1", comment: "Good" }] } } },
    });

    // The row changed, so the main row is still stamped, but with no rating.
    expect(repo.updateByAppraisalUuid.mock.calls[0][1]).toEqual({});
  });

  it("ignores ratings sent without a Part C/D change, and reads no rows", async () => {
    stored({ competenceRating: "3.0", overallRating: "3.0" });

    await service.update(UUID, { changes: { header: { overallRating: "9.9", competenceRating: "9.9" } } });

    expect(repo.findByAppraisalUuids).not.toHaveBeenCalled();
    expect(repo.updateByAppraisalUuid).not.toHaveBeenCalled();
  });
});

describe("Stage 2 derives the ratings from the rows it saved", () => {
  const service = new AppraisalResultsService();

  it("reads Part C/D after syncing them, in the same transaction", async () => {
    stored({ status: "preliminary", stage1Status: "completed", seafarersRank: null, competenceRating: "1.0", overallRating: "1.0" });
    repo.updateByAppraisalUuid.mockImplementation(async (_uuid: string, data: any) => ({ competenceRating: "1.0", behavioralRating: null, overallRating: "1.0", ...data }));
    rowsInDb(C_ROWS);
    const competenceAssessments = [{ uuid: "c-1" }, { uuid: "c-2" }];

    await service.submitStage(UUID, "stage2", { competenceAssessments, behaviouralAssessments: [] }, "Master");

    expect(repo.updateByAppraisalUuid).toHaveBeenCalledTimes(2);
    expect(repo.updateByAppraisalUuid.mock.calls[0][1]).not.toHaveProperty("competenceRating");
    expect(repo.updateByAppraisalUuid.mock.calls[1]).toEqual([UUID, { competenceRating: "3.0", overallRating: "3.0" }, tx]);
    const cSynced = repo.syncForAppraisal.mock.calls.findIndex((c) => c[1] === competenceAssessments);
    expect(repo.syncForAppraisal.mock.invocationCallOrder[cSynced]).toBeLessThan(repo.findByAppraisalUuids.mock.invocationCallOrder[0]);
    for (const call of repo.findByAppraisalUuids.mock.calls) expect(call[1]).toBe(tx);
  });

  it("writes no second update when the stored ratings already match", async () => {
    stored({ status: "preliminary", stage1Status: "completed", seafarersRank: null });
    repo.updateByAppraisalUuid.mockImplementation(async (_uuid: string, data: any) => ({ competenceRating: "3.0", behavioralRating: null, overallRating: "3.0", ...data }));
    rowsInDb(C_ROWS);

    await service.submitStage(UUID, "stage2", { competenceAssessments: [{ uuid: "c-1" }, { uuid: "c-2" }] }, "Master");

    expect(repo.updateByAppraisalUuid).toHaveBeenCalledTimes(1);
  });

  it("the request's ratings never reach the service", async () => {
    const submitStage = vi.spyOn(AppraisalResultsService.prototype, "submitStage").mockResolvedValue({ appraisalUuid: UUID } as any);
    const controller = new AppraisalResultsController();
    const res = fakeRes();
    const req: any = {
      params: { appraisalUuid: UUID },
      body: { data: { competenceAssessments: [] }, competenceRating: "9.9", behavioralRating: "9.9", overallRating: "9.9" },
      user: { id: 24, userType: "Office" },
    };

    await controller.submitStage2.call(controller, req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(submitStage).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(submitStage.mock.calls[0])).not.toContain("9.9");
  });
});

describe("create derives the ratings from the rows it saved", () => {
  const service = new AppraisalResultsService();

  it("ignores the body's ratings and stores the rows' ratings", async () => {
    rowsInDb(C_ROWS);

    await service.create({
      crewMemberId: CREW,
      appraisalUuid: UUID,
      formId: 1,
      appraisalType: "Annual",
      appraisalData: { seafarersRank: "Master", competenceAssessments: [{ uuid: "c-1" }, { uuid: "c-2" }] },
      competenceRating: "9.9",
      behavioralRating: "9.9",
      overallRating: "9.9",
      status: "draft",
    });

    expect(repo.createIfAbsent.mock.calls[0][0]).toMatchObject({ competenceRating: null, behavioralRating: null, overallRating: null });
    expect(repo.updateByAppraisalUuid).toHaveBeenCalledTimes(1);
    expect(repo.updateByAppraisalUuid.mock.calls[0]).toEqual([UUID, { competenceRating: "3.0", overallRating: "3.0" }, tx]);
  });

  it("writes no update when nothing is rated", async () => {
    await service.create({
      crewMemberId: CREW,
      appraisalUuid: UUID,
      formId: 1,
      appraisalType: "Annual",
      appraisalData: { seafarersRank: "Master" },
      status: "draft",
    });

    expect(repo.createIfAbsent).toHaveBeenCalledTimes(1);
    expect(repo.updateByAppraisalUuid).not.toHaveBeenCalled();
  });
});
