import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import { createCrewAssignmentSubject } from "@server/v2/company-forms/subjects/crewAssignmentSubject";
import { CompanyFormSubjectRegistry } from "@server/v2/company-forms/subjectRegistry";
import { CompanyFormSubmissionsService } from "@server/v2/company-forms/submissionsService";
import { CompanyFormPermissionError } from "@server/v2/company-forms/errors";

const subjects = [
  { assignUuid: "a", crewUuid: "crew", vesselUuid: "v1", vesselName: "Vessel One", contractRankLabel: "Pumpman", assignmentType: "OnBoard", isCurrent: true, isDeleted: false, signOnDate: "2026-10-03", signOffDate: null },
  { assignUuid: "cancelled", crewUuid: "crew", vesselUuid: "v2", vesselName: "Vessel Two", assignmentType: "Cancelled", isCurrent: false, isDeleted: false, signOnDate: null, signOffDate: null },
  { assignUuid: "deleted", crewUuid: "crew", vesselUuid: "v1", assignmentType: "OnBoard", isCurrent: false, isDeleted: true, signOnDate: null, signOffDate: null },
  { assignUuid: "deleted-empty", crewUuid: "crew", vesselUuid: "v1", assignmentType: "Planned", isCurrent: false, isDeleted: true, signOnDate: null, signOffDate: null },
];
const rows = [
  { submissionUuid: "before", subjectRef: "a", stageKey: "before_joining", status: "completed" },
  { submissionUuid: "onboard", subjectRef: "a", stageKey: "on_board", status: "in_progress" },
  { submissionUuid: "signoff", subjectRef: "a", stageKey: "at_sign_off", status: "voided" },
  { submissionUuid: "cancelled-form", subjectRef: "cancelled", stageKey: "on_board", status: "in_progress" },
  { submissionUuid: "deleted-form", subjectRef: "deleted", stageKey: "before_joining", status: "completed" },
];
function setup(principal: any) {
  const adapter = createCrewAssignmentSubject({ authorizeOffice: async () => true,
    principalDependencies: { hasPermission: async () => true } });
  adapter.loadHomeSubjects = async () => subjects.map(context => ({ subjectRef: context.assignUuid, context }));
  const repository = { listForSubjects: vi.fn(async (_type, refs) => rows.filter(row => refs.includes(row.subjectRef))) };
  const service = new CompanyFormSubmissionsService({}, new CompanyFormSubjectRegistry([adapter]), repository as any);
  vi.spyOn(service as any, "resolvePrincipal").mockResolvedValue(principal);
  return { service, repository };
}
const office = { kind: "office", userId: 1, roleId: "office", roleName: "Crewing", roleType: "Office" };
const request = {} as Request;
describe("existing submission home enriches rather than filters complete history", () => {
  it("retains every stage/status, cancelled history, empty active groups and submitted deleted subjects", async () => {
    const { service } = setup(office);
    const result = await service.listForHome({ req: request, subjectType: "crew_assignment", homeRef: "crew" });
    expect(result.totalCount).toBe(5);
    expect(result.groups.map(g => g.subjectRef)).toEqual(["a", "cancelled", "deleted"]);
    expect(result.groups[0].submissions.map(s => s.stageKey)).toEqual(["before_joining", "on_board", "at_sign_off"]);
    expect(result.groups[1].outstandingCount).toBe(0);
    expect(result.groups[1].submissions[0].canEdit).toBe(false);
    expect(result.groups[0].display?.fields[0].value).toBe("03-Oct-2026");
    expect(result.groups[2].display?.historyOnly).toBe(true);
    expect(result.groups[0].display?.fields.find(f => f.label === "Contract rank")?.value).toBe("Pumpman");
  });
  it("limits vessel groups to trusted membership instead of unioning all profile assignments", async () => {
    const { service, repository } = setup({ kind: "vessel", userId: 1, roleId: "ship", roleName: "Master", roleType: "Ship", vesselUuids: ["v1"] });
    const result = await service.listForHome({ req: request, subjectType: "crew_assignment", homeRef: "crew" });
    expect(result.groups.some(g => g.subjectRef === "cancelled")).toBe(false);
    expect(repository.listForSubjects.mock.calls[0][1]).not.toContain("cancelled");
  });
  it.each([
    { kind: "vessel", userId: 1, roleId: "ship", roleName: "Master", roleType: "Ship", vesselUuids: [] },
    { kind: "vessel", userId: 1, roleId: "ship", roleName: "Master", roleType: "Ship", vesselUuids: ["wrong"] },
    { kind: "seafarer", userId: 1, crewUuid: "another-crew", linkageSource: "trusted_server_resolver" },
  ])("refuses an unrelated/unprovisioned actor before listing", async principal => {
    const { service, repository } = setup(principal);
    await expect(service.listForHome({ req: request, subjectType: "crew_assignment", homeRef: "crew" })).rejects.toBeInstanceOf(CompanyFormPermissionError);
    expect(repository.listForSubjects).not.toHaveBeenCalled();
  });
});