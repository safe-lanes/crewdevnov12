import ExcelJS from "exceljs";
import { VERSION, LEGACY_VERSION, blocksForVersion, cellLocation, inputRange, type Catalogs, type TemplateVersion } from "./contract";
import { FORM_SHEET, FORM_LAST_ROW, PREVIOUS_FORM_LAST_ROW, FORM_GUIDELINE_START, FORM_SECTION_BANDS, LOOKUP_START_COLUMN, columnLetter } from "./formLayout";
import { isRequiredLabel } from "./requirements";
import { styleBox, requiredLabel, FORM_LEGEND, PREVIOUS_LEGEND, FORM_COLORS, type BoxStyle } from "./workbookStyle";
import { certificateOption, PREVIOUS_CERTIFICATE_GUIDE } from "./certificateCatalogs";
import { writeCertificateDefaults, certificateDefaultFormula, isCertificateDefault, AUTOFILL_CERTIFICATE_GUIDE } from "./certificateAutofill";

export function createTemplateWorkbook(catalogs: Catalogs, version: TemplateVersion = VERSION): ExcelJS.Workbook {
  const legacy = version === LEGACY_VERSION;
  const aligned = version === VERSION;
  const lastRow = aligned ? FORM_LAST_ROW : PREVIOUS_FORM_LAST_ROW;
  const guidelines = aligned ? FORM_GUIDELINE_START : 229;
  const blocks = blocksForVersion(version);
  const legendText = legacy ? PREVIOUS_LEGEND : FORM_LEGEND;
  const book = new ExcelJS.Workbook();
  book.creator = "SAIL Recruitment";
  book.calcProperties.fullCalcOnLoad = true;
  const sheet = book.addWorksheet(FORM_SHEET, {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: {
      paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printArea: `A1:AF${lastRow}`, printTitlesRow: "1:4",
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
    },
    headerFooter: { oddFooter: "&CApplication for employment — Page &P of &N" },
  });
  for (let col = 1; col <= 32; col++) sheet.getColumn(col).width = 4;
  for (let row = 1; row <= lastRow; row++) sheet.getRow(row).height = 23;

  function box(range: string, value: ExcelJS.CellValue, kind: BoxStyle = "input", centered = false) {
    if (range.split(":")[0] !== range.split(":")[1]) sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]);
    cell.value = value;
    styleBox(cell, kind, centered);
    return cell;
  }
  box("A1:P1", version, "meta");
  box("Q1:AF1", `Template revision: ${aligned ? 4 : legacy ? 2 : 3} · Recruitment A1–A5`, "meta", true);
  box("A2:AF3", "APPLICATION FOR EMPLOYMENT", "title", true);
  const legend = box("A4:AB4", legendText, "note", true);
  legend.value = { richText: [
    { text: "*", font: { name: "Calibri", size: 9, bold: true, color: { argb: FORM_COLORS.required } } },
    { text: legendText.slice(1), font: { name: "Calibri", size: 9, color: { argb: FORM_COLORS.muted } } },
  ] };
  sheet.getRow(1).height = 20;
  sheet.getRow(4).height = 32;
  box(aligned ? "AC6:AF9" : "AC4:AF9", "Photo\nUpload separately\nNot imported", "note", true);
  (aligned ? FORM_SECTION_BANDS : [
    ["A10:P10", "Home Address / Contact — A1"], ["Q10:AF10", "Personal Details — A1"],
    ["A19:P19", "Family Details — A1"], ["Q19:AF19", "Next Of Kin's Detail — A1"],
    ["A27:AF27", "Education — A3"],
    ...(legacy ? [["A37:X37", "Children — A1"], ["Y37:AF37", "Vessel Types Applied For — A1"]] : [["A37:AF37", "Children — A1"]]),
    ["A47:AF47", "Sea Service — A4"], ["A132:AF132", "Travel Documents — A2"],
    ["A149:AF149", "Visas — A2"], ["A161:AF161", "Licenses / DCE — A3"],
    ["A178:AF178", "Training Courses — A3"], ["A210:AF210", "Additional Information — A5"],
    ["A228:AF228", "Guidelines for Filling and Uploading"],
  ]).forEach(([range, title]) => { box(range, title, "section", true); sheet.getRow(Number(range.match(/\d+/)![0])).height = 26; });
  if (aligned) box("A7:AB7", "File No, submitted date, age and service periods are assigned or calculated on import.", "note", true);
  box(aligned ? "A29:AF29" : "A26:P26", legacy ? "Spouse first name and surname are required if Married." : "Spouse details are optional, including when Married.", "note", true);
  box(aligned ? "A140:AF140" : "A48:AF48", aligned
    ? "Enter the latest sea service first, then older services below. IMO Number is optional; periods are calculated on import."
    : "Enter the latest sea service first, then older services below. Each record has From above To; period is calculated.", "note", true);
  [
    "One candidate per workbook. Only populated cells and rows are saved. A populated row must satisfy its required fields.",
    "Dates: real Excel dates, YYYY-MM-DD or DD-MMM-YYYY. Keep phone, document and certificate numbers as text.",
    legacy ? "Choose current dropdown values. Do not move cells, rename headings, insert rows or add worksheets."
      : "Vessel types: up to 8 names separated by ; (e.g. Bulk Carrier; Oil Tanker). Dropdown shows names; type multiple names manually. Keep the layout unchanged.",
    legacy ? PREVIOUS_CERTIFICATE_GUIDE : AUTOFILL_CERTIFICATE_GUIDE,
    "Sea service requires vessel name/type, rank, From and To. Dates cannot overlap; age and period are calculated.",
    "Upload → validate → confirm. Status is Applied. Photos, bank details, clothing sizes and other unsupported reference fields are not imported.",
  ].forEach((text, i) => { box(`A${guidelines + i}:AF${guidelines + i}`, text, "note"); sheet.getRow(guidelines + i).height = 30; });

  // Lookup labels live on the same worksheet, outside printing and hidden from
  // normal form entry. Uploaded lookup values never authorize/resolve masters.
  const ranges: Record<string, string> = {};
  Object.entries(catalogs).forEach(([name, entries], index) => {
    const col = LOOKUP_START_COLUMN + index;
    const letter = columnLetter(col);
    const labels = [...new Set(entries.map(e => name === "licenses" || name === "training" ? certificateOption(e) : e.label))].sort();
    sheet.getColumn(col).hidden = true;
    sheet.getCell(1, col).value = name;
    labels.forEach((label, i) => { sheet.getCell(i + 2, col).value = label; });
    if (labels.length) ranges[name] = `$${letter}$2:$${letter}$${labels.length + 1}`;
  });
  if (!legacy) writeCertificateDefaults(sheet, catalogs);
  for (const block of blocks) {
    block.fields.forEach((field, j) => {
      box(block.placements[j].label,
        isRequiredLabel(block.entity, field.key, legacy) ? requiredLabel(field.label) : field.label, "label", !!block.rows);
    });
    if (block.rows && (legacy || block.entity !== "vesselTypes")) {
      sheet.getRow(block.start - (block.entity === "sea" && !aligned ? 2 : 1)).height = aligned && block.entity === "sea" ? 54 : 40;
      if (block.entity === "sea" && !aligned) sheet.getRow(50).height = 24;
    }
    for (let row = 0; row < (block.rows || 1); row++) {
      if (aligned && block.entity === "sea") sheet.getRow(block.start + row).height = 44;
      block.fields.forEach((field, j) => {
        const cell = box(inputRange(block, j, row), null);
        cell.numFmt = field.date ? "dd-mmm-yyyy" : "@";
        if (!legacy && isCertificateDefault(block.entity, field.key)) {
          cell.value = { formula: certificateDefaultFormula(block, row, field.key), result: "" };
          cell.numFmt = "General";
        }
        const catalog = field.certificateCatalog || field.catalog;
        if (field.choices || (catalog && ranges[catalog])) cell.dataValidation = {
          type: "list", allowBlank: true, showErrorMessage: !field.certificateCatalog && (legacy || block.entity !== "vesselTypes"), errorTitle: "Select a valid value",
          error: "Choose a value from the dropdown.", formulae: [field.choices ? `"${field.choices.join(",")}"` : ranges[catalog!]],
          ...(field.certificateCatalog ? {
            showInputMessage: true, promptTitle: "Database or manual entry",
            prompt: "Select a database option to link this record and fill abbreviation/requirement, or type a custom name and details. Defaults can be replaced or cleared.",
          } : {}),
        };
        // Explicitly anchor validation on the top-left of each merged input box.
        if (cell.address !== cellLocation(block, j, row)) throw new Error("Invalid form input mapping.");
      });
    }
  }
  if (!legacy) {
    sheet.getRow(aligned ? 10 : 5).height = 48;
    sheet.getRow(guidelines + 2).height = 44;
    sheet.getRow(guidelines + 3).height = 60;
  }
  return book;
}

export async function generateTemplate(catalogs: Catalogs): Promise<Buffer> {
  return Buffer.from(await createTemplateWorkbook(catalogs).xlsx.writeBuffer());
}
