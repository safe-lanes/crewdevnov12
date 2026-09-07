import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));
import { authorizeInterviewRead, InterviewError, interviewService, isMandatoryInterviewAnswerPresent, resolveInterviewInterviewerName, serializeInterviewFormParts, serializeInterviewStructure } from "@server/v2/interviews/service";
const request = (userType: string) => ({ user: { id: 42, domain: "tenant", userType } } as Request);
function masterUser(userType: string) { const q:any={from:vi.fn(),where:vi.fn(),limit:vi.fn().mockResolvedValue([{id:42,userType}])}; q.from.mockReturnValue(q); q.where.mockReturnValue(q); getDbMock.mockReturnValue({select:vi.fn().mockReturnValue(q)}); }
describe("Interview office authorization and local helpers", () => {
  beforeEach(() => vi.clearAllMocks());
  it("accepts matching office identities and rejects non-office access", async () => { masterUser("Office"); await expect(authorizeInterviewRead(request("office"))).resolves.toBeUndefined(); masterUser("Ship"); await expect(authorizeInterviewRead(request("Ship"))).rejects.toMatchObject<Partial<InterviewError>>({statusCode:403}); });
  it("fails closed when token and master user differ", async () => { masterUser("Ship"); await expect(authorizeInterviewRead(request("Office"))).rejects.toMatchObject<Partial<InterviewError>>({statusCode:403}); });
  it("keeps checkbox false valid and requires multi-select content", () => { expect(isMandatoryInterviewAnswerPresent("checkbox","false")).toBe(true); expect(isMandatoryInterviewAnswerPresent("multi_select","[]")).toBe(false); expect(isMandatoryInterviewAnswerPresent("multi_select",'["x"]')).toBe(true); });
  it("serializes form parts without Briefing coupling", () => expect(serializeInterviewFormParts([{formPartUuid:"x",partCode:"A",partTitle:"Basic",partType:"fixed",isOfficeOnly:false,sortOrder:1}])).toEqual([{form_part_uuid:"x",part_code:"A",part_title:"Basic",part_type:"fixed",is_office_only:false,sort_order:1}]));
  it("serializes pinned structure using the public snake_case contract", () => {
    const structure = serializeInterviewStructure({ sections:[{sectionUuid:"s",formPartUuid:"p",sectionCode:"B1",sectionTitle:"Interview",applicableVesselTypes:"[\"t\"]",responsibleMode:"role",responsibleRoleUuid:"r",responsibleDepartment:null,commentBoxRequired:true,signatureOfficerRequired:true,signatureSeafarerRequired:false,defaultOptionSetUuid:null,layoutPreference:"auto",sortOrder:2}], questions:[{questionUuid:"q",sectionUuid:"s",questionCode:"Q1",questionText:"Question",responseType:"yes_no",isMandatory:true,commentEnabled:true,optionSetUuid:null,sortOrder:1}], options:[] }, new Map([["r","Master"]]));
    expect(structure.sections[0]).toMatchObject({section_uuid:"s",form_part_uuid:"p",responsible_role_name:"Master",signature_officer_required:true});
    expect(structure.questions[0]).toMatchObject({question_uuid:"q",response_type:"yes_no",is_mandatory:true});
  });
  it("resolves B6 interviewer UUIDs first, supports legacy names, and never displays an unresolved UUID", () => {
    expect(resolveInterviewInterviewerName("interviewer-uuid", [
      { userUuid: "other-uuid", fullname: "interviewer-uuid" },
      { userUuid: "interviewer-uuid", fullname: "Canonical Interviewer" },
    ])).toBe("Canonical Interviewer");
    expect(resolveInterviewInterviewerName("Legacy Interviewer", [
      { userUuid: "interviewer-uuid", displayName: "Legacy Interviewer" },
    ])).toBe("Legacy Interviewer");
    expect(resolveInterviewInterviewerName("unresolved-uuid", [])).toBeNull();
    expect(resolveInterviewInterviewerName("uuid-only-user", [{ userUuid: "uuid-only-user" }])).toBeNull();
  });
  it("derives and returns Part C reviewer audit fields from the authenticated office user", async () => {
    const officeQuery: any = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue([{ id: 42, userType: "office", userUuid: "reviewer-uuid", fullname: "Office Reviewer" }]) };
    officeQuery.from.mockReturnValue(officeQuery); officeQuery.where.mockReturnValue(officeQuery);
    const submissionQuery: any = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue([{ status: "in_progress", isDeleted: false }]) };
    submissionQuery.from.mockReturnValue(submissionQuery); submissionQuery.where.mockReturnValue(submissionQuery);
    const persisted: any[] = [];
    const tx: any = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue(submissionQuery),
      update: vi.fn().mockReturnValue({ set: vi.fn((values) => {
        persisted.push(values);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }) }),
    };
    getDbMock.mockReturnValue({
      select: vi.fn().mockReturnValue(officeQuery),
      transaction: vi.fn(async (callback) => callback(tx)),
    });

    const result = await interviewService.savePartC("submission-uuid", { interviewerComments: "Reviewed" }, request("office"));

    expect(persisted[0]).toMatchObject({
      interviewerComments: "Reviewed",
      officeReviewedByUuid: "reviewer-uuid",
      officeReviewedByName: "Office Reviewer",
    });
    expect(persisted[0].officeReviewedAt).toBeInstanceOf(Date);
    expect(result).toMatchObject({
      interviewer_comments: "Reviewed",
      office_reviewed_by_uuid: "reviewer-uuid",
      office_reviewed_by_name: "Office Reviewer",
    });
    expect(result.office_reviewed_at).toBe(persisted[0].officeReviewedAt);
  });
});