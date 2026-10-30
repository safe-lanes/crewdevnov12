import { beforeEach, describe, expect, it, vi } from "vitest";

// APD-31: the form sent `submittedBy: "Current User"` and its own
// `auditUserUuid`, and the server saved both as sent, so no appraisal recorded
// who really submitted it. Now the server takes the user from the login.

const { repo, crewRepo, formsService, getDbMock, resolveActor } = vi.hoisted(() => ({
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
  resolveActor: vi.fn(),
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
vi.mock("@server/v2/appraisals/utils/requestActor", () => ({ resolveAppraisalActor: resolveActor }));

import { AppraisalResultsService } from "@server/v2/appraisals/services/appraisalResultsService";
import { AppraisalResultsController } from "@server/v2/appraisals/controllers/appraisalResultsController";

const UUID = "30000000-0000-4000-8000-000000000031";
const CREW = "c0000000-0000-4000-8000-000000000031";
const ACTOR = { name: "Thomas Xu", userUuid: "2228582e-8c50-4bb9-ad0d-58be4e02a165" };
// What an old page, or anyone calling the API by hand, can put in the body.
const FORGED = { submittedBy: "Hacker", auditUserUuid: "forged-uuid" };
const tx = { name: "tx" };

const STAGE1 = {
  seafarersName: "Test Seafarer",
  seafarersRank: "Master",
  vessel: "Test Vessel",
  appraisalType: "Annual",
  trainings: [{ uuid: "b1-row", training: "ECDIS" }],
  targets: [{ uuid: "b2-row", targetSetting: "Zero incidents" }],
};

const CREATE = {
  crewMemberId: CREW,
  appraisalUuid: UUID,
  formId: 1,
  appraisalType: "Annual",
  appraisalData: STAGE1,
  status: "draft",
};

function fakeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

type Handler = "create" | "update" | "submitStage1" | "submitStage2" | "submitStage3" | "deleteAppraisal";

const BODIES: Record<Handler, Record<string, unknown>> = {
  create: { ...CREATE, ...FORGED },
  update: { changes: { header: { primaryAppraiser: "Chief Officer" } }, ...FORGED },
  submitStage1: { data: STAGE1, ...FORGED },
  submitStage2: { data: { competenceAssessments: [] }, ...FORGED },
  submitStage3: { data: { officeReviews: [] }, ...FORGED },
  deleteAppraisal: { ...FORGED },
};

function call(handler: Handler, user: object | undefined = { id: 24, userType: "Office" }) {
  const controller = new AppraisalResultsController();
  const req: any = { params: { appraisalUuid: UUID }, body: BODIES[handler], user };
  const res = fakeRes();
  return (controller[handler] as any).call(controller, req, res).then(() => res);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  resolveActor.mockResolvedValue(ACTOR);
});

describe("the controller takes the actor from the login, not the body", () => {
  beforeEach(() => {
    vi.spyOn(AppraisalResultsService.prototype, "submitStage").mockResolvedValue({ appraisalUuid: UUID } as any);
    vi.spyOn(AppraisalResultsService.prototype, "create").mockResolvedValue({ appraisal: { appraisalUuid: UUID }, created: true } as any);
    vi.spyOn(AppraisalResultsService.prototype, "update").mockResolvedValue({ appraisalUuid: UUID } as any);
    vi.spyOn(AppraisalResultsService.prototype, "delete").mockResolvedValue(true);
  });

  for (const handler of ["submitStage1", "submitStage2", "submitStage3"] as const) {
    it(`${handler} submits as the logged-in user`, async () => {
      const res = await call(handler);

      expect(res.status).not.toHaveBeenCalled();
      const [, , data, submittedBy] = vi.mocked(AppraisalResultsService.prototype.submitStage).mock.calls[0];
      expect(submittedBy).toBe(ACTOR.name);
      expect(data.auditUserUuid).toBe(ACTOR.userUuid);
    });
  }

  it("create (save draft of a new appraisal) saves as the logged-in user", async () => {
    const res = await call("create");

    expect(res.status).toHaveBeenCalledWith(201);
    expect(AppraisalResultsService.prototype.create).toHaveBeenCalledWith(
      expect.objectContaining({ submittedBy: ACTOR.name, auditUserUuid: ACTOR.userUuid }),
    );
  });

  it("update (save draft) saves as the logged-in user", async () => {
    const res = await call("update");

    expect(res.status).not.toHaveBeenCalled();
    expect(AppraisalResultsService.prototype.update).toHaveBeenCalledWith(UUID, {
      changes: BODIES.update.changes,
      auditUserUuid: ACTOR.userUuid,
    });
  });

  it("delete records the logged-in user as the one who deleted it (APD-33)", async () => {
    const res = await call("deleteAppraisal");

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(AppraisalResultsService.prototype.delete).toHaveBeenCalledWith(UUID, ACTOR.userUuid);
  });

  for (const handler of Object.keys(BODIES) as Handler[]) {
    it(`${handler} answers 401 and saves nothing when the user can't be identified`, async () => {
      resolveActor.mockResolvedValue(null);

      const res = await call(handler, undefined);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json.mock.calls[0][0].error).toMatch(/sign-in could not be verified/);
      expect(AppraisalResultsService.prototype.submitStage).not.toHaveBeenCalled();
      expect(AppraisalResultsService.prototype.create).not.toHaveBeenCalled();
      expect(AppraisalResultsService.prototype.update).not.toHaveBeenCalled();
      expect(AppraisalResultsService.prototype.delete).not.toHaveBeenCalled();
    });
  }

  it("a ship user without a known login gets 401 on Stage 3, not the Part G 403", async () => {
    resolveActor.mockResolvedValue(null);

    const res = await call("submitStage3", { id: 999, userType: "Ship" });

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("a create sent with a stage submit is saved as the submit's actor (service)", () => {
  const service = new AppraisalResultsService();

  beforeEach(() => {
    const where = () => Object.assign(Promise.resolve([]), { limit: () => Promise.resolve([]) });
    getDbMock.mockReturnValue({
      transaction: (fn: (t: unknown) => unknown) => fn(tx),
      select: () => ({ from: () => ({ where }) }),
    });
    repo.findByAppraisalUuidIncludingDeleted.mockResolvedValue(undefined);
    repo.createIfAbsent.mockImplementation(async (row: any) => ({ ...row, id: 1 }));
    repo.updateByAppraisalUuid.mockImplementation(async (_uuid: string, data: any) => data);
    repo.syncForAppraisal.mockResolvedValue(0);
    repo.findByAppraisalUuids.mockResolvedValue(new Map());
    crewRepo.findByUuid.mockResolvedValue({ crewUuid: CREW });
    formsService.getFormForRank.mockResolvedValue({ formVersionId: 7, formVersionUuid: "fv-7", isLockForm: true });
    vi.spyOn(AppraisalResultsService.prototype, "getByUuid").mockResolvedValue({ appraisalUuid: UUID } as any);
  });

  it("ignores the submitter and audit id inside `create`", async () => {
    await service.submitStage(
      UUID, "stage1", { ...STAGE1, auditUserUuid: ACTOR.userUuid }, ACTOR.name,
      { create: { ...CREATE, submittedBy: "Current User", auditUserUuid: "forged-uuid" } },
    );

    expect(repo.createIfAbsent.mock.calls[0][0]).toMatchObject({
      submittedBy: ACTOR.name,
      createdByUuid: ACTOR.userUuid,
      updatedByUuid: ACTOR.userUuid,
    });
    expect(repo.updateByAppraisalUuid.mock.calls[0][1]).toMatchObject({
      submittedBy: ACTOR.name,
      stage1SubmittedBy: ACTOR.name,
      updatedByUuid: ACTOR.userUuid,
    });
    expect(repo.syncForAppraisal).toHaveBeenCalled();
    for (const c of repo.syncForAppraisal.mock.calls) expect(c[2]).toBe(ACTOR.userUuid);
  });
});

describe("resolveAppraisalActor", () => {
  let resolveAppraisalActor: typeof import("@server/v2/appraisals/utils/requestActor").resolveAppraisalActor;
  let rows: any[];
  let lookedUp: boolean;

  beforeEach(async () => {
    ({ resolveAppraisalActor } = await vi.importActual<typeof import("@server/v2/appraisals/utils/requestActor")>(
      "@server/v2/appraisals/utils/requestActor",
    ));
    rows = [];
    lookedUp = false;
    getDbMock.mockReturnValue({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => { lookedUp = true; return rows; } }) }) }),
    });
  });

  it("returns the name and user_uuid of the master_users row for the token's id", async () => {
    rows = [{ userUuid: ACTOR.userUuid, fullname: "Thomas Xu", displayName: "Thomas Xu ,Senior Fleet Director" }];

    expect(await resolveAppraisalActor({ user: { id: 24 } } as any)).toEqual(ACTOR);
  });

  it("falls back to the display name, then first and last name", async () => {
    rows = [{ userUuid: "u-1", fullname: null, displayName: "Bruce Kong ,Marine Manager" }];
    expect((await resolveAppraisalActor({ user: { id: 3 } } as any))?.name).toBe("Bruce Kong ,Marine Manager");

    rows = [{ userUuid: "u-1", fullname: null, displayName: null, firstname: "George", lastname: "Zhu" }];
    expect((await resolveAppraisalActor({ user: { id: 4 } } as any))?.name).toBe("George Zhu");
  });

  it("returns null without a login, and never reads the body", async () => {
    expect(await resolveAppraisalActor({ body: FORGED } as any)).toBeNull();
    expect(lookedUp).toBe(false);
  });

  it("returns null when the user is not in master_users, or has no uuid or name", async () => {
    rows = [];
    expect(await resolveAppraisalActor({ user: { id: 24 } } as any)).toBeNull();

    rows = [{ userUuid: null, fullname: "Thomas Xu" }];
    expect(await resolveAppraisalActor({ user: { id: 24 } } as any)).toBeNull();

    rows = [{ userUuid: "u-1", fullname: null, displayName: null, firstname: null, lastname: " " }];
    expect(await resolveAppraisalActor({ user: { id: 24 } } as any)).toBeNull();
  });
});
