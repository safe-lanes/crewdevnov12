import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { STAGE_SECTIONS, type AppraisalStage } from "@shared/v2/appraisals/appraisalChanges";

// APD-29: a stage submit saves every section in STAGE_SECTIONS for that stage.
// The request schema used to drop B1 trainings/targets on Stage 2 and 3, so
// the service never saw them.

const { repo, getDbMock } = vi.hoisted(() => ({
  repo: {
    findByAppraisalUuid: vi.fn(),
    findByAppraisalUuidIncludingDeleted: vi.fn(),
    findByAppraisalUuids: vi.fn(),
    updateByAppraisalUuid: vi.fn(),
    syncForAppraisal: vi.fn(),
    addAssignedReviewers: vi.fn(),
  },
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
vi.mock("@server/v2/crew-pool/repositories", () => ({ CrewMembersRepository: vi.fn(function () { return {}; }) }));
vi.mock("@server/v2/admin/services", () => ({ formsService: {} }));
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

const UUID = "30000000-0000-4000-8000-000000000029";
const STAGES = Object.keys(STAGE_SECTIONS) as AppraisalStage[];
const tx = { name: "tx" };

// One distinct array per section, so each sync call can be matched to its section.
function sectionArrays(stage: AppraisalStage): Record<string, any[]> {
  return Object.fromEntries(
    STAGE_SECTIONS[stage].map((k) => [k, [{ uuid: `${k}-row`, evaluation: "Good" }]]),
  );
}

const STAGE1_HEADER = {
  seafarersName: "Test Seafarer",
  seafarersRank: "Master",
  vessel: "Test Vessel",
  appraisalType: "Annual",
};

function fakeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

// An office user (no `userType: "Ship"`), so Stage 3 is allowed.
function submit(stage: AppraisalStage, data: Record<string, unknown>) {
  const controller = new AppraisalResultsController();
  const req: any = { params: { appraisalUuid: UUID }, body: { data }, user: { id: 24, userType: "Office" } };
  const res = fakeRes();
  const handler = { stage1: controller.submitStage1, stage2: controller.submitStage2, stage3: controller.submitStage3 }[stage];
  return handler.call(controller, req, res).then(() => res);
}

function storedAppraisal() {
  repo.findByAppraisalUuid.mockResolvedValue({
    appraisalUuid: UUID,
    status: "pending_review",
    stage1Status: "completed",
    stage2Status: "completed",
  });
}

describe("stage submit request keeps every section of its stage (controller)", () => {
  let submitStage: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    submitStage = vi.spyOn(AppraisalResultsService.prototype, "submitStage").mockResolvedValue({ appraisalUuid: UUID } as any);
  });
  afterEach(() => submitStage.mockRestore());

  for (const stage of STAGES) {
    it(`${stage} passes ${STAGE_SECTIONS[stage].join(", ")} to the service`, async () => {
      const sections = sectionArrays(stage);
      const res = await submit(stage, { ...(stage === "stage1" ? STAGE1_HEADER : {}), ...sections });

      expect(res.status).not.toHaveBeenCalled();
      expect(submitStage).toHaveBeenCalledTimes(1);
      const [uuid, calledStage, data] = submitStage.mock.calls[0];
      expect(uuid).toBe(UUID);
      expect(calledStage).toBe(stage);
      for (const [key, rows] of Object.entries(sections)) {
        expect(data, key).toHaveProperty(key);
        expect((data as any)[key], key).toEqual(rows);
      }
    });
  }

  it("still accepts a Stage 2 / Stage 3 body without B1 (older callers)", async () => {
    const stage2 = await submit("stage2", { competenceAssessments: [] });
    const stage3 = await submit("stage3", { officeReviews: [] });

    expect(stage2.status).not.toHaveBeenCalled();
    expect(stage3.status).not.toHaveBeenCalled();
    expect(submitStage.mock.calls[0][2]).not.toHaveProperty("trainings");
    expect(submitStage.mock.calls[1][2]).not.toHaveProperty("trainings");
  });
});

describe("stage submit saves every section of its stage in one transaction (service)", () => {
  const service = new AppraisalResultsService();

  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({ transaction: (fn: (tx: unknown) => unknown) => fn(tx) });
    repo.syncForAppraisal.mockResolvedValue(0);
    repo.addAssignedReviewers.mockResolvedValue(0);
    repo.findByAppraisalUuids.mockResolvedValue(new Map());
    vi.spyOn(AppraisalResultsService.prototype as any, "resolveAppraisalPinForSubmittedStatus").mockResolvedValue(null);
    vi.spyOn(AppraisalResultsService.prototype, "getByUuid").mockResolvedValue({ appraisalUuid: UUID } as any);
    storedAppraisal();
  });

  for (const stage of STAGES) {
    it(`${stage} syncs ${STAGE_SECTIONS[stage].join(", ")}`, async () => {
      const sections = sectionArrays(stage);
      await service.submitStage(UUID, stage, { ...(stage === "stage1" ? STAGE1_HEADER : {}), ...sections }, "Master");

      for (const [key, rows] of Object.entries(sections)) {
        const call = repo.syncForAppraisal.mock.calls.find((c) => c[1] === rows);
        expect(call, `${key} not synced`).toBeDefined();
        expect(call![0]).toBe(UUID);
        expect(call![3]).toBe(tx);
      }
    });
  }
});

// Repro A from the ticket: B1 Evaluations filled in on the form after Stage 2,
// then Stage 3 submitted without a Save Draft.
describe("Stage 3 with B1 Evaluations filled in only on the form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({ transaction: (fn: (tx: unknown) => unknown) => fn(tx) });
    repo.syncForAppraisal.mockResolvedValue(0);
    vi.spyOn(AppraisalResultsService.prototype as any, "resolveAppraisalPinForSubmittedStatus").mockResolvedValue(null);
    vi.spyOn(AppraisalResultsService.prototype, "getByUuid").mockResolvedValue({ appraisalUuid: UUID } as any);
    storedAppraisal();
    // The saved B1 row still has no Evaluation.
    repo.findByAppraisalUuids.mockResolvedValue(new Map([[UUID, [{ trainingUuid: "t-1", training: "ECDIS", evaluation: "" }]]]));
  });

  it("checks and saves the trainings the user sent", async () => {
    const trainings = [{ uuid: "t-1", training: "ECDIS", evaluation: "Completed, effective" }];
    const res = await submit("stage3", { officeReviews: [], trainingFollowups: [], trainings });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ appraisalUuid: UUID });
    expect(repo.syncForAppraisal.mock.calls.some((c) => JSON.stringify(c[1]) === JSON.stringify(trainings))).toBe(true);
  });

  it("still falls back to the saved rows when no trainings are sent", async () => {
    const res = await submit("stage3", { officeReviews: [], trainingFollowups: [] });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toMatch(/B1 Evaluation required/);
  });
});
