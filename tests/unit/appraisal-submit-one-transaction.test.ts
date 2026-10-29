import { beforeEach, describe, expect, it, vi } from "vitest";

// APD-30: one click of Submit used to send 2–3 requests (create the draft,
// submit Stage 1, submit Stage 2), each committed on its own, so a failure
// part-way left a half-done appraisal for the sync to pick up. Now the click
// sends one request and the server saves all of it in one transaction.

const { repo, crewRepo, formsService, getDbMock, sendEmail, events } = vi.hoisted(() => ({
  repo: {
    findByAppraisalUuid: vi.fn(),
    findByAppraisalUuidIncludingDeleted: vi.fn(),
    findByAppraisalUuids: vi.fn(),
    createIfAbsent: vi.fn(),
    updateByAppraisalUuid: vi.fn(),
    syncForAppraisal: vi.fn(),
    addAssignedReviewers: vi.fn(),
  },
  crewRepo: { findByUuid: vi.fn() },
  formsService: { getFormForRank: vi.fn() },
  getDbMock: vi.fn(),
  sendEmail: vi.fn(),
  events: [] as string[],
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
vi.mock("@server/v2/shared/emailService", () => ({ sendEmail, logEmailEvent: vi.fn() }));
vi.mock("@server/v2/appraisals/utils/requestActor", () => ({
  resolveAppraisalActor: vi.fn(async () => ({ name: "Test Officer", userUuid: "user-1" })),
}));

import { AppraisalResultsService, AppraisalIdConflictError, CrewReferenceError } from "@server/v2/appraisals/services/appraisalResultsService";
import { AppraisalResultsController } from "@server/v2/appraisals/controllers/appraisalResultsController";

const UUID = "30000000-0000-4000-8000-000000000030";
const CREW = "c0000000-0000-4000-8000-000000000030";
const tx = { name: "tx" };

const STAGE1 = {
  seafarersName: "Test Seafarer",
  seafarersRank: "Master",
  vessel: "Test Vessel",
  appraisalType: "Annual",
  trainings: [{ uuid: "b1-row", training: "ECDIS" }],
  targets: [{ uuid: "b2-row", targetSetting: "Zero incidents" }],
};

// What the form sends to create an appraisal it never saved.
const CREATE = {
  crewMemberId: CREW,
  appraisalUuid: UUID,
  formId: 1,
  appraisalType: "Annual",
  appraisalDate: "2026-10-27",
  appraisalData: { ...STAGE1, competenceAssessments: [{ uuid: "c-row" }] },
  status: "draft",
};

const STAGE2 = {
  competenceAssessments: [{ uuid: "c-row", effectiveness: "4-meets-expectations", weight: 100 }],
  reviewers: [{ userUuid: "reviewer-1", reviewerName: "Reviewer" }],
};

// Which stage an update of the main row is.
function updateLabel(data: any) {
  if (data.stage2Status) return "update:stage2";
  if (data.stage1Status) return "update:stage1";
  return "update";
}

function fakeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

// The fire-and-forget emails run on promise callbacks after submitStage returns.
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  events.length = 0;

  // A transaction that records where it starts and where it commits. When the
  // callback throws, it never commits (a rollback).
  const where = () => Object.assign(Promise.resolve([]), {
    limit: () => Promise.resolve([{ email: "reviewer@example.com", fullname: "Reviewer" }]),
  });
  getDbMock.mockReturnValue({
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => {
      events.push("tx:start");
      const result = await fn(tx);
      events.push("tx:commit");
      return result;
    }),
    select: () => ({ from: () => ({ where }) }),
  });

  repo.findByAppraisalUuid.mockResolvedValue(undefined);
  repo.findByAppraisalUuidIncludingDeleted.mockResolvedValue(undefined);
  repo.createIfAbsent.mockImplementation(async (row: any) => { events.push("create"); return { ...row, id: 1 }; });
  repo.updateByAppraisalUuid.mockImplementation(async (_uuid: string, data: any) => { events.push(updateLabel(data)); return data; });
  repo.syncForAppraisal.mockResolvedValue(0);
  repo.addAssignedReviewers.mockResolvedValue(0);
  repo.findByAppraisalUuids.mockResolvedValue(new Map());
  crewRepo.findByUuid.mockResolvedValue({ crewUuid: CREW });
  formsService.getFormForRank.mockResolvedValue({ formVersionId: 7, formVersionUuid: "fv-7", isLockForm: true });
  sendEmail.mockImplementation(() => { events.push("email"); });
  vi.spyOn(AppraisalResultsService.prototype, "getByUuid").mockResolvedValue({ appraisalUuid: UUID } as any);
});

