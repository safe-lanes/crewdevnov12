import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPRAISAL_STATUS_ORDER,
  appraisalStatusRank,
  isAppraisalStatusRegression,
} from "@shared/v2/appraisals/appraisalStatus";

// APD-17: save draft must not move an appraisal's status backwards.

const { repo, getDbMock } = vi.hoisted(() => ({
  repo: {
    findByAppraisalUuid: vi.fn(),
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

import { AppraisalResultsService } from "@server/v2/appraisals/services/appraisalResultsService";

describe("appraisal status order", () => {
  const forward = ["draft", "preliminary", "pending_review", "reviewed"];

  it("treats every backward move as a regression", () => {
    for (let i = 0; i < forward.length; i++) {
      for (let j = 0; j < i; j++) {
        expect(isAppraisalStatusRegression(forward[i], forward[j])).toBe(true);
      }
    }
  });

  it("allows forward moves and staying put", () => {
    for (let i = 0; i < forward.length; i++) {
      for (let j = i; j < forward.length; j++) {
        expect(isAppraisalStatusRegression(forward[i], forward[j])).toBe(false);
      }
    }
  });

  it("treats Task #500 synonyms as the same step", () => {
    expect(isAppraisalStatusRegression("pending_review", "submitted")).toBe(false);
    expect(isAppraisalStatusRegression("submitted", "stage2_submitted")).toBe(false);
    expect(isAppraisalStatusRegression("stage3_submitted", "reviewed")).toBe(false);
    expect(isAppraisalStatusRegression("stage3_submitted", "pending_review")).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(appraisalStatusRank(" Reviewed ")).toBe(APPRAISAL_STATUS_ORDER.reviewed);
    expect(isAppraisalStatusRegression("Reviewed", "DRAFT")).toBe(true);
  });

  it("never lets an unknown value replace a known status", () => {
    expect(appraisalStatusRank("archived")).toBe(-1);
    expect(isAppraisalStatusRegression("draft", "archived")).toBe(true);
    expect(isAppraisalStatusRegression("draft", null)).toBe(true);
  });

  it("lets a known status replace an unknown one", () => {
    expect(isAppraisalStatusRegression("legacy", "draft")).toBe(false);
    expect(isAppraisalStatusRegression(null, "preliminary")).toBe(false);
  });

  it("does not match inherited object keys", () => {
    expect(appraisalStatusRank("constructor")).toBe(-1);
    expect(appraisalStatusRank("toString")).toBe(-1);
  });
});

describe("save draft status (AppraisalResultsService.update)", () => {
  const UUID = "30000000-0000-4000-8000-000000000001";
  const service = new AppraisalResultsService();

  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({ transaction: (fn: (tx: unknown) => unknown) => fn({}) });
    vi.spyOn(AppraisalResultsService.prototype as any, "resolveAppraisalPinForSubmittedStatus").mockResolvedValue(null);
    vi.spyOn(AppraisalResultsService.prototype, "getByUuid").mockResolvedValue({ appraisalUuid: UUID } as any);
  });

  function stored(status: string) {
    repo.findByAppraisalUuid.mockResolvedValue({
      appraisalUuid: UUID,
      status,
      appraisalType: "Annual",
      seafarersRank: "Master",
      formVersionId: 1,
      formVersionUuid: "fv-1",
    });
  }

  it("keeps a reviewed status and saves the other changes", async () => {
    stored("reviewed");
    await service.update(UUID, { changes: { header: { status: "draft", appraisalType: "Probation" } } });

    expect(repo.updateByAppraisalUuid).toHaveBeenCalledTimes(1);
    const fields = repo.updateByAppraisalUuid.mock.calls[0][1];
    expect(fields).toEqual({ appraisalType: "Probation" });
    expect(fields).not.toHaveProperty("status");
  });

  it("writes nothing when the only change was a backward status", async () => {
    stored("pending_review");
    await service.update(UUID, { changes: { header: { status: "preliminary" } } });

    expect(repo.updateByAppraisalUuid).not.toHaveBeenCalled();
  });

  it("still lets status move forward", async () => {
    stored("draft");
    await service.update(UUID, { changes: { header: { status: "preliminary" } } });

    expect(repo.updateByAppraisalUuid).toHaveBeenCalledTimes(1);
    expect(repo.updateByAppraisalUuid.mock.calls[0][1]).toEqual({ status: "preliminary" });
  });
});

// APD-20: the server, not the form, gives assigned reviewers their G1 rows.
describe("Stage 2 adds the assigned reviewers' G1 rows (submitStage)", () => {
  const UUID = "30000000-0000-4000-8000-000000000002";
  const service = new AppraisalResultsService();
  const reviewers = [{ userUuid: "user-x", reviewerName: "Xavier X", designation: "DPA" }];
  const tx = { name: "tx" };

  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({ transaction: (fn: (tx: unknown) => unknown) => fn(tx) });
    repo.syncForAppraisal.mockResolvedValue(0);
    repo.addAssignedReviewers.mockResolvedValue(1);
    vi.spyOn(AppraisalResultsService.prototype as any, "resolveAppraisalPinForSubmittedStatus").mockResolvedValue(null);
    vi.spyOn(AppraisalResultsService.prototype, "getByUuid").mockResolvedValue({ appraisalUuid: UUID } as any);
  });

  function stored(fields: Record<string, unknown> = {}) {
    repo.findByAppraisalUuid.mockResolvedValue({
      appraisalUuid: UUID,
      status: "preliminary",
      stage1Status: "completed",
      ...fields,
    });
  }

  it("adds them inside the Stage 2 transaction, after the reviewers are saved", async () => {
    stored();
    await service.submitStage(UUID, "stage2", { reviewers }, "Master");

    expect(repo.addAssignedReviewers).toHaveBeenCalledTimes(1);
    expect(repo.addAssignedReviewers).toHaveBeenCalledWith(UUID, reviewers, null, tx);
    const reviewersSaved = repo.syncForAppraisal.mock.calls.findIndex((c) => c[1] === reviewers);
    expect(reviewersSaved).toBeGreaterThanOrEqual(0);
    expect(repo.syncForAppraisal.mock.invocationCallOrder[reviewersSaved])
      .toBeLessThan(repo.addAssignedReviewers.mock.invocationCallOrder[0]);
  });

  it("adds none when Stage 2 is resubmitted after Stage 3", async () => {
    stored({ status: "reviewed", stage2Status: "completed", stage3Status: "completed" });
    await service.submitStage(UUID, "stage2", { reviewers }, "Master");

    expect(repo.addAssignedReviewers).not.toHaveBeenCalled();
  });

  it("is not part of Stage 1 or Stage 3", async () => {
    stored({ stage2Status: "completed" });
    await service.submitStage(UUID, "stage1", { reviewers }, "Master");
    await service.submitStage(UUID, "stage3", { reviewers, trainings: [{ evaluation: "Good" }] }, "Master");

    expect(repo.addAssignedReviewers).not.toHaveBeenCalled();
  });
});
