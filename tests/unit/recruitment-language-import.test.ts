// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { getTableName } from "drizzle-orm";
import { createTemplateWorkbook, FOREIGN_LANGUAGES_PROMPT } from "../../server/v2/recruitment/import/workbook";
import { VERSION, DOCUMENT_VERSION, ALIGNED_VERSION, PREVIOUS_VERSION, LEGACY_VERSION, usesDocumentCatalog, blocksForVersion, cellLocation, type TemplateVersion } from "../../server/v2/recruitment/import/contract";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint, writeCandidate } from "../../server/v2/recruitment/import/persistence";
vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));

const catalogs = {
  languages: [{ label: "French", value: "french-uuid" }, { label: "Inactive", value: "inactive-uuid" }],
  foreignLanguages: [{ label: "Spanish", value: "spanish-uuid" }, { label: "French", value: "french-uuid" }],
};
function filled(value: ExcelJS.CellValue, version: TemplateVersion = VERSION) {
  const book = createTemplateWorkbook(catalogs, version);
  const personal = blocksForVersion(version).find(block => block.entity === "personal")!;
  const cell = cellLocation(personal, personal.fields.findIndex(field => field.key === "foreignLanguages"), 0);
  book.worksheets[0].getCell("F8").value = "Synthetic";
  book.worksheets[0].getCell(cell).value = value;
  return { book, cell };
}
const parse = async (book: ExcelJS.Workbook) => parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);

describe("Foreign Languages suggestions with manual comma-separated input", () => {
  it("roundtrips sorted name-only choices, nonblocking validation and the requested prompt without notes or layout changes", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await createTemplateWorkbook(catalogs).xlsx.writeBuffer()) as any);
    const sheet = book.worksheets[0], cell = sheet.getCell("V15");
    expect(cell.dataValidation).toMatchObject({
      type: "list", allowBlank: true, showInputMessage: true,
      promptTitle: "Foreign languages", prompt: FOREIGN_LANGUAGES_PROMPT,
    });
    expect(Boolean(cell.dataValidation.showErrorMessage)).toBe(false);
    expect(cell.dataValidation.prompt).toContain("For multiple languages, manually enter names separated by commas, e.g. French, Spanish.");
    expect(cell.dataValidation.prompt).toContain("replaces the cell value");
    expect(cell.note).toBeUndefined();
    const column = cell.dataValidation.formulae![0].match(/[A-Z]+/)![0];
    expect([2, 3].map(row => sheet.getCell(`${column}${row}`).text)).toEqual(["French", "Spanish"]);
    expect(sheet.getColumn(column).hidden).toBe(true);
    expect(sheet.getCell("V14").dataValidation.type).toBe("list");
    expect(Boolean(sheet.getCell("V14").dataValidation.showErrorMessage)).toBe(true);
    expect(book.worksheets).toHaveLength(1);
    expect(sheet.pageSetup.printArea).toBe("A1:AF207");
  });

  it.each([{}, { foreignLanguages: [] }])("retains manual entry and instructions with an empty or missing catalog", async empty => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await createTemplateWorkbook(empty).xlsx.writeBuffer()) as any);
    const validation = book.worksheets[0].getCell("V15").dataValidation;
    expect(validation.type).toBe("any");
    expect(validation.prompt).toBe(FOREIGN_LANGUAGES_PROMPT);
    expect(validation.formulae || []).toEqual([]);
    book.worksheets[0].getCell("F8").value = "Synthetic";
    book.worksheets[0].getCell("V15").value = "French, Spanish";
    expect((await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), empty)).errors).toEqual([]);
  });

  it.each(["French", "French, Spanish", "Custom Language, French", "French,Spanish"])("preserves text without master resolution or normalization: %s", async value => {
    const parsed = await parse(filled(value).book);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.personal[0].foreignLanguages).toBe(value);
    const saved: { table: string; values: any }[] = [];
    const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain,
      limit: async () => [], then: (resolve: any) => resolve([{ maxNum: 17 }]) };
    const tx = { execute: vi.fn(), select: () => chain,
      insert: (table: any) => ({ values: async (values: any) => { saved.push({ table: getTableName(table), values }); } }) };
    await writeCandidate(tx, parsed, null);
    expect(saved.find(row => row.table === "cand_personal_details")!.values.foreignLanguages).toBe(value);
  });

  it.each([null, "", "   "])("does not create personal details for a blank language cell: %s", async value => {
    const parsed = await parse(filled(value).book);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.personal).toEqual([]);
  });

  it("retains the existing 100-character boundary and formula protection", async () => {
    expect((await parse(filled("a".repeat(100)).book)).errors).toEqual([]);
    expect((await parse(filled("a".repeat(101)).book)).errors).toContainEqual(expect.objectContaining({
      field: "Foreign languages", cell: "V15", message: "Maximum 100 characters.",
    }));
    expect((await parse(filled({ formula: '"French"', result: "French" }).book)).errors)
      .toContainEqual(expect.objectContaining({ cell: "V15", message: expect.stringContaining("not a formula") }));
  });

  it("accepts pre-change workbooks and preserves historical fingerprints across every supported layout", async () => {
    const fingerprints = [];
    for (const version of [LEGACY_VERSION, PREVIOUS_VERSION, ALIGNED_VERSION, DOCUMENT_VERSION, VERSION] as const) {
      const { book, cell } = filled("French, Spanish", version);
      // Previously downloaded workbooks have no dropdown/prompt at this input.
      book.worksheets[0].getCell(cell).dataValidation = {};
      const parsed = await parse(book);
      expect(parsed.errors).toEqual([]);
      fingerprints.push(candidateFingerprint(parsed));
      if (!usesDocumentCatalog(version)) expect(createTemplateWorkbook(catalogs, version).worksheets[0].getCell(cell).dataValidation?.type).toBeUndefined();
    }
    expect(new Set(fingerprints).size).toBe(1);
    expect(candidateFingerprint(await parse(filled("French, Spanish").book))).toBe(fingerprints[0]);
  });
});
