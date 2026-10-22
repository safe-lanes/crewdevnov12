// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { generateTemplate, createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { BLOCKS, LEGACY_BLOCKS, LEGACY_VERSION, cellLocation, labelLocation } from "../../server/v2/recruitment/import/contract";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint } from "../../server/v2/recruitment/import/persistence";
import { FORM_COLORS, CURRENT_LEGEND, LEGACY_LEGEND } from "../../server/v2/recruitment/import/workbookStyle";
import { isRequiredLabel } from "../../server/v2/recruitment/import/requirements";

const catalogs = { countries: [], nationalities: [], languages: [], ranks: [], agents: [], vesselTypes: [] };
vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));
let template: Buffer;
beforeAll(async () => { template = await generateTemplate(catalogs); });
async function workbook() {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(template as any);
  return book;
}
async function parse(book: ExcelJS.Workbook) {
  book.worksheets[0].getCell("F8").value = "Import";
  return parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
}
describe("Professional application workbook styling", () => {
  it("round trips the font hierarchy and separate neutral title/section/label/input fills", async () => {
    const sheet = (await workbook()).worksheets[0];
    expect(FORM_COLORS.section).toBe("FF808080");
    expect(FORM_COLORS.title).toBe(FORM_COLORS.section);
    expect(FORM_COLORS.label).toBe("FFE7E7E7");
    expect(sheet.getCell("A2").font).toMatchObject({ name: "Calibri", size: 16, bold: true });
    for (const address of ["A5", "A46", "A106", "A183", "A201"]) {
      expect(sheet.getCell(address).font).toMatchObject({ name: "Calibri", size: 11, bold: true });
      expect(sheet.getCell(address).fill).toMatchObject({ fgColor: { argb: FORM_COLORS.section } });
      expect(sheet.getCell(address).font.color).toMatchObject({ argb: FORM_COLORS.sectionText });
    }
    expect(sheet.getCell("A2").fill).toMatchObject({ fgColor: { argb: FORM_COLORS.title } });
    expect(sheet.getCell("A2").font.color).toMatchObject({ argb: FORM_COLORS.sectionText });
    for (const block of BLOCKS) block.fields.forEach((_, j) => {
      expect(sheet.getCell(labelLocation(block, j)).font).toMatchObject({ name: "Calibri", size: 10, bold: true });
      expect(sheet.getCell(labelLocation(block, j)).fill).toMatchObject({ fgColor: { argb: FORM_COLORS.label } });
      expect(sheet.getCell(cellLocation(block, j, 0)).font).toMatchObject({ name: "Calibri", size: 10 });
      expect(sheet.getCell(cellLocation(block, j, 0)).fill).toMatchObject({ fgColor: { argb: FORM_COLORS.white } });
    });
  });
  it("uses fine dotted entry lines, soft solid boundaries, readable table heights and A4 portrait printing", async () => {
    const sheet = (await workbook()).worksheets[0];
    for (const cell of ["F8", "A48", "A108", "A185"]) {
      expect(sheet.getCell(cell).border.bottom).toMatchObject({ style: "dotted", color: { argb: FORM_COLORS.dotted } });
      expect(sheet.getCell(cell).border.top).toMatchObject({ style: "dotted", color: { argb: FORM_COLORS.dotted } });
      expect(sheet.getCell(cell).border.left).toMatchObject({ style: "thin", color: { argb: FORM_COLORS.line } });
      expect(sheet.getCell(cell).alignment).toMatchObject({ wrapText: true, vertical: "middle" });
    }
    expect(sheet.getRow(89).height).toBeGreaterThanOrEqual(40);
    expect(sheet.getRow(107).height).toBeGreaterThanOrEqual(40);
    expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: "portrait", fitToWidth: 1, fitToHeight: 0, printArea: "A1:AF207" });
  });
  it("marks required fields, conditionally marks spouse names and leaves optional fields unstarred", async () => {
    const expected: Record<string, string[]> = {
      candidate: ["firstName"], documents: ["documentName"], visas: ["countryUuid", "visaType"],
      education: ["qualifications"], licenses: ["certificateDocument"], training: ["trainingCourse"],
      sea: ["vesselName", "vesselTypeUuid", "rank", "fromDate", "toDate"],
    };
    const sheet = (await workbook()).worksheets[0];
    for (const block of BLOCKS) block.fields.forEach((field, j) => {
      const cell = sheet.getCell(labelLocation(block, j));
      expect(isRequiredLabel(block.entity, field.key)).toBe(!!expected[block.entity]?.includes(field.key));
      if (expected[block.entity]?.includes(field.key)) {
        expect(cell.value).toMatchObject({ richText: [
          { text: field.label, font: { color: { argb: FORM_COLORS.text } } },
          { text: " *", font: { color: { argb: FORM_COLORS.required } } },
        ] });
      } else expect(cell.text).toBe(field.label);
    });
    expect(sheet.getCell("A4").text).toBe(CURRENT_LEGEND);
    expect(sheet.getCell("A29").text).toContain("If Married: spouse first name and family name are required");
    expect(sheet.getCell("A202").text).toContain("Only populated cells and rows are saved.");
    expect(sheet.getCell("A203").text).toContain("YYYY-MM-DD or DD-MMM-YYYY");
  });
  it("has no cell notes or comment XML after downloading and saving again", async () => {
    const book = await workbook();
    const saved = Buffer.from(await book.xlsx.writeBuffer());
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(saved as any);
    for (const current of [book, reopened]) {
      const notedCells: string[] = [];
      current.worksheets[0].eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => {
        if (cell.note) notedCells.push(cell.address);
      }));
      expect(notedCells).toEqual([]);
    }
    for (const bytes of [template, saved]) {
      const zip = await JSZip.loadAsync(bytes);
      expect(Object.keys(zip.files).filter(name => /comments[^/]*\.xml$/i.test(name))).toEqual([]);
    }
  });
  it("accepts old plain labels/legend and new rich labels with identical parsed values and fingerprint", async () => {
    const modern = await workbook(), legacy = createTemplateWorkbook(catalogs, LEGACY_VERSION);
    const sheet = legacy.worksheets[0];
    for (const block of LEGACY_BLOCKS) block.fields.forEach((field, j) => { sheet.getCell(labelLocation(block, j)).value = field.label; });
    sheet.getCell("A4").value = LEGACY_LEGEND;
    sheet.getCell("A8").note = "Required for every application.";
    sheet.getCell("F8").note = "Blank values are not saved.";
    sheet.getCell("I51").note = "Use a real Excel date, YYYY-MM-DD or DD-MMM-YYYY.";
    const current = await parse(modern), previous = await parse(legacy);
    expect(current.isValid).toBe(true);
    expect(previous).toEqual(current);
    expect(candidateFingerprint(previous)).toBe(candidateFingerprint(current));
  });
  it("accepts Excel flattening rich headings to their exact plain text", async () => {
    const book = await workbook();
    for (const block of BLOCKS) block.fields.forEach((_, j) => {
      const cell = book.worksheets[0].getCell(labelLocation(block, j));
      if (cell.type !== ExcelJS.ValueType.Formula) cell.value = cell.text;
    });
    book.worksheets[0].getCell("A4").value = CURRENT_LEGEND;
    expect((await parse(book)).isValid).toBe(true);
  });
  it.each(["Changed *", "First name **", " First name *"])("rejects altered mandatory heading %s", async heading => {
    const book = await workbook();
    book.worksheets[0].getCell("A8").value = { richText: [{ text: heading }] };
    await expect(parse(book)).rejects.toMatchObject({ code: "MODIFIED_HEADING" });
  });
  it("does not accept an invented mandatory marker on an optional field", async () => {
    const book = await workbook();
    book.worksheets[0].getCell("A10").value = "Gender *";
    await expect(parse(book)).rejects.toMatchObject({ code: "MODIFIED_HEADING" });
  });
  it.each([
    { formula: '"First name *"', result: "First name *" },
    { text: "First name *", hyperlink: "https://example.invalid" },
  ])("rejects formula/link headings instead of trusting their displayed text", async value => {
    const book = await workbook();
    book.worksheets[0].getCell("A8").value = value;
    await expect(parse(book)).rejects.toMatchObject({ code: "MODIFIED_HEADING" });
  });
  it("rejects Married with blank spouse names and keeps unused tables empty", async () => {
    const book = await workbook();
    book.worksheets[0].getCell("F25").value = "Married";
    const parsed = await parse(book);
    expect(parsed.errors.map(error => error.cell)).toEqual(["F27", "F28"]);
    expect(parsed.isValid).toBe(false);
    expect(parsed.data.family).toEqual([{ maritalStatus: "Married", __row: "0" }]);
    expect(parsed.data.children).toEqual([]);
    expect(parsed.data.sea).toEqual([]);
    expect(parsed.data.documents).toEqual([]);
  });
});
