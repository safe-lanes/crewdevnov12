// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { getTableName } from "drizzle-orm";
import { generateTemplate } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook, strictDate, decodeFile } from "../../server/v2/recruitment/import/parser";
import { BLOCKS, VERSION, cellLocation, labelLocation, type Catalogs, type Parsed } from "../../server/v2/recruitment/import/contract";
import { FORM_SHEET, FORM_LAST_ROW, LOOKUP_START_COLUMN } from "../../server/v2/recruitment/import/formLayout";
import { candidateFingerprint, persistCandidate, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import { authorizeImport } from "../../server/v2/recruitment/import/access";
import { accessControlService } from "../../server/v2/admin/services/accessControlService";
import { FORM_COLORS } from "../../server/v2/recruitment/import/workbookStyle";
import { isRequiredLabel } from "../../server/v2/recruitment/import/requirements";

const dbMock = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => dbMock.db }));
vi.mock("../../server/v2/admin/services/accessControlService", () => ({
  accessControlService: { getMyPermissions: vi.fn(async () => ({ permissions: [{ menuName: "In Progress", canview: true, cancreate: true }] })) },
}));
const catalogs: Catalogs = {
  countries: [{ label: "India", value: "country-uuid" }],
  visaCountries: [{ label: "India", value: "country-uuid" }],
  nationalities: [{ label: "Indian", value: "nat-uuid" }],
  languages: [{ label: "Hindi", value: "lang-uuid" }],
  ranks: [{ label: "Master", value: "Master" }],
  agents: [{ label: "Agency One", value: "Agency One" }],
  vesselTypes: [{ label: "Bulk Carrier", value: "vt-uuid" }, { label: "Oil Tanker", value: "oil-uuid" }],
};
let template: Buffer;
beforeEach(async () => { template = await generateTemplate(catalogs); });
async function parse(entries: Record<string, Record<string, unknown>[]>) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(template as any);
  for (const [entity, rows] of Object.entries(entries)) {
    const block = BLOCKS.find(b => b.entity === entity)!;
    if (entity === "vesselTypes") {
      book.getWorksheet(block.sheet)!.getCell(cellLocation(block, 0, 0)).value =
        rows.map(record => record.vesselTypeUuid).filter(value => value !== undefined).join("; ");
      continue;
    }
    rows.forEach((record, row) => Object.entries(record).forEach(([key, value]) => {
      const field = block.fields.findIndex(f => f.key === key);
      book.getWorksheet(block.sheet)!.getCell(cellLocation(block, field, row)).value = value as any;
    }));
  }
  return parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
}
const core = { firstName: "Import", familyName: "Test", dob: "1990-01-01" };
function fakeTransaction(failTable?: string, matches: any[] = []) {
  const saved: { table: string; values: any }[] = [];
  const tx: any = {
    execute: vi.fn(async () => {}),
    select: vi.fn(() => {
      const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain, limit: async () => matches, then: (resolve: any) => resolve([{ maxNum: 17 }]) };
      return chain;
    }),
    insert: (table: any) => ({ values: async (values: any) => {
      const name = getTableName(table);
      if (name === failTable) throw new Error("Simulated failure");
      saved.push({ table: name, values });
    } }),
  };
  const db = { transaction: async (fn: any) => {
    const before = saved.length;
    try { return await fn(tx); } catch (error) { saved.splice(before); throw error; }
  } };
  return { tx, db, saved };
}

