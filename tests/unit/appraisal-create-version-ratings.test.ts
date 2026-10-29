import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const {
  getFormForRank, getVersionConfiguration, createWithUuid, findById,
  updateById, updateByAppraisalUuid, syncForAppraisal, ratingReads,
} = vi.hoisted(() => ({
  getFormForRank: vi.fn(),
  getVersionConfiguration: vi.fn(),
  createWithUuid: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
  updateByAppraisalUuid: vi.fn(),
  syncForAppraisal: vi.fn(),
  ratingReads: {
    trainings: vi.fn(), targets: vi.fn(),
    competenceAssessments: vi.fn(), behaviouralAssessments: vi.fn(),
  },
}));

vi.mock("@server/v2/admin/services", () => ({
  formsService: { getFormForRank, getVersionConfiguration },
}));
vi.mock("@server/v2/appraisals/repositories", () => {
  class ChildRepository {
    syncForAppraisal = syncForAppraisal;
    findByAppraisalUuids = async () => new Map();
  }
  return {
    AppraisalResultsRepository: class {
      createWithUuid = createWithUuid;
      findById = findById;
      updateById = updateById;
      updateByAppraisalUuid = updateByAppraisalUuid;
    },
    ApprTrainingsRepository: class extends ChildRepository { findByAppraisalUuids = ratingReads.trainings; },
    ApprTargetsRepository: class extends ChildRepository { findByAppraisalUuids = ratingReads.targets; },
    ApprCompetenceAssessmentsRepository: class extends ChildRepository { findByAppraisalUuids = ratingReads.competenceAssessments; },
    ApprBehaviouralAssessmentsRepository: class extends ChildRepository { findByAppraisalUuids = ratingReads.behaviouralAssessments; },
    ApprTrainingNeedsRepository: ChildRepository,
    ApprRecommendationsRepository: ChildRepository,
    ApprAppraiserCommentsRepository: ChildRepository,
    ApprSeafarerCommentsRepository: ChildRepository,
    ApprOfficeReviewsRepository: ChildRepository,
    ApprTrainingFollowupsRepository: ChildRepository,
    ApprReviewersRepository: ChildRepository,
  };
});
vi.mock("@server/v2/crew-pool/repositories", () => ({
  CrewMembersRepository: class {},
}));
vi.mock("@server/v2/db", () => ({
  // No pending manual reviewers, and no application database connection.
  getDb: () => ({ select: () => ({ from: () => ({ where: async () => [] }) }) }),
}));
vi.mock("@server/v2/shared/emailService", () => ({
  sendEmail: vi.fn(),
  logEmailEvent: vi.fn(),
}));

import {
  AppraisalResultsService,
  FormVersionPinError,
} from "@server/v2/appraisals/services/appraisalResultsService";
import { AppraisalResultsController } from "@server/v2/appraisals/controllers/appraisalResultsController";
import {
  AppraisalRatingVersionError,
  EffectivenessConfigurationError,
} from "@shared/appraisal-effectiveness";

const VERSION_ID = 17;
const VERSION_UUID = "20000000-0000-4000-8000-000000000017";
const customOptions = [{ id: "excellent", label: "6- Outstanding" }];
const releasedForm = (rankGroupConfig: unknown = {}) => ({
  formVersionId: VERSION_ID,
  formVersionUuid: VERSION_UUID,
  noReleasedVersion: false,
  rankGroupConfig,
});
const body = (overrides: Record<string, unknown> = {}) => ({
  crewMemberId: "crew-1",
  appraisalData: { seafarersRank: "Master", seafarersName: "Test Crew" },
  ...overrides,
});

