// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { getTableName } from "drizzle-orm";
import { BLOCKS, LEGACY_VERSION, VERSION, cellLocation, type Catalogs } from "../../server/v2/recruitment/import/contract";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint, cleanRecord, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import { certificateDefaultFormula } from "../../server/v2/recruitment/import/certificateAutofill";
import { certificateOption, CERTIFICATE_GUIDE } from "../../server/v2/recruitment/import/certificateCatalogs";
import { FORM_SHEET } from "../../server/v2/recruitment/import/formLayout";

vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));
const catalogs: Catalogs = {
  licenses: [
    { label: "Chief Engineer", value: "LIC007", abbr: "CE", requirement: "Required for engineers" },
    { label: "Deck Officer", value: "LIC008", abbr: "DO", requirement: "Deck requirement" },
  ],
  training: [
    { label: "Company Safety", value: "SAF029", abbr: "CSI", requirement: "Company-specific requirement" },
    { label: "Company Induction", value: "SAF030", abbr: "IND", requirement: "Before joining" },
  ],
};
const entities = ["licenses", "training"] as const;
const blockFor = (entity: string) => BLOCKS.find(block => block.entity === entity)!;
function workbook(source = catalogs) {
  const book = createTemplateWorkbook(source);
  book.getWorksheet(FORM_SHEET)!.getCell("F8").value = "Import";
  return book;
}
function select(book: ExcelJS.Workbook, entity: typeof entities[number], index = 0, row = 0) {
  book.getWorksheet(FORM_SHEET)!.getCell(cellLocation(blockFor(entity), 0, row)).value = certificateOption(catalogs[entity][index]);
}
const parse = async (book: ExcelJS.Workbook, live = catalogs) =>
  parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), live);