describe("Recruitment A1-A5 workbook", () => {
  it("blank workbook fails only first name; optional sections have no records", async () => {
    const parsed = await parseWorkbook(template, catalogs);
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toHaveLength(1);
    expect(Object.values(parsed.data).flat()).toEqual([]);
  });
  it("first name only is valid and saves only candidate as Applied", async () => {
    const parsed = await parse({ candidate: [{ firstName: "Import" }], address: [{ email: "   " }] });
    expect(parsed.isValid).toBe(true);
    const fake = fakeTransaction();
    dbMock.db = fake.db;
    await persistCandidate(parsed, "actor-uuid");
    expect(fake.saved).toHaveLength(1);
    expect(fake.saved[0].values).toMatchObject({ firstName: "Import", status: "Applied", createdByUuid: "actor-uuid", updatedByUuid: "actor-uuid" });
    expect(fake.saved[0].values).not.toHaveProperty("email");
    expect(fake.saved[0].values.fileNo).toBe(`R-${new Date().getFullYear()}-0018`);
    expect(fake.saved[0].values.screeningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("retains meaningful zero and false, not whitespace", async () => {
    const parsed = await parse({ candidate: [core], family: [{ numDependentChildren: 0 }], additional: [{ information: "Consent", response: false }] });
    expect(parsed.isValid).toBe(true);
    expect(parsed.data.family[0].numDependentChildren).toBe("0");
    expect(parsed.data.additional[0].response).toBe("false");
  });
  it("saves multiple vessel relationships in order and Married with required spouse names only", async () => {
    const parsed = await parse({
      candidate: [{ firstName: "Import" }], family: [{ maritalStatus: "Married", spouseFirstName: "Partner", spouseFamilyName: "Test" }],
      vesselTypes: [{ vesselTypeUuid: "Bulk Carrier" }, { vesselTypeUuid: "Oil Tanker" }],
    });
    expect(parsed.errors).toEqual([]);
    const fake = fakeTransaction();
    dbMock.db = fake.db;
    const uuid = await persistCandidate(parsed, "actor-uuid");
    const family = fake.saved.find(saved => saved.table === "cand_family_info")!;
    expect(family.values).toMatchObject({ maritalStatus: "Married", recCanUuid: uuid });
    expect(family.values).toMatchObject({ spouseFirstName: "Partner", spouseFamilyName: "Test" });
    expect(family.values).not.toHaveProperty("spouseDob");
    const vessels = fake.saved.filter(saved => saved.table === "cand_vessel_types_applied");
    expect(vessels.map(saved => [saved.values.vesselTypeUuid, saved.values.sortOrder])).toEqual([["vt-uuid", 0], ["oil-uuid", 1]]);
    expect(vessels.every(saved => saved.values.recCanUuid === uuid)).toBe(true);
    expect(fake.saved[0].values).toMatchObject({ status: "Applied", fileNo: `R-${new Date().getFullYear()}-0018` });
    expect(fake.saved[0].values.screeningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("reports partially populated rows instead of dropping them", async () => {
    const parsed = await parse({ candidate: [core], documents: [{ number: "00123" }], sea: [{ ownerOperator: "Example" }], education: [{ institution: "School" }] });
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors.some(e => e.sheet === FORM_SHEET && e.cell === "A48")).toBe(true);
    expect(parsed.errors.some(e => e.field === "Qualifications" && e.cell === "A79")).toBe(true);
    expect(parsed.data.documents).toHaveLength(1);
  });
  it("resolves labels to UUIDs and preserves leading-zero text", async () => {
    const parsed = await parse({ candidate: [{ ...core, nationalityUuid: " indian " }], address: [{ countryOfResidenceUuid: "India", mobile: "001234567" }], vesselTypes: [{ vesselTypeUuid: "Bulk Carrier" }] });
    expect(parsed.isValid).toBe(true);
    expect(parsed.data.candidate[0].nationalityUuid).toBe("nat-uuid");
    expect(parsed.data.address[0].mobile).toBe("001234567");
  });
  it("rejects unknown masters and does not accept arbitrary UUIDs", async () => {
    const parsed = await parse({ candidate: [{ ...core, nationalityUuid: "00000000-0000-4000-8000-000000000000" }] });
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors[0].message).toContain("Unknown");
  });
  it("rejects ambiguous catalog labels", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    book.getWorksheet(FORM_SHEET)!.getCell("F8").value = "Import";
    book.getWorksheet(FORM_SHEET)!.getCell("F11").value = "Indian";
    const parsed = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), { ...catalogs, nationalities: [...catalogs.nationalities, { label: "Indian", value: "another-uuid" }] });
    expect(parsed.errors.some(e => e.message.includes("Ambiguous"))).toBe(true);
  });
  it("rejects invalid dates, future dates, and underage crew", async () => {
    expect(strictDate("2026-02-31")).toBeUndefined();
    expect(strictDate("29-Feb-2024")).toBe("2024-02-29");
    expect(strictDate("29-Feb-2025")).toBeUndefined();
    const parsed = await parse({ candidate: [{ ...core, dob: "2020-01-01" }], documents: [{ documentName: "Passport", issued: "2024-01-01", expiry: "2023-01-01" }] });
    expect(parsed.errors.some(e => e.message.includes("18"))).toBe(true);
    expect(parsed.errors.some(e => e.message.includes("earlier"))).toBe(true);
  });
  it("rejects overlapping sea service and duplicate applied vessel types", async () => {
    const row = { vesselName: "Test Ship", vesselTypeUuid: "Bulk Carrier", rank: "Master", fromDate: "2021-01-01", toDate: "2021-04-01" };
    const parsed = await parse({ candidate: [core], sea: [row, { ...row, fromDate: "2021-03-01" }], vesselTypes: [{ vesselTypeUuid: "Bulk Carrier" }, { vesselTypeUuid: "Bulk Carrier" }] });
    expect(parsed.errors.some(e => e.message.includes("overlap"))).toBe(true);
    expect(parsed.errors.some(e => e.message.includes("Duplicate"))).toBe(true);
  });
  it("rejects formula inputs instead of importing their cached values", async () => {
    const parsed = await parse({ candidate: [core], additional: [{ information: "Formula", response: { formula: "1+1", result: 2 } }] });
    expect(parsed.errors.some(e => e.message.includes("formula"))).toBe(true);
  });
  it("rejects wrong versions and unsupported extra data sheets", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    book.addWorksheet("Second candidate");
    await expect(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).rejects.toThrow("unsupported sheets");
    book.removeWorksheet("Second candidate");
    book.getWorksheet(FORM_SHEET)!.getCell("A1").value = "Old";
    await expect(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).rejects.toThrow("version");
  });
  it("rejects renamed headings and extra rows that would lose data", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    book.getWorksheet(FORM_SHEET)!.getCell("F8").value = "Import";
    book.getWorksheet(FORM_SHEET)!.getCell(`A${FORM_LAST_ROW + 1}`).value = "Extra";
    const parsed = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
    expect(parsed.errors.some(e => e.field === "Outside input area")).toBe(true);
    book.getWorksheet(FORM_SHEET)!.getCell("A8").value = "Changed";
    await expect(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).rejects.toThrow("heading");
  });
  it("rejects legacy and oversized upload data", () => {
    expect(() => decodeFile(template.toString("base64"), "file.xls")).toThrow(".xlsx");
    expect(() => decodeFile("A".repeat(7 * 1024 * 1024), "file.xlsx")).toThrow("5 MB");
    expect(decodeFile(template.toString("base64"), "file.xlsx")).toEqual(template);
  });
  it("generates exactly one reference-style worksheet with same-sheet dropdowns outside printing", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    expect(book.worksheets.map(s => s.name)).toEqual([FORM_SHEET]);
    const sheet = book.worksheets[0];
    expect(sheet.getCell("A1").value).toBe(VERSION);
    expect(sheet.getCell("A2").value).toBe("APPLICATION FOR EMPLOYMENT");
    expect(sheet.getCell("A2").fill).toMatchObject({ fgColor: { argb: FORM_COLORS.title } });
    expect(sheet.getCell("F8").fill).toMatchObject({ fgColor: { argb: "FFFFFFFF" } });
    expect(sheet.pageSetup.printArea).toBe(`A1:AF${FORM_LAST_ROW}`);
    expect(sheet.getColumn(LOOKUP_START_COLUMN).hidden).toBe(true);
    expect(sheet.getCell("F11").dataValidation.formulae?.[0]).toMatch(/^\$[A-Z]+\$2:\$[A-Z]+\$\d+$/);
    expect(sheet.getCell("AC6").value).toContain("Not imported");
    for (const block of BLOCKS) block.fields.forEach((field, j) =>
      expect(sheet.getCell(labelLocation(block, j)).text).toBe(field.label + (isRequiredLabel(block.entity, field.key) ? " *" : "")));
    const locations = BLOCKS.flatMap(block => Array.from({ length: block.rows || 1 }, (_, row) => block.fields.map((_, j) => cellLocation(block, j, row))).flat());
    expect(new Set(locations).size).toBe(locations.length);
  });
  it("parses separated optional tables and horizontal From/To sea rows without treating later sections as overflow", async () => {
    const row = { vesselName: "Ship", vesselTypeUuid: "Bulk Carrier", rank: "Master", fromDate: "2021-01-01", toDate: "2021-02-01" };
    const parsed = await parse({ candidate: [core], children: [{}, {}, { firstName: "Child" }], sea: [{}, row, {}, { ...row, fromDate: "2020-01-01", toDate: "2020-02-01" }], training: [{}, { trainingCourse: "Safety" }], additional: [{}, { information: "Note" }] });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.sea).toHaveLength(2);
    expect(parsed.data.sea[0]).toMatchObject({ fromDate: "2021-01-01", toDate: "2021-02-01", __row: "1" });
    expect(parsed.data.children).toHaveLength(1);
    expect(parsed.data.training).toHaveLength(1);
  });
  it("reports real single-sheet anchors for overlap, duplicate vessels and required first name", async () => {
    const row = { vesselName: "Ship", vesselTypeUuid: "Bulk Carrier", rank: "Master", fromDate: "2021-01-01", toDate: "2021-04-01" };
    const parsed = await parse({ sea: [row, { ...row, fromDate: "2021-03-01" }], vesselTypes: [{ vesselTypeUuid: "Bulk Carrier" }, { vesselTypeUuid: "Bulk Carrier" }] });
    expect(parsed.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sheet: FORM_SHEET, cell: "F8", field: "First name" }),
      expect.objectContaining({ sheet: FORM_SHEET, cell: "AA143", field: "From" }),
      expect.objectContaining({ sheet: FORM_SHEET, cell: "V10", field: "Vessel Type" }),
    ]));
  });
  it("rejects data in gaps or beyond any designated table rather than silently ignoring it", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    const sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell("F8").value = "Import";
    sheet.getCell("A182").value = "Extra sea service";
    sheet.getCell("A200").value = "Extra additional information";
    sheet.getCell("AG5").value = "Unmapped";
    const parsed = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
    expect(parsed.errors.map(e => e.cell).sort()).toEqual(["A182", "A200", "AG5"]);
  });
  it("does not trust edited lookup labels for master resolution", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    const sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell("F8").value = "Import";
    sheet.getCell(2, LOOKUP_START_COLUMN + 1).value = "Forged nationality";
    sheet.getCell("F11").value = "Forged nationality";
    const parsed = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
    expect(parsed.errors.some(e => e.cell === "F11" && e.message.includes("Unknown"))).toBe(true);
  });
  it("rejects old multi-sheet templates and structural changes with a redownload instruction", async () => {
    const old = new ExcelJS.Workbook();
    old.addWorksheet("Instructions").getCell("A1").value = "Recruitment A1-A5 / 1";
    old.addWorksheet("A1 Personal").getCell("D6").value = "Import";
    await expect(parseWorkbook(Buffer.from(await old.xlsx.writeBuffer()), catalogs)).rejects.toThrow("Download");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    book.getWorksheet(FORM_SHEET)!.unMergeCells("F8:P8");
    await expect(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).rejects.toThrow("Modified form layout");
  });
  it("full A1-A5 workbook creates all 14 table groups with one candidate relationship", async () => {
    const parsed = await parse({
      candidate: [core], personal: [{ heightCm: "180" }], address: [{ addressLine1: "Example Street" }],
      family: [{ maritalStatus: "Single" }], nok: [{ firstName: "Next" }], children: [{ firstName: "Child" }],
      vesselTypes: [{ vesselTypeUuid: "Bulk Carrier" }], documents: [{ documentName: "Passport", number: "001234" }],
      visas: [{ countryUuid: "India", visaType: "Work" }], education: [{ qualifications: "Degree" }],
      licenses: [{ certificateDocument: "License" }], training: [{ trainingCourse: "Safety" }],
      sea: [{ vesselName: "Example Vessel", vesselTypeUuid: "Bulk Carrier", rank: "Master", fromDate: "2021-01-01", toDate: "2021-04-01" }],
      additional: [{ information: "Notice", response: "Available" }],
    });
    expect(parsed.errors).toEqual([]);
    const fake = fakeTransaction();
    const uuid = await writeCandidate(fake.tx, parsed, "actor");
    expect(fake.saved).toHaveLength(14);
    for (const saved of fake.saved) expect(saved.values.recCanUuid).toBe(uuid);
    expect(fake.saved.find(s => s.table === "cand_sea_service")?.values.periodMonths).toBe("3.0M");
    expect(fake.saved.find(s => s.table === "cand_personal_details")?.values.ageInYears).toBeDefined();
  });
  it("retry identity ignores blank row position; duplicate match prevents all writes", async () => {
    const parsed = await parse({ candidate: [core], documents: [{}, { documentName: "Passport", number: "0123" }] });
    const other = await parse({ candidate: [core], documents: [{ documentName: "Passport", number: "0123" }] });
    expect(candidateFingerprint(parsed)).toBe(candidateFingerprint(other));
    const fake = fakeTransaction(undefined, [{ id: 1 }]);
    await expect(writeCandidate(fake.tx, parsed, "actor")).rejects.toThrow("already imported");
    expect(fake.saved).toHaveLength(0);
  });
  it("late child failure rolls back all candidate and detail writes", async () => {
    const parsed = await parse({ candidate: [core], family: [{ numDependentChildren: 0 }], additional: [{ information: "Test" }] });
    const fake = fakeTransaction("cand_additional_info");
    dbMock.db = fake.db;
    await expect(persistCandidate(parsed, "actor")).rejects.toThrow("Simulated failure");
    expect(fake.saved).toHaveLength(0);
  });
  it("invalid preview cannot reach transaction", async () => {
    const fake = fakeTransaction();
    dbMock.db = fake.db;
    await expect(persistCandidate(await parse({}), "actor")).rejects.toThrow("invalid workbook");
    expect(fake.tx.execute).not.toHaveBeenCalled();
  });
});
describe("Recruitment import authorization", () => {
  it("uses the signed parent ID and derives audit UUID without an additional JWT claim", async () => {
    const chain: any = { from: () => chain, where: vi.fn(() => chain), limit: async () => [{ id: 9999, userUuid: "verified-user", role: "Administrator" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 9999, domain: "company-one", userType: "Office" }, body: {} } as any)).resolves.toEqual({ auditUuid: "verified-user" });
    expect(accessControlService.getMyPermissions).not.toHaveBeenCalled();
  });
  it("ignores a forged audit identity without rejecting the matched user", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "verified-user", role: "Administrator" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 1, userType: "Office", userUuid: "verified-user" }, body: { auditUserUuid: "someone-else" } } as any)).resolves.toEqual({ auditUuid: "verified-user" });
  });
  it("allows a matched user without In Progress create permission", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "verified-user", role: "Viewer" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 1, userType: "Office" }, body: {} } as any)).resolves.toEqual({ auditUuid: "verified-user" });
    expect(accessControlService.getMyPermissions).not.toHaveBeenCalled();
  });
  it("does not resolve or restrict agency scope for a matched Manning Agent", async () => {
    const userChain: any = { from: () => userChain, where: () => userChain, limit: async () => [{ userUuid: "agent-user", role: "Manning Agent" }] };
    dbMock.db = { select: vi.fn().mockReturnValue(userChain) };
    await expect(authorizeImport({ user: { id: 1, userType: "Manning Agent", manningAgent: "own-id" }, body: { manningAgent: "Other Agency" } } as any)).resolves.toEqual({ auditUuid: "agent-user" });
    expect(dbMock.db.select).toHaveBeenCalledTimes(1);
  });
  it("ignores an optional signed UUID and uses the parent ID lookup", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "verified-user", role: "Administrator" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 1, userType: "Office", userUuid: "another-user" } } as any)).resolves.toEqual({ auditUuid: "verified-user" });
  });
  it("allows matched vessel users", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "verified-user", userType: "Ship" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 1, userType: "Ship" } } as any)).resolves.toEqual({ auditUuid: "verified-user" });
  });
  it("allows a matched Manning Agent without any signed agency claim", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "user-uuid", role: "Manning Agent" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 1, userType: "Manning Agent" }, body: {} } as any)).resolves.toEqual({ auditUuid: "user-uuid" });
  });
  it("saves null audit attribution when the matched master user has no UUID", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ id: 1, userUuid: null }] };
    dbMock.db = { select: () => chain };
    const actor = await authorizeImport({ user: { id: 1 }, body: { auditUserUuid: "forged" } } as any);
    const parsed = await parse({ candidate: [{ firstName: "Import" }] });
    const fake = fakeTransaction();
    await writeCandidate(fake.tx, parsed, actor.auditUuid);
    expect(fake.saved[0].values).toMatchObject({ createdByUuid: null, updatedByUuid: null, status: "Applied" });
  });
});
