import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));
import { authorizeInterviewRead, InterviewError, isMandatoryInterviewAnswerPresent, serializeInterviewFormParts, serializeInterviewStructure } from "@server/v2/interviews/service";
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
});