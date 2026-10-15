import ExcelJS from "exceljs";
import { cellLocation, type Block, type Catalogs } from "./contract";
import { columnLetter } from "./formLayout";
import { certificateOption, type CertificateCatalog } from "./certificateCatalogs";

type DefaultField = "abbr" | "requirement";
const START = { licenses: 52, training: 55 }; // AZ:BB and BC:BE, hidden on the same sheet.
const MAX_ITEMS = 10000;
const defaults = (entry: Catalogs[string][number], key: DefaultField) => entry[key] ?? "";
export const AUTOFILL_CERTIFICATE_GUIDE = "Required in populated rows: document type; visa country/type; qualification; license/course; child first name; information. License/course: select a database option to autofill abbreviation/requirement, or type a custom name and details. You may replace or clear defaults.";
export const isAutofillLookup = (column: number) => column >= START.licenses && column < START.training + 3;
export const isCertificateDefault = (entity: string, key: string): key is DefaultField =>
  (entity === "licenses" || entity === "training") && (key === "abbr" || key === "requirement");

export function certificateDefaultFormula(block: Block, row: number, key: DefaultField): string {
  const start = START[block.entity as CertificateCatalog];
  const nameCell = cellLocation(block, 0, row).replace(/^([A-Z]+)/, "$$$1");
  const range = `$${columnLetter(start)}$2:$${columnLetter(start + 2)}$${MAX_ITEMS + 1}`;
  const lookup = `SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${nameCell},"~","~~"),"*","~*"),"?","~?")`;
  // &"" prevents Excel rendering empty master values as numeric zero.
  return `IFERROR(IF(${nameCell}="","",VLOOKUP(${lookup},${range},${key === "abbr" ? 2 : 3},FALSE)&""),"")`;
}

export function writeCertificateDefaults(sheet: ExcelJS.Worksheet, catalogs: Catalogs): void {
  for (const entity of ["licenses", "training"] as const) {
    const entries = [...new Map((catalogs[entity] || []).map(entry => [certificateOption(entry), entry])).values()]
      .sort((a, b) => certificateOption(a).localeCompare(certificateOption(b)));
    if (entries.length > MAX_ITEMS) throw new Error(`The ${entity} catalog exceeds the ${MAX_ITEMS}-item Excel autofill limit.`);
    const start = START[entity];
    ["option", "abbr", "requirement"].forEach((key, i) => {
      sheet.getColumn(start + i).hidden = true;
      sheet.getCell(1, start + i).value = `${entity}:${key}`;
    });
    entries.forEach((entry, i) => {
      [certificateOption(entry), defaults(entry, "abbr"), defaults(entry, "requirement")].forEach((value, j) => {
        sheet.getCell(i + 2, start + j).value = value;
      });
    });
  }
}

// Uploaded lookups are evidence of what the spreadsheet displayed, never the
// source of saved data. Build an index once, not once for each of the 90 cells.
export function certificateDefaultReader(sheet: ExcelJS.Worksheet, catalogs: Catalogs) {
  const snapshots = new Map<string, { abbr: unknown; requirement: unknown }[]>();
  for (const entity of ["licenses", "training"] as const) {
    const start = START[entity];
    sheet.getColumn(start).eachCell((cell, row) => {
      if (row < 2 || row > MAX_ITEMS + 1 || typeof cell.value !== "string") return;
      const key = `${entity}:${cell.value.toLowerCase()}`;
      snapshots.set(key, [...(snapshots.get(key) || []), {
        abbr: sheet.getCell(row, start + 1).value,
        requirement: sheet.getCell(row, start + 2).value,
      }]);
    });
  }
  return (block: Block, row: number, key: DefaultField, record: Record<string, string>):
    { value?: string; error?: string } => {
    const field = block.fields.findIndex(field => field.key === key);
    const cell = sheet.getCell(cellLocation(block, field, row));
    let formula: string | undefined;
    try { formula = cell.formula; } catch { /* Broken shared-formula references are invalid below. */ }
    const expected = certificateDefaultFormula(block, row, key);
    // LibreOffice saves the FALSE constant as FALSE(). Accept precisely this
    // equivalent expression, not arbitrary functions or rewritten references.
    const valid = formula === expected || formula === expected.replace(",FALSE)", ",FALSE())");
    if (cell.type !== ExcelJS.ValueType.Formula || !valid) {
      return { error: "Only the original template autofill formula is allowed here. Restore it from a fresh template, or enter a plain value." };
    }
    const entity = block.entity as CertificateCatalog;
    const id = record[entity === "licenses" ? "licenseId" : "courseId"];
    const selected = sheet.getCell(cellLocation(block, 0, row)).value;
    if (!id || typeof selected !== "string") return {}; // Empty/custom name: blank-result formula is not data.
    const matches = (catalogs[entity] || []).filter(entry => entry.value === id &&
      certificateOption(entry).toLowerCase() === selected.toLowerCase());
    // Plain typed names can still link as before, but only a dropdown option
    // matches the spreadsheet lookup and therefore supplies dependent defaults.
    if (!matches.length) return {};
    const live = defaults(matches[0], key);
    const snapshot = snapshots.get(`${entity}:${selected.toLowerCase()}`) || [];
    if (snapshot.length !== 1 || (snapshot[0][key] ?? "") !== live || matches.some(entry => defaults(entry, key) !== live)) {
      return { error: `The database ${key === "abbr" ? "abbreviation" : "requirement"} has changed, or its template lookup was modified. Download a fresh template and reselect the database option, or enter an intentional manual value.` };
    }
    // Ignore cached formula results, including forged/stale caches.
    return { value: live.trim() || undefined };
  };
}
