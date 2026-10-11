import ExcelJS from "exceljs";
import { BLOCKS, VERSION, cellLocation, type Catalogs } from "./contract";

export async function generateTemplate(catalogs: Catalogs): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "SAIL Recruitment";
  const instructions = book.addWorksheet("Instructions");
  instructions.getColumn(1).width = 110;
  [
    VERSION,
    "RECRUITMENT — APPLICATION FOR EMPLOYMENT",
    "One candidate per workbook. Fill yellow cells only. First name is required.",
    "Blank cells and entirely blank rows are ignored. Partially filled rows must satisfy their required fields.",
    "Dates: use real Excel dates or YYYY-MM-DD / DD-MMM-YYYY. Identifiers, phone and certificate numbers are text.",
    "Choose current master labels from dropdowns. Do not rename sheets, headings or add rows outside the input area.",
    "A1: Personal and family / A2: Documents and visas / A3: Education, licenses and training / A4: Sea service / A5: Additional information.",
    "Upload, review validation, then confirm. The candidate is created as Applied. No screening, file number or attachments are created.",
    "Sea-service period and age are calculated from dates. Sea-service rows must not overlap.",
    "This template does not import a photograph, bank details, clothing sizes or other unsupported reference-form fields.",
    "Download a fresh template if company master values have changed.",
  ].forEach((line, i) => { instructions.getCell(i + 1, 1).value = line; instructions.getRow(i + 1).height = 30; });
  const reference = book.addWorksheet("Reference", { state: "hidden" });
  const ranges: Record<string, string> = {};
  Object.entries(catalogs).forEach(([name, entries], index) => {
    const col = index + 1;
    const labels = [...new Set(entries.map(e => e.label))].sort();
    reference.getCell(1, col).value = name;
    labels.forEach((label, i) => { reference.getCell(i + 2, col).value = label; });
    if (labels.length) ranges[name] = `'Reference'!$${String.fromCharCode(65 + index)}$2:$${String.fromCharCode(65 + index)}$${labels.length + 1}`;
  });
  for (const block of BLOCKS) {
    let sheet = book.getWorksheet(block.sheet);
    if (!sheet) {
      sheet = book.addWorksheet(block.sheet, { views: [{ state: "frozen", ySplit: 5 }], pageSetup: { paperSize: 9, orientation: block.rows ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      sheet.getCell("A1").value = VERSION;
      sheet.mergeCells("A2:H2");
      sheet.getCell("A2").value = `APPLICATION FOR EMPLOYMENT — ${block.sheet}`;
      sheet.getCell("A2").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
      sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16324F" } };
      sheet.mergeCells("A3:H3");
      sheet.getCell("A3").value = "Fill yellow cells. Blank cells are not saved. * First name is required.";
      sheet.getRow(2).height = 32;
      sheet.getRow(3).height = 28;
      for (let c = 1; c <= 8; c++) sheet.getColumn(c).width = block.rows ? 25 : 14;
    }
    if (block.rows) {
      block.fields.forEach((field, j) => {
        const heading = sheet!.getCell(block.start - 1, j + 1);
        heading.value = field.label;
        heading.font = { bold: true, color: { argb: "FFFFFFFF" } };
        heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16324F" } };
        heading.alignment = { wrapText: true };
      });
      sheet.getRow(block.start - 1).height = 35;
    }
    for (let row = 0; row < (block.rows || 1); row++) {
      block.fields.forEach((field, j) => {
        if (!block.rows) {
          sheet!.mergeCells(`A${block.start + j}:C${block.start + j}`);
          sheet!.getCell(`A${block.start + j}`).value = field.label;
          sheet!.getCell(`A${block.start + j}`).font = { bold: true };
          sheet!.mergeCells(`D${block.start + j}:H${block.start + j}`);
          sheet!.getRow(block.start + j).height = 25;
        }
        const cell = sheet!.getCell(cellLocation(block, j, row));
        cell.numFmt = field.date ? "dd-mmm-yyyy" : "@";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
        cell.border = { bottom: { style: "thin", color: { argb: "FFCCD3DA" } }, right: { style: "thin", color: { argb: "FFCCD3DA" } } };
        if (field.choices || (field.catalog && ranges[field.catalog])) cell.dataValidation = {
          type: "list", allowBlank: true, showErrorMessage: true, errorTitle: "Select a valid value",
          error: "Choose a value from the dropdown.", formulae: [field.choices ? `"${field.choices.join(",")}"` : ranges[field.catalog!]],
        };
      });
    }
    sheet.pageSetup.printArea = `A1:H${Math.max(sheet.rowCount, block.start + (block.rows || block.fields.length))}`;
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
