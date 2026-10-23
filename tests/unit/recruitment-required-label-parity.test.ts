// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { getTableName } from "drizzle-orm";
import { VERSION, FIELD_ALIGNMENT_VERSION, DOCUMENT_VERSION, ALIGNED_VERSION, PREVIOUS_VERSION, LEGACY_VERSION,
  blocksForVersion, cellLocation, labelLocation, type TemplateVersion } from "../../server/v2/recruitment/import/contract";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint, writeCandidate } from "../../server/v2/recruitment/import/persistence";
vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));

const versions = [LEGACY_VERSION, PREVIOUS_VERSION, ALIGNED_VERSION, DOCUMENT_VERSION, FIELD_ALIGNMENT_VERSION, VERSION] as const;
function form(version: TemplateVersion = VERSION) {
  const book = createTemplateWorkbook({}, version);
  const sheet = book.worksheets[0];
  const block = (entity: string) => blocksForVersion(version).find(item => item.entity === entity)!;
  const cell = (entity: string, key: string, row = 0) => cellLocation(block(entity), block(entity).fields.findIndex(field => field.key === key), row);
  const set = (entity: string, record: Record<string, ExcelJS.CellValue>, row = 0) => {
    Object.entries(record).forEach(([key, value]) => { sheet.getCell(cell(entity, key, row)).value = value; });
  };
  set("candidate", { firstName: "Synthetic" });
  return { book, sheet, set, cell, block };
}
const parse = async (book: ExcelJS.Workbook) => parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), {});

