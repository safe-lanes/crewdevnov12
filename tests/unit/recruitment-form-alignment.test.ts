// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { getTableName } from "drizzle-orm";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { BLOCKS, VERSION, DOCUMENT_VERSION, ALIGNED_VERSION, PREVIOUS_VERSION, LEGACY_VERSION, usesAlignedLayout, blocksForVersion, cellLocation, type TemplateVersion } from "../../server/v2/recruitment/import/contract";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint, writeCandidate } from "../../server/v2/recruitment/import/persistence";
vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));

const catalogs = {
  countries: [{ label: "India", value: "country" }], nationalities: [], languages: [], agents: [],
  visaCountries: [{ label: "India", value: "country" }],
  ranks: [{ label: "Master", value: "Master" }], vesselTypes: [{ label: "Bulk Carrier", value: "vessel-type" }],
  licenses: [{ label: "Officer License", value: "license-id", abbr: "OL", requirement: "Required" }],
  training: [{ label: "Safety Course", value: "course-id", abbr: "SC", requirement: "Company" }],
};
const service = { vesselName: "Example Ship", vesselTypeUuid: "Bulk Carrier", deadweight: "45000", engineTypePower: "Diesel", ownerOperator: "Company", rank: "Master", fromDate: "2021-01-01", toDate: "2021-04-01" };
function filled(version: TemplateVersion = VERSION) {
  const book = createTemplateWorkbook(catalogs, version);
  const blocks = blocksForVersion(version);
  const set = (entity: string, record: Record<string, string>, row = 0) => {
    const block = blocks.find(block => block.entity === entity)!;
    for (const [key, value] of Object.entries(record)) {
      const field = block.fields.findIndex(field => field.key === key);
      if (field < 0) throw new Error(`Unknown ${entity} field: ${key}`);
      book.worksheets[0].getCell(cellLocation(block, field, row)).value = value;
    }
  };
  set("candidate", { firstName: "Synthetic", familyName: "Candidate", dob: "1990-01-01" });
  return { book, set };
}
const parse = async (book: ExcelJS.Workbook) => parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
function transaction() {
  const saved: { table: string; values: Record<string, unknown> }[] = [];
  const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain,
    limit: async () => [], then: (resolve: any) => resolve([{ maxNum: 17 }]) };
  const tx = { execute: vi.fn(), select: () => chain,
    insert: (table: any) => ({ values: async (values: Record<string, unknown>) => { saved.push({ table: getTableName(table), values }); } }) };
  return { tx, saved };
}