describe("a stage submit of a new appraisal is one transaction (service)", () => {
  const service = new AppraisalResultsService();

  it("Stage 1: creates the appraisal and submits Stage 1 in the same transaction", async () => {
    await service.submitStage(UUID, "stage1", STAGE1, "Master", { create: CREATE });

    expect(getDbMock().transaction).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["tx:start", "create", "update:stage1", "tx:commit"]);
    expect(repo.createIfAbsent.mock.calls[0][1]).toBe(tx);
    expect(repo.updateByAppraisalUuid.mock.calls[0][2]).toBe(tx);
    // Created as a draft; the Stage 1 update in the same transaction moves it on.
    expect(repo.createIfAbsent.mock.calls[0][0]).toMatchObject({ appraisalUuid: UUID, crewMemberId: CREW, status: "draft", formVersionId: 7 });
    expect(repo.updateByAppraisalUuid.mock.calls[0][1]).toMatchObject({ status: "preliminary", stage1Status: "completed" });
    for (const call of repo.syncForAppraisal.mock.calls) expect(call[3]).toBe(tx);
  });

  it("Stage 2 with Part B2 hidden: create, Stage 1 and Stage 2 commit together; emails go after the commit", async () => {
    // Part C/D as the create leaves them (C row not rated), then as Stage 2 leaves them.
    repo.findByAppraisalUuids
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([[UUID, STAGE2.competenceAssessments]]))
      .mockResolvedValueOnce(new Map());

    await service.submitStage(UUID, "stage2", STAGE2, "Master", { create: CREATE, stage1: STAGE1 });
    await flushPromises();

    expect(getDbMock().transaction).toHaveBeenCalledTimes(1);
    // The ratings follow the C row Stage 2 saved (APD-49).
    expect(events).toEqual(["tx:start", "create", "update:stage1", "update:stage2", "update", "tx:commit", "email"]);
    expect(repo.updateByAppraisalUuid.mock.calls[1][1]).toMatchObject({ status: "pending_review", stage2Status: "completed", isLockForm: true });
    expect(repo.updateByAppraisalUuid.mock.calls[2]).toEqual([UUID, { competenceRating: "4.0", overallRating: "4.0" }, tx]);
    expect(repo.addAssignedReviewers).toHaveBeenCalledWith(UUID, STAGE2.reviewers, null, tx);
  });

  it("a write that fails inside the transaction rolls all of it back and sends no email", async () => {
    repo.syncForAppraisal.mockImplementation(async (_uuid: string, rows: any[]) => {
      if (rows === STAGE2.competenceAssessments) throw new Error("write failed");
      return 0;
    });

    await expect(
      service.submitStage(UUID, "stage2", STAGE2, "Master", { create: CREATE, stage1: STAGE1 }),
    ).rejects.toThrow("write failed");
    await flushPromises();

    expect(getDbMock().transaction).toHaveBeenCalledTimes(1);
    expect(events).not.toContain("tx:commit");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a failed check writes nothing: Stage 2 of a new appraisal without Stage 1", async () => {
    await expect(
      service.submitStage(UUID, "stage2", STAGE2, "Master", { create: CREATE }),
    ).rejects.toThrow("Stage 1 must be submitted before Stage 2");

    expect(getDbMock().transaction).not.toHaveBeenCalled();
    expect(repo.createIfAbsent).not.toHaveBeenCalled();
    expect(repo.updateByAppraisalUuid).not.toHaveBeenCalled();
  });

  it("a failed check writes nothing: unknown crew member", async () => {
    crewRepo.findByUuid.mockResolvedValue(undefined);

    await expect(
      service.submitStage(UUID, "stage1", STAGE1, "Master", { create: CREATE }),
    ).rejects.toBeInstanceOf(CrewReferenceError);

    expect(getDbMock().transaction).not.toHaveBeenCalled();
  });

  it("a retry of a submit that already committed does not create again or repeat Stage 1", async () => {
    repo.findByAppraisalUuidIncludingDeleted.mockResolvedValue({
      appraisalUuid: UUID,
      crewMemberId: CREW,
      isDeleted: false,
      status: "preliminary",
      stage1Status: "completed",
      seafarersRank: "Master",
      formVersionId: 7,
      formVersionUuid: "fv-7",
    });

    await service.submitStage(UUID, "stage2", STAGE2, "Master", { create: CREATE, stage1: STAGE1 });
    await flushPromises();

    expect(repo.createIfAbsent).not.toHaveBeenCalled();
    expect(events).toEqual(["tx:start", "update:stage2", "tx:commit", "email"]);
  });

  it("an id already used for another crew member is a conflict, and nothing is written", async () => {
    repo.findByAppraisalUuidIncludingDeleted.mockResolvedValue({ appraisalUuid: UUID, crewMemberId: "someone-else", isDeleted: false });

    await expect(
      service.submitStage(UUID, "stage1", STAGE1, "Master", { create: CREATE }),
    ).rejects.toBeInstanceOf(AppraisalIdConflictError);

    expect(getDbMock().transaction).not.toHaveBeenCalled();
  });

  it("a parallel request that created it first makes this one fail as a whole (a retry finds it)", async () => {
    repo.createIfAbsent.mockResolvedValue(undefined);

    await expect(
      service.submitStage(UUID, "stage1", STAGE1, "Master", { create: CREATE }),
    ).rejects.toBeInstanceOf(AppraisalIdConflictError);

    expect(repo.updateByAppraisalUuid).not.toHaveBeenCalled();
    expect(events).not.toContain("tx:commit");
  });

  it("a submit without `create` still needs a saved appraisal", async () => {
    const result = await service.submitStage(UUID, "stage1", STAGE1, "Master");

    expect(result).toBeNull();
    expect(getDbMock().transaction).not.toHaveBeenCalled();
  });

  it("save draft of a new appraisal (POST /) still creates it in one transaction", async () => {
    const { created } = await service.create({ ...CREATE, auditUserUuid: "user-1" });

    expect(created).toBe(true);
    expect(events).toEqual(["tx:start", "create", "tx:commit"]);
    expect(repo.createIfAbsent.mock.calls[0][0]).toMatchObject({ appraisalUuid: UUID, createdByUuid: "user-1", status: "draft" });
    expect(repo.syncForAppraisal).toHaveBeenCalledWith(UUID, CREATE.appraisalData.trainings, "user-1", tx);
  });
});

