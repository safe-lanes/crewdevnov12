import ExcelJS from "exceljs";
import { BLOCKS, VERSION, cellLocation, inputRange, type Catalogs } from "./contract";
import { FORM_SHEET, FORM_LAST_ROW, LOOKUP_START_COLUMN, columnLetter } from "./formLayout";

export function createTemplateWorkbook(catalogs: Catalogs): ExcelJS.Workbook {
  const book = new ExcelJS.Workbook();
  book.creator = "SAIL Recruitment";
  const sheet = book.addWorksheet(FORM_SHEET, {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: {
      paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printArea: `A1:AF${FORM_LAST_ROW}`, printTitlesRow: "1:4",
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
    },
    headerFooter: { oddFooter: "&CApplication for employment — Page &P of &N" },
  });
  for (let col = 1; col <= 32; col++) sheet.getColumn(col).width = 4;
  for (let row = 1; row <= FORM_LAST_ROW; row++) sheet.getRow(row).height = 23;

  function box(range: string, value: string | null, grey = false, centered = false) {
    if (range.split(":")[0] !== range.split(":")[1]) sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]);
    cell.value = value;
    cell.font = { name: "Arial", size: 10, bold: grey, color: { argb: "FF111111" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: grey ? "FFC0C0C0" : "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: centered ? "center" : "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF666666" } }, bottom: { style: grey ? "thin" : "dotted", color: { argb: "FF666666" } },
      left: { style: "thin", color: { argb: "FF666666" } }, right: { style: "thin", color: { argb: "FF666666" } },
    };
    return cell;
  }
  box("A1:P1", VERSION);
  box("Q1:AF1", "Template revision: 2 · Recruitment A1–A5", false, true);
  box("A2:AF3", "APPLICATION FOR EMPLOYMENT", true, true).font = { name: "Arial", size: 16, bold: true };
  box("A4:AB4", "Note: First name is required. Fill white input boxes; blank cells are not saved.", false, true);
  box("AC4:AF9", "Photo\nUpload separately\nNot imported", false, true).font = { name: "Arial", size: 9, color: { argb: "FF666666" } };
  [
    ["A10:P10", "Home Address / Contact — A1"], ["Q10:AF10", "Personal Details — A1"],
    ["A19:P19", "Family Details — A1"], ["Q19:AF19", "Next Of Kin's Detail — A1"],
    ["A27:AF27", "Education — A3"], ["A37:X37", "Children — A1"], ["Y37:AF37", "Vessel Types Applied For — A1"],
    ["A47:AF47", "Sea Service — A4"], ["A132:AF132", "Travel Documents — A2"],
    ["A149:AF149", "Visas — A2"], ["A161:AF161", "Licenses / DCE — A3"],
    ["A178:AF178", "Training Courses — A3"], ["A210:AF210", "Additional Information — A5"],
    ["A228:AF228", "Guidelines for Filling and Uploading"],
  ].forEach(([range, title]) => box(range, title, true, true));
  box("A26:P26", "Spouse first name and surname are required if Married.", false, true);
  box("A48:AF48", "Enter the latest sea service first, then older services below. Each record has From above To; period is calculated.", false, true);
  [
    "One candidate per workbook. Only populated cells and rows are saved. A populated row must satisfy its required fields.",
    "Dates: real Excel dates, YYYY-MM-DD or DD-MMM-YYYY. Keep phone, document and certificate numbers as text.",
    "Choose current dropdown values. Do not move cells, rename headings, insert rows or add worksheets.",
    "Required in populated rows: document type; visa country/type; qualification; license/course; child first name; information.",
    "Sea service requires vessel name/type, rank, From and To. Dates cannot overlap; age and period are calculated.",
    "Upload → validate → confirm. Status is Applied. Photos, bank details, clothing sizes and other unsupported reference fields are not imported.",
  ].forEach((text, i) => { box(`A${229 + i}:AF${229 + i}`, text); sheet.getRow(229 + i).height = 30; });

  // Lookup labels live on the same worksheet, outside printing and hidden from
  // normal form entry. Uploaded lookup values never authorize/resolve masters.
  const ranges: Record<string, string> = {};
  Object.entries(catalogs).forEach(([name, entries], index) => {
    const col = LOOKUP_START_COLUMN + index;
    const letter = columnLetter(col);
    const labels = [...new Set(entries.map(e => e.label))].sort();
    sheet.getColumn(col).hidden = true;
    sheet.getCell(1, col).value = name;
    labels.forEach((label, i) => { sheet.getCell(i + 2, col).value = label; });
    if (labels.length) ranges[name] = `$${letter}$2:$${letter}$${labels.length + 1}`;
  });
  for (const block of BLOCKS) {
    block.fields.forEach((field, j) => box(block.placements[j].label, field.label, true, !!block.rows));
    if (block.rows) {
      sheet.getRow(block.start - (block.entity === "sea" ? 2 : 1)).height = 40;
      if (block.entity === "sea") sheet.getRow(50).height = 24;
    }
    for (let row = 0; row < (block.rows || 1); row++) {
      block.fields.forEach((field, j) => {
        const cell = box(inputRange(block, j, row), null);
        cell.numFmt = field.date ? "dd-mmm-yyyy" : "@";
        cell.note = field.date ? "Use a real Excel date, YYYY-MM-DD or DD-MMM-YYYY." : "Blank values are not saved.";
        if (field.choices || (field.catalog && ranges[field.catalog])) cell.dataValidation = {
          type: "list", allowBlank: true, showErrorMessage: true, errorTitle: "Select a valid value",
          error: "Choose a value from the dropdown.", formulae: [field.choices ? `"${field.choices.join(",")}"` : ranges[field.catalog!]],
        };
        // Explicitly anchor validation on the top-left of each merged input box.
        if (cell.address !== cellLocation(block, j, row)) throw new Error("Invalid form input mapping.");
      });
    }
  }
  return book;
}

export async function generateTemplate(catalogs: Catalogs): Promise<Buffer> {
  return Buffer.from(await createTemplateWorkbook(catalogs).xlsx.writeBuffer());
}