describe("appraisal creation version pin and configured ratings", () => {
  let service: AppraisalResultsService;

  beforeEach(() => {
    vi.resetAllMocks();
    getFormForRank.mockResolvedValue(releasedForm());
    createWithUuid.mockResolvedValue({ id: 42 });
    syncForAppraisal.mockResolvedValue(undefined);
    service = new AppraisalResultsService();
    vi.spyOn(service, "getById").mockResolvedValue({ id: 42 } as any);
  });
  afterEach(() => vi.restoreAllMocks());

  async function expectNoSave(input: unknown, error: new (...args: any[]) => Error) {
    await expect(service.create(input)).rejects.toBeInstanceOf(error);
    expect(createWithUuid).not.toHaveBeenCalled();
    expect(syncForAppraisal).not.toHaveBeenCalled();
  }

  it("pins a legacy caller to a valid released version without requiring custom ratings", async () => {
    await expect(service.create(body())).resolves.toEqual({ id: 42 });
    expect(createWithUuid).toHaveBeenCalledWith(expect.objectContaining({
      formVersionId: VERSION_ID,
      formVersionUuid: VERSION_UUID,
      status: "draft",
    }));
    expect(getFormForRank).toHaveBeenCalledExactlyOnceWith("Master", "appraisal");
  });

  it("does not persist a legacy caller without a seafarer rank", async () => {
    await expectNoSave(body({ appraisalData: { seafarersRank: "  " } }), FormVersionPinError);
    expect(getFormForRank).not.toHaveBeenCalled();
  });

  it.each([
    ["an unconfigured rank", null],
    ["no released version", { ...releasedForm(), noReleasedVersion: true }],
    ["a missing version ID", { ...releasedForm(), formVersionId: null }],
    ["a zero version ID", { ...releasedForm(), formVersionId: 0 }],
    ["a missing version UUID", { ...releasedForm(), formVersionUuid: null }],
  ])("does not persist a legacy caller with %s", async (_reason, form) => {
    getFormForRank.mockResolvedValue(form);
    await expectNoSave(body(), FormVersionPinError);
  });

  it("does not silently save an unpinned appraisal when form resolution fails", async () => {
    getFormForRank.mockRejectedValue(new Error("Form service unavailable"));
    await expectNoSave(body(), FormVersionPinError);
  });

  it.each([null, "17", 0, -1, 1.5])("rejects an invalid expected version %s before resolving or saving", async expectedFormVersionId => {
    await expectNoSave(body({ expectedFormVersionId }), AppraisalRatingVersionError);
    expect(getFormForRank).not.toHaveBeenCalled();
  });

  it("rejects a stale expected version before saving even when the old rating still exists", async () => {
    getFormForRank.mockResolvedValue(releasedForm({ effectivenessOptions: customOptions }));
    await expectNoSave(body({
      expectedFormVersionId: VERSION_ID - 1,
      appraisalData: { seafarersRank: "Master", trainings: [{ evaluation: "excellent" }] },
    }), AppraisalRatingVersionError);
    expect(getFormForRank).toHaveBeenCalledTimes(1);
  });

  it("returns a version conflict when a previously selected release becomes unavailable", async () => {
    getFormForRank.mockResolvedValue(null);
    await expectNoSave(body({ expectedFormVersionId: VERSION_ID }), AppraisalRatingVersionError);
  });

  it("requires an expected version when the released form uses configurable ratings", async () => {
    getFormForRank.mockResolvedValue(releasedForm({ effectivenessOptions: customOptions }));
    await expectNoSave(body(), AppraisalRatingVersionError);
  });

  it("uses the same single release lookup for the pin and all configured rating fields", async () => {
    getFormForRank.mockResolvedValueOnce(releasedForm({ effectivenessOptions: customOptions }))
      .mockResolvedValue(releasedForm({ effectivenessOptions: [{ id: "different", label: "1- Low" }] }));
    await service.create(body({
      expectedFormVersionId: VERSION_ID,
      appraisalData: {
        seafarersRank: "Master",
        trainings: [{ evaluation: "excellent" }],
        targets: [{ evaluation: "excellent" }],
        competenceAssessments: [{ effectiveness: "excellent" }],
        behaviouralAssessments: [{ effectiveness: "excellent" }],
      },
    }));
    expect(getFormForRank).toHaveBeenCalledTimes(1);
    expect(createWithUuid).toHaveBeenCalledWith(expect.objectContaining({
      formVersionId: VERSION_ID, formVersionUuid: VERSION_UUID,
    }));
    expect(syncForAppraisal).toHaveBeenCalledWith(expect.any(String), [{ evaluation: "excellent" }], null);
  });

  it.each([
    { trainings: [{ evaluation: "removed" }] },
    { targets: [{ evaluation: "removed" }] },
    { competenceAssessments: [{ effectiveness: "removed" }] },
    { behaviouralAssessments: [{ effectiveness: "removed" }] },
  ])("rejects ratings absent from the selected release: %j", async selections => {
    getFormForRank.mockResolvedValue(releasedForm({ effectivenessOptions: customOptions }));
    await expectNoSave(body({
      expectedFormVersionId: VERSION_ID,
      appraisalData: { seafarersRank: "Master", ...selections },
    }), EffectivenessConfigurationError);
  });

  it("rejects malformed configuration instead of treating it as a legacy release", async () => {
    getFormForRank.mockResolvedValue(releasedForm("invalid-json"));
    await expectNoSave(body({ expectedFormVersionId: VERSION_ID }), EffectivenessConfigurationError);
  });

  it.each([
    ["version conflict", { expectedFormVersionId: VERSION_ID - 1 }, 409],
    ["missing released pin", {}, 400],
  ])("maps %s to its expected API response", async (_reason, overrides, status) => {
    if (status === 400) getFormForRank.mockResolvedValue(null);
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await new AppraisalResultsController().create(
      { body: body(overrides) } as Request, response as unknown as Response,
    );
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(createWithUuid).not.toHaveBeenCalled();
  });
});

