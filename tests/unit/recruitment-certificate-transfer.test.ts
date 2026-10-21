// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { crewTransferService } from "../../server/v2/crew-pool/services/crewTransferService";
import { cleanRecord } from "../../server/v2/recruitment/import/persistence";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { FORM_SHEET } from "../../server/v2/recruitment/import/formLayout";

const state = vi.hoisted(() => ({ db: null as any, licenses: [] as any[], training: [] as any[], documents: [] as any[], visas: [] as any[], education: [] as any[], personal: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
vi.mock("../../server/v2/crew-pool/repositories", () => ({
  CrewMembersRepository: class { async findByEmpNo() { return undefined; } },
}));
vi.mock("../../server/v2/recruitment/repositories/candidateRepository", () => ({
  candidateRepository: { findByUuid: async () => ({ firstName: "Import", status: "Recruited" }) },
  vesselTypesAppliedRepository: { findByCandidateUuid: async () => [] },
}));
vi.mock("../../server/v2/recruitment/repositories/approvalsRepository", () => ({
  recruitmentDecisionRepository: { findByCandidateUuid: async () => null },
}));
vi.mock("../../server/v2/recruitment/repositories/profileRepository", () => ({
  personalDetailsRepository: { findByCandidateUuid: async () => state.personal },
  addressRepository: { findByCandidateUuid: async () => null },
  familyInfoRepository: { findByCandidateUuid: async () => null },
  childrenRepository: { findByCandidateUuid: async () => [] },
  nextOfKinRepository: { findByCandidateUuid: async () => null },
}));
vi.mock("../../server/v2/recruitment/repositories/documentsRepository", () => ({
  documentsRepository: { findByCandidateUuid: async () => state.documents },
  documentAttachmentsRepository: { findByDocUuid: async () => [] },
  visasRepository: { findByCandidateUuid: async () => state.visas },
  visaAttachmentsRepository: { findByVisaUuid: async () => [] },
  educationRepository: { findByCandidateUuid: async () => state.education },
  educationAttachmentsRepository: { findByEduUuid: async () => [] },
  licensesRepository: { findByCandidateUuid: async () => state.licenses },
  licenseAttachmentsRepository: { findByLicUuid: async () => [] },
  trainingCoursesRepository: { findByCandidateUuid: async () => state.training },
  trainingAttachmentsRepository: { findByTrainUuid: async () => [] },
  seaServiceRepository: { findByCandidateUuid: async () => [] },
  seaServiceAttachmentsRepository: { findBySeaUuid: async () => [] },
}));

describe("Imported certificate links through Recruitment → Crew Pool", () => {
  it("transfers parsed business references and manual rows without synthesizing codes or altering entered details", async () => {
    const catalogs = {
      visaCountries: [{ label: "India", value: "country-uuid" }, { label: "Schengen", value: "Schengen" }],
      travelDocuments: [{ label: "Passport", value: "DOC001" }],
      licenses: [{ label: "Chief Engineer", value: "LIC007", abbr: "CE", requirement: "License default" }],
      training: [{ label: "Company Safety Induction", value: "SAF029", abbr: "CSI", requirement: "Company default" }],
    };
    const book = createTemplateWorkbook(catalogs), sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell("F8").value = "Import";
    sheet.getCell("V15").value = "French, Spanish";
    sheet.getCell("A48").value = "Passport [DB:DOC001]";
    sheet.getCell("I48").value = "00123";
    sheet.getCell("A49").value = "Custom Port Pass";
    sheet.getCell("A90").value = "Chief Engineer [DB:LIC007]";
    sheet.getCell("P90").value = "0007";
    sheet.getCell("A91").value = "Custom Port License";
    sheet.getCell("H91").value = "CPL";
    sheet.getCell("A108").value = "Company Safety Induction [DB:SAF029]";
    sheet.getCell("L108").value = "User requirement";
    sheet.getCell("A109").value = "Custom Workshop";
    sheet.getCell("A66").value = "India";
    sheet.getCell("Y66").value = "Work";
    sheet.getCell("A67").value = "Schengen";
    sheet.getCell("Y67").value = "Tourist";
    sheet.getCell("A79").value = "Degree";
    sheet.getCell("I79").value = "Engineering";
    sheet.getCell("Q79").value = "Maritime College";
    sheet.getCell("Y79").value = "2010-01-01";
    const parsed = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
    expect(parsed.errors).toEqual([]);
    state.personal = cleanRecord(parsed.data.personal[0]);
    state.documents = parsed.data.documents.map((row, i) => ({ ...cleanRecord(row), docUuid: `doc-${i}`, sortOrder: Number(row.__row) }));
    state.visas = parsed.data.visas.map((row, i) => ({ ...cleanRecord(row), visaUuid: `visa-${i}`, sortOrder: Number(row.__row) }));
    state.education = parsed.data.education.map((row, i) => ({ ...cleanRecord(row), eduUuid: `edu-${i}`, sortOrder: Number(row.__row) }));
    state.licenses = parsed.data.licenses.map((row, i) => ({ ...cleanRecord(row), licUuid: `lic-${i}`, sortOrder: Number(row.__row) }));
    state.training = parsed.data.training.map((row, i) => ({ ...cleanRecord(row), trainUuid: `train-${i}`, sortOrder: Number(row.__row) }));
    const saved: { table: string; values: any }[] = [];
    const tx = { insert: (table: any) => ({ values: async (values: any) => { saved.push({ table: getTableName(table), values }); } }) };
    state.db = {
      select: () => { const chain: any = { from: () => chain, where: async () => [] }; return chain; },
      transaction: async (callback: any) => callback(tx),
    };
    const result = await crewTransferService.transferFromRecruitment("candidate", { empNo: "A000999", auditUserUuid: "actor" });
    expect(result.counts).toMatchObject({ licenses: 2, trainingCourses: 2 });
    const licenses = saved.filter(row => row.table === "crew_licenses").map(row => row.values);
    const training = saved.filter(row => row.table === "crew_training_courses").map(row => row.values);
    const documents = saved.filter(row => row.table === "crew_documents").map(row => row.values);
    expect(saved.find(row => row.table === "crew_personal_details")!.values.foreignLanguages).toBe("French, Spanish");
    const visas = saved.filter(row => row.table === "crew_visas").map(row => row.values);
    expect(visas.map(row => [row.countryUuid, row.country])).toEqual([["country-uuid", "country-uuid"], ["Schengen", "Schengen"]]);
    expect(saved.find(row => row.table === "crew_education")!.values).toMatchObject({
      qualifications: "Degree", subjectsField: "Engineering", institution: "Maritime College", dateOfCompletion: "2010-01-01",
    });
    expect(documents).toHaveLength(2);
    expect(documents[0]).toMatchObject({ documentId: "DOC001", documentName: "Passport", number: "00123", crewUuid: result.crewUuid });
    expect(documents[1].documentName).toBe("Custom Port Pass");
    expect(documents[1].documentId).toBeUndefined();
    expect(licenses).toHaveLength(2);
    expect(training).toHaveLength(2);
    expect(licenses[0]).toMatchObject({ licenseId: "LIC007", certificateDocument: "Chief Engineer", abbr: "CE", requirement: "License default", certificateNo: "0007", crewUuid: result.crewUuid });
    expect(licenses[1]).toMatchObject({ licenseId: null, certificateDocument: "Custom Port License", abbr: "CPL" });
    expect(training[0]).toMatchObject({ courseId: "SAF029", trainingCourse: "Company Safety Induction", abbr: "CSI", requirement: "User requirement" });
    expect(training[1]).toMatchObject({ courseId: null, trainingCourse: "Custom Workshop" });
    expect(training[1].abbr).toBeUndefined();
    expect(training[0].expiry).toBeUndefined();
  });
});