describe("Recruitment required rules and label parity", () => {
  it.each([
    [{}, ["F27", "F28"]],
    [{ spouseFirstName: "Partner" }, ["F28"]],
    [{ spouseFamilyName: "Candidate" }, ["F27"]],
    [{ spouseFirstName: "  ", spouseFamilyName: "  " }, ["F27", "F28"]],
    [{ spouseFirstName: "Partner", spouseFamilyName: "Candidate" }, []],
  ])("validates Married with spouse fields %j", async (names, cells) => {
    const { book, set } = form();
    set("family", { maritalStatus: " married ", ...names });
    const result = await parse(book);
    expect(result.errors.map(error => error.cell)).toEqual(cells);
    for (const error of result.errors) expect(error).toMatchObject({
      section: "A1.3", sheet: "APPLICATION FORM", message: expect.stringContaining("required when Marital Status is Married"),
    });
    expect(result.data.family[0]).not.toHaveProperty("spouseDob");
    expect(result.isValid).toBe(cells.length === 0);
  });
  it.each(["Single", "Divorced", "Widowed", "", "   "])("keeps spouse names optional for status %j", async status => {
    const { book, set } = form();
    set("family", { maritalStatus: status });
    expect((await parse(book)).errors).toEqual([]);
  });
  it("still validates optional spouse values when supplied", async () => {
    const { book, set } = form();
    set("family", { spouseFirstName: "123", spouseDob: "bad date" });
    expect((await parse(book)).errors.map(error => error.cell)).toEqual(["F27", "V28"]);
  });
  it.each(versions)("reads historical headings but enforces current rules in %s", async version => {
    const { book, set, sheet, block, cell } = form(version);
    if (version !== VERSION) {
      expect(sheet.getCell(labelLocation(block("children"), 0)).text).toBe("First name *");
      expect(sheet.getCell(labelLocation(block("additional"), 0)).text).toBe("Information *");
      expect(block("documents").fields[0].label).toBe("Document type");
    }
    set("family", { maritalStatus: "Married" });
    expect((await parse(book)).errors.map(error => error.cell)).toEqual([
      cell("family", "spouseFirstName"), cell("family", "spouseFamilyName"),
    ]);
    set("family", { spouseFirstName: "Partner", spouseFamilyName: "Candidate" });
    set("children", { familyName: "Child" }, 2);
    set("additional", { response: "Available" }, 3);
    expect((await parse(book)).errors).toEqual([]);
  });
  it("keeps fingerprints stable across all versions for identical populated fields", async () => {
    const fingerprints = [];
    for (const version of versions) {
      const { book, set } = form(version);
      set("family", { maritalStatus: "Married", spouseFirstName: "Partner", spouseFamilyName: "Candidate" });
      set("children", { familyName: "Child" });
      set("additional", { response: "Available" });
      set("address", { addressLine2: "City State", contactLandline: "00123" });
      set("documents", { documentName: "Custom Document", number: "00123" });
      const parsed = await parse(book);
      expect(parsed.errors).toEqual([]);
      fingerprints.push(candidateFingerprint(parsed));
    }
    expect(new Set(fingerprints).size).toBe(1);
  });
  it("saves partial child and additional rows without manufacturing missing values or empty rows", async () => {
    const { book, set } = form();
    set("children", { familyName: "Child", firstName: "   " }, 2);
    set("additional", { response: "Available", information: "  " }, 3);
    set("children", { firstName: "  " }, 4);
    set("additional", { information: "  ", response: "  " }, 5);
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.children).toEqual([{ familyName: "Child", __row: "2" }]);
    expect(parsed.data.additional).toEqual([{ response: "Available", __row: "3" }]);
    const saved: { table: string; values: Record<string, unknown> }[] = [];
    const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain,
      limit: async () => [], then: (resolve: any) => resolve([{ maxNum: 17 }]) };
    const tx = { execute: vi.fn(), select: () => chain,
      insert: (table: any) => ({ values: async (values: Record<string, unknown>) => saved.push({ table: getTableName(table), values }) }) };
    await writeCandidate(tx, parsed, "actor");
    expect(saved).toHaveLength(3);
    const child = saved.find(row => row.table === "cand_children")!.values;
    expect(child).toMatchObject({ familyName: "Child", sortOrder: 2 });
    expect(child).not.toHaveProperty("firstName");
    const additional = saved.find(row => row.table === "cand_additional_info")!.values;
    expect(additional).toMatchObject({ response: "Available", sortOrder: 3 });
    expect(additional).not.toHaveProperty("information");
  });
  it("writes exact labels with room for the full address and no optional asterisks", () => {
    const { sheet, block, cell } = form();
    expect(sheet.getCell("A47").text).toBe("Document *");
    expect(sheet.getCell("Q21").text).toBe("Residential Address Line 2 (City, State, PIN)");
    expect(sheet.getCell("A22").text).toBe("Contact Landline");
    expect(sheet.getCell("Q10").text).toBe("Vessel Type");
    expect(sheet.getCell("A31").text).toBe("First name");
    expect(sheet.getCell("A184").text).toBe("Information");
    expect(sheet.getRow(21).height).toBeGreaterThanOrEqual(48);
    expect(sheet.model.merges).toContain("Q21:X21");
    expect(cell("address", "addressLine2")).toBe("Y21");
    expect(block("vesselTypes").rows).toBe(1);
    expect(sheet.getCell("A204").text).toContain("separated by ;");
  });
  it("roundtrips safe dynamic spouse headings and red conditional formatting without notes", async () => {
    const { book } = form();
    const bytes = Buffer.from(await book.xlsx.writeBuffer());
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes as any);
    const sheet = reopened.worksheets[0];
    for (const [address, name] of [["A27", "Spouse first name"], ["A28", "Spouse family name"]]) {
      expect(sheet.getCell(address).value).toEqual({
        formula: `IF(TRIM($F$25)="Married","${name} *","${name}")`, result: name,
      });
    }
    expect(sheet.conditionalFormattings.map(rule => rule.rules[0].formulae)).toEqual([
      ['TRIM($F$25)="Married"'], ['TRIM($F$25)="Married"'],
    ]);
    sheet.eachRow(row => row.eachCell(cell => expect(cell.note).toBeUndefined()));
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).some(name => /comments.*xml/.test(name))).toBe(false);
    expect((await parse(reopened)).isValid).toBe(true);
  });
  it.each([
    { formula: '"Spouse first name"', result: "Spouse first name" },
    { formula: 'HYPERLINK("https://example.invalid","Spouse first name")', result: "Spouse first name" },
    "Spouse first name",
  ])("rejects changed conditional headings even with plausible cached text %j", async value => {
    const { book, sheet } = form();
    sheet.getCell("A27").value = value;
    await expect(parse(book)).rejects.toMatchObject({ code: "MODIFIED_HEADING" });
  });
});
