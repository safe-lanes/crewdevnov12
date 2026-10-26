import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { generateImportTemplate } from "../../../../server/v2/crew-pool/services/importTemplate";

vi.mock("../../../../server/v2/db", () => {
  const data = [{ name: "Synthetic reference" }];
  const query = { where: () => query, then: (resolve: any) => Promise.resolve(data).then(resolve) };
  return { getDb: () => ({ select: () => ({ from: () => query }) }) };
});

describe("crew template shared formula compatibility", () => {
  it("retains all attachment cells, relative formulas, formatting and protection after XLSX round-trip", async () => {
    const workbook = new ExcelJS.Workbook();
    const bytes = await generateImportTemplate();
    await workbook.xlsx.load(bytes);
    const sheets = workbook.worksheets.filter(s => (s.getRow(1).values as ExcelJS.CellValue[]).includes("Attachment Ref"));
    expect(sheets).toHaveLength(10);
    for (const sheet of sheets) {
      const column = (sheet.getRow(1).values as ExcelJS.CellValue[]).indexOf("Attachment Ref");
      const first = sheet.getCell(3, column);
      expect(first.formula).toContain("COUNTIF($A$3:$A3,$A3)");
      expect(first.formula).toContain("SUBSTITUTE(");
      for (const row of [4, 100, 30002]) {
        expect(sheet.getCell(row, column).formula)
          .toContain(`COUNTIF($A$3:$A${row},$A${row})`);
        expect(sheet.getCell(row, column).value).toHaveProperty("sharedFormula", first.address);
      }
      expect(sheet.getCell(30002, column).protection?.locked).not.toBe(false);
      expect(sheet.getCell(30002, 1).protection.locked).toBe(false);
      expect((sheet as any).sheetProtection.sheet).toBe(true);
    }
    // ExcelJS's reader does not retain calcPr; assert the actual emitted XML.
    const archive = await JSZip.loadAsync(bytes);
    expect(await archive.file("xl/workbook.xml")!.async("string")).toContain('fullCalcOnLoad="1"');
  });
});