describe("Application-form-aligned Excel revision", () => {
  it("uses the exact ordered subsection titles from the application form", () => {
    const sheet = createTemplateWorkbook(catalogs).worksheets[0];
    const headings: string[] = [];
    sheet.eachRow(row => row.eachCell(cell => {
      if (cell.type !== ExcelJS.ValueType.Merge && typeof cell.value === "string" && /^A[1-5]\.\d /.test(cell.value)) headings.push(cell.value);
    }));
    expect(headings).toEqual([
      "A1.1 General Particulars", "A1.2 Address & Contact Info", "A1.3 Family and NOK",
      "A2.1 Travel & Identification Documents", "A2.2 Visas", "A3.1 Education",
      "A3.2 License & DCE", "A3.3 Training Course", "A4.1 Details of Sea Service",
      "A5.1 Details on Additional Information required",
    ]);
    expect(sheet.getCell("A30").text).toBe("Children Information");
    expect(sheet.getCell("A40").text).toBe("Next Of Kin");
    expect(sheet.getCell("A1").value).toBe(VERSION);
    expect(sheet.pageSetup.printArea).toBe("A1:AF207");
  });
  it("places general/contact/family fields in reading order and keeps vessel types beside Gender", () => {
    const sheet = createTemplateWorkbook(catalogs).worksheets[0];
    expect(["A6", "A8", "Q8", "A9", "A10", "Q10", "A11", "Q11", "A12", "Q12", "A13", "Q13", "A14", "Q14", "A15", "Q15", "A16"].map(cell => sheet.getCell(cell).text)).toEqual([
      "Rank applied for", "First name *", "Middle name", "Family name", "Gender", "Vessel types applied for",
      "Nationality", "Present rank", "Date of birth", "Birth city", "Birth country", "Height (cm)",
      "Weight (kg)", "Native language", "English proficiency", "Foreign languages", "Manning agent",
    ]);
    expect(["A19", "Q19", "A20", "Q20", "A21", "Q21", "A22"].map(cell => sheet.getCell(cell).text))
      .toEqual(["Country of residence", "Nearest airport", "Mobile", "Email", "Address line 1", "Address line 2", "Landline"]);
    expect(["A25", "Q25", "A26", "Q26", "A27", "Q27", "A28", "Q28"].map(cell => sheet.getCell(cell).text))
      .toEqual(["Marital status", "Dependent children", "Father's name", "Mother's name", "Spouse first name", "Spouse middle name", "Spouse family name", "Spouse birth date"]);
  });
  it("orders sea-service columns like the web form and offers IMO as a text input without a required marker", () => {
    const sheet = createTemplateWorkbook(catalogs).worksheets[0];
    expect(["A141", "F141", "I141", "M141", "P141", "T141", "X141", "AA141", "AD141"].map(cell => sheet.getCell(cell).text)).toEqual([
      "Vessel name *", "IMO Number", "Vessel type *", "Deadweight", "Engine type / power", "Owner / operator", "Rank *", "From *", "To *",
    ]);
    expect(sheet.getCell("F142").numFmt).toBe("@");
    expect(sheet.getCell("I142").dataValidation.type).toBe("list");
    const sea = BLOCKS.find(block => block.entity === "sea")!;
    expect(sea.rows).toBe(40);
    expect(sea.rowStep).toBe(1);
    expect(sheet.getCell("AA142").numFmt).toBe("dd-mmm-yyyy");
    expect(sheet.getCell("A140").text).toContain("IMO Number is optional");
  });
  it("round trips multiple IMO values and omits blank IMO while saving dates, masters and periods correctly", async () => {
    const { book, set } = filled();
    set("sea", { ...service, imoNumber: "0012345" });
    set("sea", { ...service, vesselName: "Older Ship", fromDate: "2020-01-01", toDate: "2020-04-01", imoNumber: "  " }, 1);
    set("sea", { ...service, vesselName: "Oldest Ship", fromDate: "2019-01-01", toDate: "2019-04-01", imoNumber: "9876543" }, 3);
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary).toMatchObject({ A1: 1, A4: 3 });
    expect(Object.keys(parsed.summary)).toEqual(["A1", "A2", "A3", "A4", "A5"]);
    expect(parsed.data.sea.map(record => record.imoNumber)).toEqual(["0012345", undefined, "9876543"]);
    const { tx, saved } = transaction();
    const uuid = await writeCandidate(tx, parsed, "actor");
    const rows = saved.filter(row => row.table === "cand_sea_service").map(row => row.values);
    expect(rows.map(row => row.imoNumber)).toEqual(["0012345", undefined, "9876543"]);
    expect(rows[1]).not.toHaveProperty("imoNumber");
    expect(rows.map(row => row.sortOrder)).toEqual([0, 1, 3]);
    for (const row of rows) expect(row).toMatchObject({ recCanUuid: uuid, vesselTypeUuid: "vessel-type", rank: "Master", periodMonths: "3.0M" });
    expect(saved[0].values).toMatchObject({ status: "Applied", fileNo: `R-${new Date().getFullYear()}-0018` });
    expect(saved[0].values.screeningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("reports IMO-only partial rows and disallows formulas without adding a mandatory IMO check", async () => {
    const { book, set } = filled();
    set("sea", { imoNumber: "1234567" });
    const partial = await parse(book);
    expect(partial.errors).toHaveLength(5);
    expect(partial.errors.every(error => error.section === "A4.1" && error.message === "Required for a populated row.")).toBe(true);
    set("sea", service);
    book.worksheets[0].getCell("F142").value = { formula: '"1234567"', result: "1234567" };
    expect((await parse(book)).errors).toContainEqual(expect.objectContaining({ cell: "F142", field: "IMO Number", message: expect.stringContaining("not a formula") }));
  });
  it("uses the web form's existing ten-character IMO limit without imposing a new number/checksum format", async () => {
    const { book, set } = filled();
    set("sea", { ...service, imoNumber: "IMO1234567" });
    expect((await parse(book)).errors).toEqual([]);
    set("sea", { imoNumber: "12345678901" });
    expect((await parse(book)).errors).toContainEqual(expect.objectContaining({ cell: "F142", field: "IMO Number", message: "Maximum 10 characters." }));
  });
  it("keeps semantic values and duplicate fingerprints stable across supported revisions", async () => {
    const results = [];
    let withImoFingerprint: string | undefined;
    for (const version of [LEGACY_VERSION, PREVIOUS_VERSION, ALIGNED_VERSION, DOCUMENT_VERSION, VERSION] as const) {
      const { book, set } = filled(version);
      set("sea", service, 1);
      set("address", { mobile: "0012345", countryOfResidenceUuid: "India" });
      set("family", { maritalStatus: "Married" });
      set("children", { firstName: "Child" });
      set("nok", { firstName: "Contact", email: "contact@example.invalid" });
      set("documents", { documentName: "Passport", number: "00123" });
      set("visas", { countryUuid: "India", visaType: "Work" });
      set("education", { qualifications: "Degree" });
      set("licenses", { certificateDocument: "Custom License", abbr: "CL" });
      set("training", { trainingCourse: "Custom Training" });
      set("additional", { information: "Availability", response: "Ready" });
      const parsed = await parse(book);
      expect(parsed.errors).toEqual([]);
      results.push(parsed);
      if (version === VERSION) {
        set("sea", { imoNumber: "1234567" }, 1);
        withImoFingerprint = candidateFingerprint(await parse(book));
      }
      if (!usesAlignedLayout(version)) {
        expect(book.worksheets[0].getCell("A47").text).toBe("Sea Service — A4");
        expect(book.worksheets[0].getCell("I53").value).toBe("2021-01-01");
        expect(book.worksheets[0].getCell("Q53").value).toBe("Bulk Carrier");
        expect(blocksForVersion(version).find(block => block.entity === "sea")!.fields).toHaveLength(8);
      }
    }
    expect(results.map(candidateFingerprint)).toEqual(Array(5).fill(candidateFingerprint(results[0])));
    expect(results[0].data).toEqual(results[1].data);
    expect(results[1].data).toEqual(results[2].data);
    expect(results[2].data).toEqual(results[3].data);
    expect(withImoFingerprint).not.toBe(candidateFingerprint(results[2]));
  });
  it("preserves revision 3 certificate dropdown defaults at their original coordinates", async () => {
    const { book } = filled(PREVIOUS_VERSION);
    const sheet = book.worksheets[0];
    sheet.getCell("A163").value = "Officer License [DB:license-id]";
    sheet.getCell("A180").value = "Safety Course [DB:course-id]";
    expect(sheet.getCell("E163").formula).toContain("$A163");
    expect(sheet.getCell("E180").formula).toContain("$A180");
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.licenses[0]).toMatchObject({ licenseId: "license-id", abbr: "OL", requirement: "Required" });
    expect(parsed.data.training[0]).toMatchObject({ courseId: "course-id", abbr: "SC", requirement: "Company" });
  });
});