describe("a stage submit request carries `create` and `stage1` to the service (controller)", () => {
  function submit(stage: "stage1" | "stage2", body: Record<string, unknown>) {
    const controller = new AppraisalResultsController();
    const req: any = { params: { appraisalUuid: UUID }, body, user: { id: 24, userType: "Office" } };
    const res = fakeRes();
    const handler = stage === "stage1" ? controller.submitStage1 : controller.submitStage2;
    return handler.call(controller, req, res).then(() => res);
  }

  it("Stage 1 passes `create` through whole", async () => {
    const submitStage = vi.spyOn(AppraisalResultsService.prototype, "submitStage").mockResolvedValue({ appraisalUuid: UUID } as any);

    const res = await submit("stage1", { data: STAGE1, create: CREATE });

    expect(res.status).not.toHaveBeenCalled();
    expect(submitStage.mock.calls[0][4]).toEqual({ create: CREATE });
  });

  it("Stage 2 passes `create` and `stage1` through whole", async () => {
    const submitStage = vi.spyOn(AppraisalResultsService.prototype, "submitStage").mockResolvedValue({ appraisalUuid: UUID } as any);

    const res = await submit("stage2", { data: STAGE2, create: CREATE, stage1: STAGE1 });

    expect(res.status).not.toHaveBeenCalled();
    expect(submitStage.mock.calls[0][4]).toEqual({ create: CREATE, stage1: STAGE1 });
  });

  it("answers 409 for an id conflict and 400 for an unknown crew member", async () => {
    repo.findByAppraisalUuidIncludingDeleted.mockResolvedValue({ appraisalUuid: UUID, crewMemberId: "someone-else", isDeleted: false });
    const conflict = await submit("stage1", { data: STAGE1, create: CREATE });
    expect(conflict.status).toHaveBeenCalledWith(409);

    repo.findByAppraisalUuidIncludingDeleted.mockResolvedValue(undefined);
    crewRepo.findByUuid.mockResolvedValue(undefined);
    const noCrew = await submit("stage2", { data: STAGE2, create: CREATE, stage1: STAGE1 });
    expect(noCrew.status).toHaveBeenCalledWith(400);
  });
});
