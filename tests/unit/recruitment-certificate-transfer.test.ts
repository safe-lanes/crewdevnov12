// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { crewTransferService } from "../../server/v2/crew-pool/services/crewTransferService";
import { cleanRecord } from "../../server/v2/recruitment/import/persistence";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { FORM_SHEET } from "../../server/v2/recruitment/import/formLayout";

const state = vi.hoisted(() => ({ db: null as any, licenses: [] as any[], training: [] as any[] }));
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
  personalDetailsRepository: { findByCandidateUuid: async () => null },
  addressRepository: { findByCandidateUuid: async () => null },
  familyInfoRepository: { findByCandidateUuid: async () => null },
  childrenRepository: { findByCandidateUuid: async () => [] },
  nextOfKinRepository: { findByCandidateUuid: async () => null },
}));
vi.mock("../../server/v2/recruitment/repositories/documentsRepository", () => ({
  documentsRepository: { findByCandidateUuid: async () => [] },
  documentAttachmentsRepository: { findByDocUuid: async () => [] },
  visasRepository: { findByCandidateUuid: async () => [] },
  visaAttachmentsRepository: { findByVisaUuid: async () => [] },
  educationRepository: { findByCandidateUuid: async () => [] },
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
      licenses: [{ label: "Chief Engineer", value: "LIC007" }],
      training: [{ label: "Company Safety Induction", value: "SAF029" }],
    };
    const book = createTemplateWorkbook(catalogs), sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell("F8").value = "Import";
    sheet.getCell("A163").value = "Chief Engineer [DB:LIC007]";
    sheet.getCell("M163").value = "0007";
    sheet.getCell("A164").value = "Custom Port License";
    sheet.getCell("E164").value = "CPL";
    sheet.getCell("A180").value = "Company Safety Induction [DB:SAF029]";
    sheet.getCell("I180").value = "User requirement";
    sheet.getCell("A181").value = "Custom Workshop";
    const parsed = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
    expect(parsed.errors).toEqual([]);
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
    expect(licenses).toHaveLength(2);
    expect(training).toHaveLength(2);
    expect(licenses[0]).toMatchObject({ licenseId: "LIC007", certificateDocument: "Chief Engineer", certificateNo: "0007", crewUuid: result.crewUuid });
    expect(licenses[1]).toMatchObject({ licenseId: null, certificateDocument: "Custom Port License", abbr: "CPL" });
    expect(training[0]).toMatchObject({ courseId: "SAF029", trainingCourse: "Company Safety Induction", requirement: "User requirement" });
    expect(training[1]).toMatchObject({ courseId: null, trainingCourse: "Custom Workshop" });
    expect(training[0].abbr).toBeUndefined();
    expect(training[0].expiry).toBeUndefined();
  });
});
