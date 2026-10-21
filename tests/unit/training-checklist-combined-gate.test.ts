import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const f = vi.hoisted(() => ({
  actor: { masterUserId: 42, roleId: "trusted-role", roleName: "Crew manager", userType: "Office", source: "access_control" },
  formPermission: false, trainingPermission: false, requirements: [] as any[], stage: "COMPLETED",
  training: {} as any, audit: vi.fn(), record: vi.fn(),
}));
vi.mock("../../server/v2/company-forms/trustedPrincipalService", () => ({
  resolveCompanyFormPrincipal: async () => ({ kind: "office", roleId: f.actor.roleId, userId: 42, roleType: "Office" }),
}));
vi.mock("../../server/v2/company-forms/operationalPermissions", () => ({
  assertCompanyFormPermission: async () => { if (!f.formPermission) throw Error("Denied"); },
}));
vi.mock("../../server/v2/company-forms/stageEventRepository", () => ({
  stageStatus: async () => ({ stages: [{ stage_key: "before_joining", outcome: f.stage, event_uuid: "stage-event" }] }),
}));
vi.mock("../../server/v2/admin/services/accessControlManagement", () => ({
  authenticatedActor: async () => f.actor, appendAudit: (...args: any[]) => f.audit(...args),
}));
vi.mock("../../server/v2/shared/training-compliance/authority", () => ({
  trainingOverrideAllowed: async () => f.trainingPermission,
}));
vi.mock("../../server/v2/shared/training-compliance/checklistEvidence", () => ({
  trainingChecklistEvidence: async () => f.training,
  recordTrainingAcceptance: (...args: any[]) => f.record(...args),
}));
import { verifyChecklistYes } from "../../server/v2/company-forms/checklistGate";
const planning = { planUuid: "plan", relieverAssignUuid: "assignment", relieverCrewUuid: "crew", vesselUuid: "vessel" };
const dialect = new PgDialect();
const tx = { execute: vi.fn(async (query: any) => {
  const text = dialect.sqlToQuery(query).sql;
  if (text.includes("FROM crew_assignments")) return { rows: [{ assign_uuid: "assignment", crew_uuid: "crew",
    vessel_uuid: "vessel", assignment_type: "Planned", is_deleted: false }] };
  if (text.includes("FROM frm_requirements")) return { rows: f.requirements };
  return { rows: [] };
}) };
const run = (body: any = {}) => verifyChecklistYes(tx, planning, { body, user: { id: 42 } } as any);
const form = (status: string) => ({ requirement_uuid: "requirement", status, form_name: "Joining Declaration", unresolved_reason: "first_ever" });
beforeEach(() => {
  f.formPermission = false; f.trainingPermission = false; f.requirements = []; f.stage = "COMPLETED";
  f.training = { check: { calculationVersion: "1.2.0", contractRankUuid: "rank", joiningDate: "2026-10-01",
    contractEnd: "2027-04-01", courses: [] }, blockers: [
    { kind: "training", status: "Not held", courseName: "Fire fighting", reason: "Not held." }], warnings: [] };
  f.audit.mockReset().mockResolvedValue(undefined);
  f.record.mockReset().mockResolvedValue({ snapshotUuid: "snapshot", fingerprint: "hash" });
  tx.execute.mockClear();
});
describe("combined forms and training acceptance gate", () => {
  it("names both blockers together and identifies noninterchangeable overrides", async () => {
    f.requirements = [form("OUTSTANDING")];
    await expect(run()).rejects.toMatchObject({ message: expect.stringMatching(/Joining Declaration.*must be completed.*Fire fighting/s),
      canOverride: false, canOverrideTraining: false, blockers: expect.arrayContaining([
        expect.objectContaining({ kind: "training" }), expect.objectContaining({ kind: "requirement" })]) });
    expect(f.record).not.toHaveBeenCalled();
  });
  it("Override checklist never overrides a training gap", async () => {
    f.formPermission = true; f.requirements = [form("UNRESOLVED")];
    await expect(run({ checklistOverride: { reason: "Missing history verified" } })).rejects.toThrow("Fire fighting");
  });
  it("training override is refused without the new permission even with a reason", async () => {
    await expect(run({ trainingOverride: { reason: "Verified exception" } })).rejects.toThrow("do not have Override training compliance");
    expect(f.audit).not.toHaveBeenCalled();
  });
  it.each(["OUTSTANDING", "STARTED"])("training override never bypasses %s mandatory forms", async status => {
    f.trainingPermission = true; f.requirements = [form(status)];
    await expect(run({ trainingOverride: { reason: "Training only" } })).rejects.toThrow("must be completed");
    expect(f.audit).not.toHaveBeenCalled();
  });
  it("authorized training-only override records server actor and overridden results", async () => {
    f.trainingPermission = true;
    await expect(run({ trainingOverride: { reason: "Accept training gap for fixture review" } })).resolves.toMatchObject({ snapshotUuid: "snapshot" });
    expect(f.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ masterUserId: 42, roleId: "trusted-role" }),
      "training_override", "trusted-role", "training_compliance", "override", null, true,
      expect.objectContaining({ reason: "Accept training gap for fixture review", blockers: f.training.blockers, results: f.training.check }));
    expect(f.record).toHaveBeenCalledWith(tx, "plan", "assignment", f.actor,
      expect.objectContaining({ overrides: { training: { reason: "Accept training gap for fixture review", results: f.training.blockers },
        companyForms: null } }));
  });
  it("requires two independent grants and reasons for unresolved forms plus training", async () => {
    f.requirements = [form("UNRESOLVED")]; f.formPermission = true; f.trainingPermission = true;
    await expect(run({ trainingOverride: { reason: "Training exception" } })).rejects.toThrow("Joining Declaration");
    await expect(run({ trainingOverride: { reason: "Training exception" }, checklistOverride: { reason: "Unresolved facts verified" } }))
      .resolves.toHaveProperty("snapshotUuid");
    expect(f.audit.mock.calls.map(c => c[2])).toEqual(["training_override", "checklist_override"]);
  });
  it.each([{ reason: "" }, { reason: " " }, { reason: "Okay", actorId: 999 }])("refuses invalid or forged override object %j", async trainingOverride => {
    f.trainingPermission = true;
    await expect(run({ trainingOverride })).rejects.toThrow("reason");
    expect(f.record).not.toHaveBeenCalled();
  });
  it("rejects browser audit identity", async () => {
    await expect(run({ actorId: 999 })).rejects.toThrow("Audit identity");
    expect(f.record).not.toHaveBeenCalled();
  });
  it("warning proceeds normally and creates fresh snapshots on later acceptances", async () => {
    f.training.blockers = []; f.training.warnings = ["Fire fighting: Expires during contract."];
    for (let i = 0; i < 2; i++) await expect(run()).resolves.toMatchObject({ warnings: f.training.warnings });
    expect(f.record).toHaveBeenCalledTimes(2);
    expect(f.audit).not.toHaveBeenCalled();
  });
  it("an incomplete calculation blocks and can only use the training override", async () => {
    f.training.blockers = [{ kind: "training", status: "INCOMPLETE", reason: "Contract rank was not recorded at Deploy." }];
    await expect(run()).rejects.toThrow("Contract rank");
    f.trainingPermission = true;
    await expect(run({ trainingOverride: { reason: "Recorded missing contract context" } })).resolves.toHaveProperty("snapshotUuid");
  });
});