describe("appraisal updates and stage submissions retain frozen rating rules", () => {
  const APPRAISAL_UUID = "appraisal-42";
  const existing = (overrides: Record<string, unknown> = {}) => ({
    id: 42, appraisalUuid: APPRAISAL_UUID, seafarersRank: "Master", seafarersName: "Test Crew",
    status: "draft", stage1Status: "completed", stage2Status: "completed",
    formVersionId: VERSION_ID, formVersionUuid: VERSION_UUID, ...overrides,
  });
  const validSelections = {
    seafarersRank: "Master", seafarersName: "Test Crew", vessel: "Vessel", appraisalType: "Annual",
    trainings: [{ evaluation: "excellent" }], targets: [{ evaluation: "excellent" }],
    competenceAssessments: [{ effectiveness: "excellent" }],
    behaviouralAssessments: [{ effectiveness: "excellent" }],
  };
  type Workflow = "update" | "stage1" | "stage2" | "stage3";
  const workflows: Workflow[] = ["update", "stage1", "stage2", "stage3"];
  let service: AppraisalResultsService;

  beforeEach(() => {
    vi.resetAllMocks();
    findById.mockResolvedValue(existing());
    getVersionConfiguration.mockResolvedValue({ ...releasedForm({ effectivenessOptions: customOptions }), isLockForm: true });
    getFormForRank.mockResolvedValue(releasedForm({ effectivenessOptions: customOptions }));
    for (const read of Object.values(ratingReads)) read.mockResolvedValue(new Map());
    syncForAppraisal.mockResolvedValue(undefined);
    vi.spyOn(AppraisalResultsService.prototype, "getById").mockResolvedValue({ id: 42 } as any);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    service = new AppraisalResultsService();
  });
  afterEach(() => vi.restoreAllMocks());

  const save = (workflow: Workflow, selections: Record<string, unknown> = validSelections, extra: Record<string, unknown> = {}) =>
    workflow === "update"
      ? service.update(42, { appraisalData: selections, ...extra })
      : service.submitStage(42, workflow, { ...selections, ...extra }, "Reviewer");

  function expectNoWrites() {
    expect(updateById).not.toHaveBeenCalled();
    expect(updateByAppraisalUuid).not.toHaveBeenCalled();
    expect(syncForAppraisal).not.toHaveBeenCalled();
  }

  it.each(workflows)("uses the saved version for %s after a newer version is released", async workflow => {
    getFormForRank.mockResolvedValue({
      ...releasedForm({ effectivenessOptions: [{ id: "new-rating", label: "7- New scale" }] }),
      formVersionId: VERSION_ID + 1, formVersionUuid: "new-version",
    });
    await expect(save(workflow)).resolves.toEqual({ id: 42 });
    expect(getVersionConfiguration).toHaveBeenCalledExactlyOnceWith(VERSION_ID);
    expect(getFormForRank).not.toHaveBeenCalled();
    if (workflow === "stage2") {
      expect(updateByAppraisalUuid).toHaveBeenCalledWith(APPRAISAL_UUID,
        expect.objectContaining({ isLockForm: true }));
    }
  });

  it.each(workflows)("rejects foreign incoming ratings before any %s writes", async workflow => {
    await expect(save(workflow, {
      ...validSelections,
      trainings: [{ evaluation: "other-version" }],
    })).rejects.toBeInstanceOf(EffectivenessConfigurationError);
    expectNoWrites();
  });

  it.each([
    ["update", "competenceAssessments", { effectiveness: "other-version" }],
    ["stage1", "behaviouralAssessments", { effectiveness: "other-version" }],
    ["stage2", "targets", { evaluation: "other-version" }],
    ["stage3", "trainings", { evaluation: "other-version" }],
  ] as const)("validates persisted %s fallback ratings from %s", async (workflow, family, invalidRow) => {
    ratingReads[family].mockResolvedValue(new Map([[APPRAISAL_UUID, [invalidRow]]]));
    const attempt = workflow === "update"
      ? service.update(42, { appraisalType: "Annual" })
      : service.submitStage(42, workflow, { seafarersRank: "Master" }, "Reviewer");
    await expect(attempt).rejects.toBeInstanceOf(EffectivenessConfigurationError);
    expect(ratingReads[family]).toHaveBeenCalledWith([APPRAISAL_UUID]);
    expectNoWrites();
  });

  it.each([
    ["an ID without UUID", { formVersionUuid: null }],
    ["a UUID without ID", { formVersionId: null }],
    ["an invalid ID", { formVersionId: 0 }],
  ])("rejects %s without writing", async (_reason, pin) => {
    findById.mockResolvedValue(existing(pin));
    await expect(save("update")).rejects.toBeInstanceOf(FormVersionPinError);
    expect(getVersionConfiguration).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it.each(workflows)("rejects a configuration whose UUID disagrees with the saved pin during %s", async workflow => {
    getVersionConfiguration.mockResolvedValue({
      ...releasedForm({ effectivenessOptions: customOptions }), formVersionUuid: "different-version",
    });
    await expect(save(workflow)).rejects.toBeInstanceOf(FormVersionPinError);
    expectNoWrites();
  });

  it("rejects a configuration whose numeric ID disagrees with the saved pin", async () => {
    getVersionConfiguration.mockResolvedValue({ ...releasedForm(), formVersionId: VERSION_ID + 1 });
    await expect(save("update")).rejects.toBeInstanceOf(FormVersionPinError);
    expectNoWrites();
  });

  it.each([undefined, VERSION_ID - 1])("requires a matching expected version before pinning an unpinned custom draft: %s", async expectedFormVersionId => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    await expect(save("update", validSelections, { expectedFormVersionId }))
      .rejects.toBeInstanceOf(AppraisalRatingVersionError);
    expectNoWrites();
  });

  it.each(["update", "stage1"] as const)("pins an unpinned custom appraisal on %s with a matching expected version", async workflow => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    await save(workflow, validSelections, { expectedFormVersionId: VERSION_ID });
    const write = workflow === "update" ? updateById : updateByAppraisalUuid;
    expect(write).toHaveBeenCalledWith(workflow === "update" ? 42 : APPRAISAL_UUID,
      expect.objectContaining({ formVersionId: VERSION_ID, formVersionUuid: VERSION_UUID }));
    expect(getFormForRank).toHaveBeenCalledExactlyOnceWith("Master", "appraisal");
  });

  it("keeps an unpinned legacy draft unpinned while validating that a released form exists", async () => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    getFormForRank.mockResolvedValue(releasedForm());
    await service.update(42, { appraisalType: "Annual" });
    expect(getFormForRank).toHaveBeenCalledExactlyOnceWith("Master", "appraisal");
    const update = updateById.mock.calls[0][1];
    expect(update).not.toHaveProperty("formVersionId");
    expect(update).not.toHaveProperty("formVersionUuid");
  });

  it.each([
    ["no rank", { seafarersRank: null }, null],
    ["no mapped form", {}, null],
    ["no released version", {}, { ...releasedForm(), noReleasedVersion: true }],
  ])("preserves an unpinned historical draft update with %s", async (_reason, overrides, form) => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null, ...overrides }));
    getFormForRank.mockResolvedValue(form);
    await expect(service.update(42, { appraisalType: "Annual" })).resolves.toEqual({ id: 42 });
    expect(updateById).toHaveBeenCalledWith(42, expect.objectContaining({ appraisalType: "Annual" }));
    expect(updateById.mock.calls[0][1]).not.toHaveProperty("formVersionId");
    expect(updateById.mock.calls[0][1]).not.toHaveProperty("formVersionUuid");
    expect(getVersionConfiguration).not.toHaveBeenCalled();
  });

  it.each([
    ["no mapped form", null],
    ["no released version", { ...releasedForm(), noReleasedVersion: true }],
  ])("still rejects submitting an unpinned historical draft with %s", async (_reason, form) => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    getFormForRank.mockResolvedValue(form);
    await expect(save("stage1")).rejects.toBeInstanceOf(FormVersionPinError);
    expectNoWrites();
  });

  it("does not swallow a database or network failure while loading an unpinned draft's form", async () => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    getFormForRank.mockRejectedValue(new Error("Database connection unavailable"));
    await expect(service.update(42, { appraisalType: "Annual" })).rejects.toBeInstanceOf(FormVersionPinError);
    expectNoWrites();
  });

  it.each([
    ["malformed configuration", releasedForm("invalid-json"), EffectivenessConfigurationError],
    ["invalid released pin metadata", { ...releasedForm(), formVersionId: null }, FormVersionPinError],
    ["unconfirmed custom ratings", releasedForm({ effectivenessOptions: customOptions }), AppraisalRatingVersionError],
  ])("does not use historical draft compatibility for %s", async (_reason, form, error) => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    getFormForRank.mockResolvedValue(form);
    await expect(service.update(42, { appraisalType: "Annual" })).rejects.toBeInstanceOf(error);
    expectNoWrites();
  });

  it("does not use historical draft compatibility when an expected version was supplied", async () => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    getFormForRank.mockResolvedValue(null);
    await expect(service.update(42, { expectedFormVersionId: VERSION_ID })).rejects.toBeInstanceOf(AppraisalRatingVersionError);
    expectNoWrites();
  });

  it("assigns a released pin when a historical legacy draft is submitted", async () => {
    findById.mockResolvedValue(existing({ formVersionId: null, formVersionUuid: null }));
    getFormForRank.mockResolvedValue(releasedForm());
    await save("stage1", { seafarersRank: "Master" });
    expect(updateByAppraisalUuid).toHaveBeenCalledWith(APPRAISAL_UUID,
      expect.objectContaining({ formVersionId: VERSION_ID, formVersionUuid: VERSION_UUID }));
  });

  it.each(workflows)("returns HTTP 400 for invalid ratings through %s", async workflow => {
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    const selections = { ...validSelections, trainings: [{ evaluation: "other-version" }] };
    const controller = new AppraisalResultsController();
    const method = workflow === "update" ? "update"
      : workflow === "stage1" ? "submitStage1" : workflow === "stage2" ? "submitStage2" : "submitStage3";
    await controller[method]({ params: { id: "42" }, body: workflow === "update"
      ? { appraisalData: selections } : { data: selections } } as unknown as Request,
    response as unknown as Response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: expect.any(String) });
    expectNoWrites();
  });

  it.each(workflows)("returns HTTP 409 for an invalid expected version through %s", async workflow => {
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    const controller = new AppraisalResultsController();
    const method = workflow === "update" ? "update"
      : workflow === "stage1" ? "submitStage1" : workflow === "stage2" ? "submitStage2" : "submitStage3";
    await controller[method]({ params: { id: "42" }, body: {
      ...(workflow === "update" ? { appraisalData: validSelections } : { data: validSelections }),
      expectedFormVersionId: "17",
    } } as unknown as Request, response as unknown as Response);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ error: expect.any(String) });
    expectNoWrites();
  });

  it("preserves Stage 3 training edits and expected version through the HTTP schema", async () => {
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    await new AppraisalResultsController().submitStage3({ params: { id: "42" }, body: {
      data: { trainings: validSelections.trainings }, expectedFormVersionId: VERSION_ID,
    } } as unknown as Request, response as unknown as Response);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ id: 42 });
    expect(syncForAppraisal).toHaveBeenCalledWith(APPRAISAL_UUID, validSelections.trainings, null);
    expect(updateByAppraisalUuid).toHaveBeenCalledWith(APPRAISAL_UUID,
      expect.objectContaining({ stage3Status: "completed" }));
  });
});