describe("Recruitment certificate dependent autofill", () => {
  it("roundtrips all 90 safe formula cells, requesting spreadsheet recalculation without adding sheets or comments", async () => {
    const book = workbook(), loaded = new ExcelJS.Workbook();
    const bytes = await book.xlsx.writeBuffer();
    await loaded.xlsx.load(bytes);
    expect(loaded.worksheets).toHaveLength(1);
    // ExcelJS writes calculation properties but does not restore them on load.
    const xml = await (await JSZip.loadAsync(bytes)).file("xl/workbook.xml")!.async("string");
    expect(xml).toContain('fullCalcOnLoad="1"');
    const sheet = loaded.getWorksheet(FORM_SHEET)!;
    for (const entity of entities) {
      const block = blockFor(entity);
      for (let row = 0; row < block.rows!; row++) {
        for (const [j, key] of [[1, "abbr"], [2, "requirement"]] as const) {
          const cell = sheet.getCell(cellLocation(block, j, row));
          expect(cell.formula).toBe(certificateDefaultFormula(block, row, key));
          expect(cell.numFmt || "General").toBe("General");
          expect(cell.note).toBeUndefined();
        }
      }
    }
    for (let col = 52; col < 58; col++) expect(sheet.getColumn(col).hidden).toBe(true);
  });

  it("ignores blank-result formulas in all otherwise empty rows", async () => {
    const parsed = await parse(workbook());
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary.A3).toBe(0);
    expect(parsed.data.licenses).toEqual([]);
    expect(parsed.data.training).toEqual([]);
  });

  it.each(entities)("fills only abbreviation and requirement for selected %s without cached results", async entity => {
    const book = workbook(); select(book, entity);
    const sheet = book.getWorksheet(FORM_SHEET)!, block = blockFor(entity);
    for (const j of [1, 2]) sheet.getCell(cellLocation(block, j, 0)).value = { formula: sheet.getCell(cellLocation(block, j, 0)).formula! };
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    const record = cleanRecord(parsed.data[entity][0]);
    expect(record).toMatchObject({ abbr: catalogs[entity][0].abbr, requirement: catalogs[entity][0].requirement });
    expect(record).not.toHaveProperty("certificateNo");
    expect(record).not.toHaveProperty("issued");
    expect(record).not.toHaveProperty("expiry");
    expect(record).not.toHaveProperty("issuingAuthority");
    expect(record).not.toHaveProperty("issuingCountryUuid");
  });

  it.each(entities)("changes or clears %s selection without retaining the old cached defaults", async entity => {
    const book = workbook(); select(book, entity);
    const sheet = book.getWorksheet(FORM_SHEET)!;
    for (const j of [1, 2]) {
      const cell = sheet.getCell(cellLocation(blockFor(entity), j, 0));
      cell.value = { formula: cell.formula!, result: "OLD OR FORGED CACHE" };
    }
    select(book, entity, 1);
    const changed = await parse(book);
    expect(changed.errors).toEqual([]);
    expect(changed.data[entity][0]).toMatchObject({ abbr: catalogs[entity][1].abbr, requirement: catalogs[entity][1].requirement });
    sheet.getCell(cellLocation(blockFor(entity), 0, 0)).value = null;
    const cleared = await parse(book);
    expect(cleared.errors).toEqual([]);
    expect(cleared.data[entity]).toEqual([]);
  });

  it.each(entities)("preserves explicit overrides and intentional blanks in %s", async entity => {
    const book = workbook(); select(book, entity);
    const sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell(cellLocation(blockFor(entity), 1, 0)).value = "USER";
    sheet.getCell(cellLocation(blockFor(entity), 2, 0)).value = null;
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data[entity][0].abbr).toBe("USER");
    expect(parsed.data[entity][0]).not.toHaveProperty("requirement");
    expect(parsed.data[entity][0]).not.toHaveProperty("__certificateDefaults");
  });

  it.each(entities)("keeps custom %s editable and doesn't fill defaults for wildcards or bare typed names", async entity => {
    const book = workbook(), sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell(cellLocation(blockFor(entity), 0, 0)).value = "Custom Workshop";
    sheet.getCell(cellLocation(blockFor(entity), 1, 0)).value = "CUST";
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    expect(cleanRecord(parsed.data[entity][0])).toMatchObject({ abbr: "CUST" });
    expect(parsed.data[entity][0]).not.toHaveProperty("requirement");
    expect(parsed.data[entity][0]).not.toHaveProperty(entity === "licenses" ? "licenseId" : "courseId");
    for (const value of ["*", "?", "~", catalogs[entity][0].label]) {
      sheet.getCell(cellLocation(blockFor(entity), 0, 0)).value = value;
      sheet.getCell(cellLocation(blockFor(entity), 1, 0)).value = { formula: certificateDefaultFormula(blockFor(entity), 0, "abbr") };
      const typed = await parse(book);
      expect(typed.errors).toEqual([]);
      expect(typed.data[entity][0]).not.toHaveProperty("abbr");
      expect(typed.data[entity][0]).not.toHaveProperty("requirement");
    }
  });

  it("omits missing defaults, including spreadsheet engines rewriting empty lookup strings to blank cells", async () => {
    const source = { licenses: [{ ...catalogs.licenses[0], abbr: null, requirement: "" }], training: [] };
    const book = workbook(source); select(book, "licenses");
    book.getWorksheet(FORM_SHEET)!.getCell("BA2").value = null;
    book.getWorksheet(FORM_SHEET)!.getCell("BB2").value = null;
    const parsed = await parse(book, source);
    expect(parsed.errors).toEqual([]);
    expect(cleanRecord(parsed.data.licenses[0])).toEqual({ certificateDocument: "Chief Engineer", licenseId: "LIC007" });
  });

  it("accepts long trusted master defaults without extending manual input limits", async () => {
    const source = { ...catalogs, training: [{ ...catalogs.training[0], abbr: "LONG".repeat(20), requirement: "Company requirement ".repeat(10) }] };
    const book = workbook(source); select(book, "training");
    const parsed = await parse(book, source);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.training[0].requirement).toBe(source.training[0].requirement.trim());
    book.getWorksheet(FORM_SHEET)!.getCell("I108").value = "x".repeat(51);
    expect((await parse(book, source)).errors).toContainEqual(expect.objectContaining({ cell: "I108", message: "Maximum 50 characters." }));
  });

  it.each(entities)("rejects changed or forged %s lookup defaults instead of saving displayed or cached metadata", async entity => {
    const book = workbook(); select(book, entity);
    const changed = { ...catalogs, [entity]: catalogs[entity].map((entry, i) => i ? entry : { ...entry, abbr: "Changed" }) };
    const stale = await parse(book, changed);
    expect(stale.isValid).toBe(false);
    expect(stale.errors).toContainEqual(expect.objectContaining({ field: "Abbreviation", message: expect.stringContaining("has changed") }));
    const sheet = book.getWorksheet(FORM_SHEET)!;
    const start = entity === "licenses" ? 52 : 55;
    // Locate the selected snapshot, independent of sort order.
    sheet.getColumn(start).eachCell((cell, row) => {
      if (cell.value === certificateOption(catalogs[entity][0])) sheet.getCell(row, start + 1).value = "Forged default";
    });
    const forged = await parse(book);
    expect(forged.isValid).toBe(false);
    expect(forged.errors.some(error => error.message.includes("lookup was modified"))).toBe(true);
  });

  it("does not invalidate a selected row because an unrelated catalog item or overridden default changed", async () => {
    const book = workbook(); select(book, "licenses");
    book.getWorksheet(FORM_SHEET)!.getCell("I90").value = "Intentional override";
    const live = { ...catalogs, licenses: [
      { ...catalogs.licenses[0], requirement: "Changed but overridden" },
      { ...catalogs.licenses[1], abbr: "Changed unrelated" },
      { label: "New item", value: "NEW", abbr: "N" },
    ] };
    const parsed = await parse(book, live);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.licenses[0]).toMatchObject({ abbr: "CE", requirement: "Intentional override" });
  });

  it.each(["SUM(1,2)", 'HYPERLINK("https://example.com","Click")', "'[external.xlsx]Sheet1'!A1"])("rejects non-template formulas: %s", async formula => {
    const book = workbook(); select(book, "licenses");
    book.getWorksheet(FORM_SHEET)!.getCell("E90").value = { formula, result: "CE" };
    const parsed = await parse(book);
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContainEqual(expect.objectContaining({ cell: "E90", message: expect.stringContaining("Only the original template autofill formula") }));
  });

  it("rejects a legitimate formula moved to the wrong row/column and formulas in unrelated fields", async () => {
    const book = workbook(); select(book, "licenses");
    const sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell("E90").value = { formula: certificateDefaultFormula(blockFor("licenses"), 1, "abbr") };
    sheet.getCell("I90").value = { formula: certificateDefaultFormula(blockFor("licenses"), 0, "abbr") };
    sheet.getCell("M90").value = { formula: '"0007"', result: "0007" };
    const parsed = await parse(book);
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors.map(error => error.cell)).toEqual(expect.arrayContaining(["E90", "I90", "M90"]));
  });

  it("accepts only the verified FALSE() spreadsheet rewrite, not altered lookup behavior", async () => {
    const book = workbook(); select(book, "licenses");
    const sheet = book.getWorksheet(FORM_SHEET)!;
    for (const j of [1, 2]) {
      const cell = sheet.getCell(cellLocation(blockFor("licenses"), j, 0));
      cell.value = { formula: cell.formula!.replace(",FALSE)", ",FALSE())") };
    }
    expect((await parse(book)).errors).toEqual([]);
    const cell = sheet.getCell("E90");
    cell.value = { formula: cell.formula!.replace(",FALSE())", ",TRUE())") };
    expect((await parse(book)).errors).toContainEqual(expect.objectContaining({ cell: "E90", message: expect.stringContaining("Only the original template autofill formula") }));
  });

  it("keeps old version 2/3 values and fingerprints unchanged while excluding only inferred defaults", async () => {
    const current = workbook(); select(current, "licenses"); select(current, "training");
    const parsed = await parse(current);
    const old = workbook(); select(old, "licenses"); select(old, "training");
    const sheet = old.getWorksheet(FORM_SHEET)!;
    sheet.getCell("A205").value = CERTIFICATE_GUIDE;
    for (const entity of entities) for (let row = 0; row < blockFor(entity).rows!; row++) {
      for (const j of [1, 2]) sheet.getCell(cellLocation(blockFor(entity), j, row)).value = null;
    }
    for (let col = 52; col < 58; col++) sheet.getColumn(col).eachCell(cell => { cell.value = null; });
    const oldParsed = await parse(old);
    expect(oldParsed.errors).toEqual([]);
    expect(candidateFingerprint(parsed)).toBe(candidateFingerprint(oldParsed));
    expect(oldParsed.data.licenses[0]).not.toHaveProperty("abbr");
    sheet.getCell("E90").value = "Old explicit value";
    const manual = await parse(old);
    expect(manual.data.licenses[0].abbr).toBe("Old explicit value");
    expect(candidateFingerprint(manual)).not.toBe(candidateFingerprint(parsed));
    const v2 = createTemplateWorkbook(catalogs, LEGACY_VERSION);
    v2.getWorksheet(FORM_SHEET)!.getCell("F8").value = "Import";
    v2.getWorksheet(FORM_SHEET)!.getCell("A163").value = "Chief Engineer";
    const legacy = await parse(v2);
    expect(legacy.errors).toEqual([]);
    expect(legacy.data.licenses[0]).not.toHaveProperty("abbr");
    expect(v2.getWorksheet(FORM_SHEET)!.getCell("A1").value).not.toBe(VERSION);
  });

  it("persists defaults and overrides but not helper metadata; status/numbering and blanks remain unchanged", async () => {
    const book = workbook(); select(book, "licenses"); select(book, "training");
    book.getWorksheet(FORM_SHEET)!.getCell("I108").value = "Override";
    const parsed = await parse(book);
    const saved: { table: string; values: any }[] = [];
    const tx: any = {
      execute: vi.fn(),
      select: () => {
        const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain,
          limit: async () => [], then: (resolve: any) => resolve([{ maxNum: 17 }]) };
        return chain;
      },
      insert: (table: any) => ({ values: async (values: any) => { saved.push({ table: getTableName(table), values }); } }),
    };
    await writeCandidate(tx, parsed, "actor");
    expect(saved.find(row => row.table === "cand_licenses")!.values).toMatchObject({ licenseId: "LIC007", abbr: "CE", requirement: "Required for engineers" });
    expect(saved.find(row => row.table === "cand_training_courses")!.values).toMatchObject({ courseId: "SAF029", abbr: "CSI", requirement: "Override" });
    for (const row of saved) {
      expect(row.values).not.toHaveProperty("__certificateDefaults");
      expect(row.values).not.toHaveProperty("__certificateInput");
      expect(row.values).not.toHaveProperty("certificateNo");
    }
    expect(saved[0].values).toMatchObject({ status: "Applied", fileNo: `R-${new Date().getFullYear()}-0018` });
    expect(saved[0].values.screeningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
