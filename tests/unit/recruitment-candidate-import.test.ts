// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { getTableName } from "drizzle-orm";
import { generateTemplate } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook, strictDate, decodeFile } from "../../server/v2/recruitment/import/parser";
import { BLOCKS, cellLocation, type Catalogs, type Parsed } from "../../server/v2/recruitment/import/contract";
import { candidateFingerprint, persistCandidate, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import { authorizeImport } from "../../server/v2/recruitment/import/access";
import { accessControlService } from "../../server/v2/admin/services/accessControlService";

const dbMock = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => dbMock.db }));
vi.mock("../../server/v2/admin/services/accessControlService", () => ({
  accessControlService: { getMyPermissions: vi.fn(async () => ({ permissions: [{ menuName: "In Progress", canview: true, cancreate: true }] })) },
}));
const catalogs: Catalogs = {
  countries: [{ label: "India", value: "country-uuid" }],
  nationalities: [{ label: "Indian", value: "nat-uuid" }],
  languages: [{ label: "Hindi", value: "lang-uuid" }],
  ranks: [{ label: "Master", value: "Master" }],
  agents: [{ label: "Agency One", value: "Agency One" }],
  vesselTypes: [{ label: "Bulk Carrier", value: "vt-uuid" }],
};
let template: Buffer;
beforeEach(async () => { template = await generateTemplate(catalogs); });
async function parse(entries: Record<string, Record<string, unknown>[]>) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(template as any);
  for (const [entity, rows] of Object.entries(entries)) {
    const block = BLOCKS.find(b => b.entity === entity)!;
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
      const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain, limit: async () => matches };
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
    expect(fake.saved[0].values).not.toHaveProperty("fileNo");
    expect(fake.saved[0].values).not.toHaveProperty("screeningDate");
  });
  it("retains meaningful zero and false, not whitespace", async () => {
    const parsed = await parse({ candidate: [core], family: [{ numDependentChildren: 0 }], additional: [{ information: "Consent", response: false }] });
    expect(parsed.isValid).toBe(true);
    expect(parsed.data.family[0].numDependentChildren).toBe("0");
    expect(parsed.data.additional[0].response).toBe("false");
  });
  it("reports partially populated rows instead of dropping them", async () => {
    const parsed = await parse({ candidate: [core], documents: [{ number: "00123" }], sea: [{ ownerOperator: "Example" }], education: [{ institution: "School" }] });
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors.some(e => e.sheet === "A2 Documents" && e.cell === "A6")).toBe(true);
    expect(parsed.errors.some(e => e.sheet === "A3 Education")).toBe(true);
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
    book.getWorksheet("A1 Personal")!.getCell("D6").value = "Import";
    book.getWorksheet("A1 Personal")!.getCell("D11").value = "Indian";
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
    book.getWorksheet("Instructions")!.getCell("A1").value = "Old";
    await expect(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).rejects.toThrow("version");
  });
  it("rejects renamed headings and extra rows that would lose data", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as any);
    book.getWorksheet("A1 Personal")!.getCell("D6").value = "Import";
    book.getWorksheet("A1 Children")!.getCell("A14").value = "Extra";
    const parsed = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
    expect(parsed.errors.some(e => e.field === "Outside input area")).toBe(true);
    book.getWorksheet("A1 Personal")!.getCell("A6").value = "Changed";
    await expect(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).rejects.toThrow("heading");
  });
  it("rejects legacy and oversized upload data", () => {
    expect(() => decodeFile(template.toString("base64"), "file.xls")).toThrow(".xlsx");
    expect(() => decodeFile("A".repeat(7 * 1024 * 1024), "file.xlsx")).toThrow("5 MB");
    expect(decodeFile(template.toString("base64"), "file.xlsx")).toEqual(template);
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
  it("uses verified UUID rather than numeric ID and stamps the matching actor", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "verified-user", role: "Administrator" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 9999, userType: "Office", userUuid: "verified-user" }, body: { auditUserUuid: "verified-user" } } as any)).resolves.toEqual({ auditUuid: "verified-user", manningAgent: null });
  });
  it("rejects forged audit identity", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "verified-user", role: "Administrator" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 1, userType: "Office", userUuid: "verified-user" }, body: { auditUserUuid: "someone-else" } } as any)).rejects.toThrow("does not match");
  });
  it("rejects a role without In Progress create permission", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "verified-user", role: "Viewer" }] };
    dbMock.db = { select: () => chain };
    vi.mocked(accessControlService.getMyPermissions).mockResolvedValueOnce({ permissions: [{ menuName: "In Progress", canview: true, cancreate: false }] } as any);
    await expect(authorizeImport({ user: { id: 1, userType: "Office", userUuid: "verified-user" }, body: {} } as any)).rejects.toThrow("create access");
  });
  it("derives the agency from a verified claim and excludes other agencies", async () => {
    const userChain: any = { from: () => userChain, where: () => userChain, limit: async () => [{ userUuid: "agent-user", role: "Manning Agent" }] };
    const agentChain: any = { from: () => agentChain, where: async () => [{ id: "own-id", name: "Agency One" }, { id: "other-id", name: "Other Agency" }] };
    dbMock.db = { select: vi.fn().mockReturnValueOnce(userChain).mockReturnValueOnce(agentChain) };
    await expect(authorizeImport({ user: { id: 1, userType: "Manning Agent", userUuid: "agent-user", manningAgent: "own-id" }, body: { manningAgent: "Other Agency" } } as any)).resolves.toEqual({ auditUuid: "agent-user", manningAgent: "Agency One" });
  });
  it("does not equate local serial ids with parent JWT numeric ids", async () => {
    await expect(authorizeImport({ user: { id: 1, userType: "Office" } } as any)).rejects.toThrow("signed userUuid");
  });
  it("rejects vessel users", async () => {
    await expect(authorizeImport({ user: { id: 1, userType: "Ship" } } as any)).rejects.toThrow("Vessel users");
  });
  it("requires signed agency scope, never editable browser/Excel agency", async () => {
    const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ userUuid: "user-uuid", role: "Manning Agent" }] };
    dbMock.db = { select: () => chain };
    await expect(authorizeImport({ user: { id: 1, userType: "Manning Agent", userUuid: "user-uuid" }, body: { auditUserUuid: "user-uuid", manningAgent: "Agency One" } } as any)).rejects.toThrow("authenticated agency");
  });
});
