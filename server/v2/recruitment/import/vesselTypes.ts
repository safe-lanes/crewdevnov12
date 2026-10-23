import type ExcelJS from "exceljs";
import type { Catalogs, ImportError } from "./contract";

// One current-layout cell expands into the same records used by older row-based forms.
export function parseVesselTypes(raw: ExcelJS.CellValue, catalogs: Catalogs, location: Omit<ImportError, "message">) {
  const records: Record<string, string>[] = [];
  const errors: ImportError[] = [];
  const report = (message: string) => errors.push({ ...location, message });
  if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) return { records, errors };
  if (typeof raw !== "string") {
    report("Enter plain vessel-type names separated by semicolons, not a formula, link or formatted object.");
    return { records, errors };
  }
  const names = raw.split(";").map(name => name.trim());
  if (names.length > 8) {
    report("Enter no more than 8 vessel types, separated by semicolons.");
    return { records, errors };
  }
  const seen = new Set<string>();
  names.forEach((name, index) => {
    if (!name) { report("Enter a vessel-type name between semicolons; remove empty entries."); return; }
    if (name.length > 50) { report(`Vessel type ${index + 1}: maximum 50 characters per name.`); return; }
    const matches = (catalogs.vesselTypes || []).filter(entry =>
      entry.label.trim().toLowerCase() === name.toLowerCase() || entry.value === name);
    const unique = [...new Map(matches.map(entry => [entry.value, entry])).values()];
    if (unique.length !== 1) {
      report(unique.length
        ? `Ambiguous vessel type "${name}". Ask your administrator to resolve duplicate labels.`
        : `Unknown or inactive vessel type "${name}". Choose a current dropdown name.`);
      return;
    }
    const value = unique[0].value;
    if (seen.has(value)) { report(`Duplicate vessel type applied for: "${name}".`); return; }
    seen.add(value);
    records.push({ vesselTypeUuid: value, __row: String(index) });
  });
  return { records, errors };
}
