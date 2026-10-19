// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { VERSION, PREVIOUS_VERSION, LEGACY_VERSION, blocksForVersion, cellLocation, type Catalogs, type TemplateVersion } from "../../server/v2/recruitment/import/contract";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint } from "../../server/v2/recruitment/import/persistence";
import { FORM_LEGEND, PREVIOUS_LEGEND } from "../../server/v2/recruitment/import/workbookStyle";

vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));
const catalogs: Catalogs = {
  countries: [], nationalities: [], languages: [], ranks: [], agents: [],
  vesselTypes: Array.from({ length: 9 }, (_, i) => ({ label: `Vessel Type ${i + 1}`, value: `type-${i + 1}` })),
};
function form(version: TemplateVersion = VERSION) {
  const book = createTemplateWorkbook(catalogs, version);
  book.worksheets[0].getCell("F8").value = "Import";
  return book;
}
async function parse(book: ExcelJS.Workbook, masters = catalogs) {
  return parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), masters);
}
describe("Recruitment layout versions and vessel-type list", () => {
  it("places the optional vessel box beside Gender, leaves child mappings intact and offers non-blocking name discovery", async () => {
    const book = form();
    const sheet = book.worksheets[0];
    expect(sheet.getCell("A1").value).toBe(VERSION);
    expect(sheet.getCell("Q10").value).toBe("Vessel types applied for");
    expect(sheet.getCell("V10").value).toBeNull();
    expect(sheet.getCell("V10").dataValidation).toMatchObject({ type: "list", showErrorMessage: false, allowBlank: true });
    expect(sheet.getCell("V10").dataValidation.formulae?.[0]).toMatch(/^\$[A-Z]+\$2:/);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await book.xlsx.writeBuffer());
    // ExcelJS omits false boolean XML attributes; absence also means disabled.
    expect(Boolean(reopened.worksheets[0].getCell("V10").dataValidation.showErrorMessage)).toBe(false);
    expect(reopened.worksheets[0].getCell("V10").dataValidation.formulae)
      .toEqual(sheet.getCell("V10").dataValidation.formulae);
    expect(sheet.getRow(10).height).toBeGreaterThanOrEqual(48);
    expect(sheet.model.merges).toContain("A30:AF30");
    expect(sheet.getCell("A204").text).toContain("Bulk Carrier; Oil Tanker");
    sheet.getCell("A39").value = "Child";
    sheet.getCell("AB39").value = "Female";
    const parsed = await parse(book);
    expect(parsed.isValid).toBe(true);
    expect(parsed.data.children).toEqual([{ firstName: "Child", gender: "Female", __row: "7" }]);
    expect(parsed.data.vesselTypes).toEqual([]);
  });
  it.each(["", "   ", "Vessel Type 1", " Vessel Type 1 ; vessel type 2 ", "type-1;type-2"])("parses valid blank/single/multiple input %s", async input => {
    const book = form();
    book.worksheets[0].getCell("V10").value = input;
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    const count = !input.trim() ? 0 : input.includes(";") ? 2 : 1;
    expect(parsed.data.vesselTypes).toEqual(Array.from({ length: count }, (_, i) => ({
      vesselTypeUuid: `type-${i + 1}`, __row: String(i),
    })));
    expect(parsed.summary.A1).toBe(1 + count);
  });
  it("accepts eight names with a combined length greater than the per-item limit", async () => {
    const book = form();
    book.worksheets[0].getCell("V10").value = catalogs.vesselTypes.slice(0, 8).map(entry => entry.label).join("; ");
    const parsed = await parse(book);
    expect(parsed.isValid).toBe(true);
    expect(parsed.data.vesselTypes).toHaveLength(8);
  });
  it.each([
    ["Vessel Type 1;Vessel Type 1", "Duplicate"],
    ["Vessel Type 1; type-1", "Duplicate"],
    ["Vessel Type 1;Unknown Ship", "Unknown or inactive"],
    ["Vessel Type 1;;Vessel Type 2", "empty entries"],
    [";Vessel Type 1", "empty entries"],
    ["Vessel Type 1;", "empty entries"],
    [Array(9).fill("Vessel Type 1").join(";"), "no more than 8"],
    ["x".repeat(51), "maximum 50"],
    [{ formula: '"Vessel Type 1"', result: "Vessel Type 1" }, "formula"],
    [{ text: "Vessel Type 1", hyperlink: "https://example.invalid" }, "formula"],
    [{ richText: [{ text: "Vessel Type 1" }] }, "formula"],
  ])("rejects invalid vessel input and points to V10: %j", async (input, message) => {
    const book = form();
    book.worksheets[0].getCell("V10").value = input as ExcelJS.CellValue;
    const parsed = await parse(book);
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContainEqual(expect.objectContaining({ cell: "V10", section: "A1.1", message: expect.stringContaining(message as string) }));
  });
  it("rejects ambiguous names without trusting edited workbook lookup entries", async () => {
    const book = form();
    book.worksheets[0].getCell("V10").value = "Vessel Type 1";
    const parsed = await parse(book, { ...catalogs, vesselTypes: [...catalogs.vesselTypes, { label: "Vessel Type 1", value: "different-id" }] });
    expect(parsed.errors[0]).toMatchObject({ cell: "V10", message: expect.stringContaining("Ambiguous") });
  });
  it.each([VERSION, PREVIOUS_VERSION, LEGACY_VERSION] as const)("spouse details are optional but supplied values validate in %s", async version => {
    const book = form(version);
    const sheet = book.worksheets[0];
    const family = blocksForVersion(version).find(block => block.entity === "family")!;
    const cell = (key: string) => cellLocation(family, family.fields.findIndex(field => field.key === key), 0);
    sheet.getCell(cell("maritalStatus")).value = "Married";
    const empty = await parse(book);
    expect(empty.errors).toEqual([]);
    expect(empty.data.family).toEqual([{ maritalStatus: "Married", __row: "0" }]);
    sheet.getCell(cell("spouseFirstName")).value = "Partner";
    expect((await parse(book)).isValid).toBe(true); // Partial spouse details are also optional.
    sheet.getCell(cell("spouseFirstName")).value = "123";
    sheet.getCell(cell("spouseDob")).value = "not a date";
    const invalid = await parse(book);
    expect(invalid.errors.map(error => error.cell)).toEqual([cell("spouseFirstName"), cell("spouseDob")]);
  });
  it("keeps semantic records and duplicate-import fingerprints identical across layouts", async () => {
    const current = form(), old = form(LEGACY_VERSION);
    current.worksheets[0].getCell("V10").value = "Vessel Type 1; Vessel Type 2";
    old.worksheets[0].getCell("Y39").value = "Vessel Type 1";
    old.worksheets[0].getCell("Y42").value = "Vessel Type 2";
    old.worksheets[0].getCell("A22").note = "Required only when marital status is Married.";
    current.worksheets[0].getCell("F25").value = "Married";
    old.worksheets[0].getCell("V15").value = "Married";
    const modern = await parse(current), legacy = await parse(old);
    expect(modern.isValid).toBe(true);
    expect(legacy.isValid).toBe(true);
    expect(legacy.summary).toEqual(modern.summary);
    expect(candidateFingerprint(legacy)).toBe(candidateFingerprint(modern));
    expect(old.worksheets[0].getCell("A4").text).toBe(PREVIOUS_LEGEND);
    expect(current.worksheets[0].getCell("A4").text).toBe(FORM_LEGEND);
  });
  it("does not accept old layout cells as new inputs or allow version/merge spoofing", async () => {
    const book = form();
    book.worksheets[0].getCell("Y45").value = "Vessel Type 1";
    expect((await parse(book)).errors).toContainEqual(expect.objectContaining({ cell: "Y45", field: "Outside input area" }));
    book.worksheets[0].getCell("A1").value = LEGACY_VERSION;
    await expect(parse(book)).rejects.toMatchObject({ code: "MODIFIED_LAYOUT" });
    const old = form(LEGACY_VERSION);
    old.worksheets[0].getCell("A1").value = VERSION;
    await expect(parse(old)).rejects.toMatchObject({ code: "MODIFIED_LAYOUT" });
  });
});
