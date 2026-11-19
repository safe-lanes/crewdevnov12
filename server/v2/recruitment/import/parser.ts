import ExcelJS from "exceljs";
import JSZip from "jszip";
import { VERSION, LEGACY_VERSION, isTemplateVersion, usesAlignedLayout, usesDocumentCatalog, blocksForVersion, cellLocation, labelLocation, type Catalogs, type Parsed, type ImportError } from "./contract";
import { FORM_SHEET, FORM_GUIDELINE_START, LOOKUP_START_COLUMN } from "./formLayout";
import { createTemplateWorkbook, DOCUMENT_SELECTION_GUIDE } from "./workbook";
import { WorkbookValidationError, unreadableWorkbook } from "./errors";
import { isRequiredLabel, ROW_REQUIRED, SPOUSE_REQUIRED } from "./requirements";
import { fixedText, CURRENT_LEGEND, FORM_LEGEND, PREVIOUS_LEGEND, LEGACY_LEGEND } from "./workbookStyle";
import { spouseHeadingFormula, matchesHeadingFormula } from "./conditionalHeadings";
import { parseVesselTypes } from "./vesselTypes";
import { resolveCertificate, CERTIFICATE_GUIDE, PREVIOUS_CERTIFICATE_GUIDE } from "./certificateCatalogs";
import { certificateDefaultReader, isAutofillLookup, isCertificateDefault, AUTOFILL_CERTIFICATE_GUIDE } from "./certificateAutofill";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export function decodeFile(fileData: unknown, fileName: unknown): Buffer {
  if (typeof fileName !== "string" || !/\.xlsx$/i.test(fileName)) throw new WorkbookValidationError("FILE_FORMAT", "Upload the downloaded .xlsx template (not .xls or .xlsm). Changing a file's extension does not convert it to Excel.");
  if (typeof fileData === "string" && fileData.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) throw new WorkbookValidationError("FILE_SIZE", "This workbook exceeds 5 MB. Use a smaller workbook.");
  if (typeof fileData !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(fileData)) throw new WorkbookValidationError("FILE_DATA", "The uploaded file could not be read. Choose it again and retry validation.");
  const buffer = Buffer.from(fileData, "base64");
  if (buffer.length > MAX_FILE_BYTES) throw new WorkbookValidationError("FILE_SIZE", "This workbook exceeds 5 MB. Use a smaller workbook.");
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) throw unreadableWorkbook();
  return buffer;
}

export function strictDate(value: string | Date): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  let parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  let year: number, month: number, day: number;
  if (parts) [, year, month, day] = parts.map(Number);
  else {
    parts = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
    if (!parts) return undefined;
    year = +parts[3]; day = +parts[1]; month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(parts[2].toLowerCase()) + 1;
  }
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (year! < 1900 || month! < 1 || month! > 12 || date.getUTCFullYear() !== year! || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day!) return undefined;
  return date.toISOString().slice(0, 10);
}

export async function parseWorkbook(buffer: Buffer, catalogs: Catalogs): Promise<Parsed> {
  const errors: ImportError[] = [];
  const data: Parsed["data"] = {};
  const summary: Record<string, number> = { A1: 0, A2: 0, A3: 0, A4: 0, A5: 0 };
  // Inspect ZIP sizes before ExcelJS expands XML (compressed workbook size alone is insufficient).
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer); } catch (error) { throw unreadableWorkbook(error); }
  const entries = Object.values(zip.files);
  const totalSize = entries.reduce((sum, entry) => sum + ((entry as any)._data?.uncompressedSize || 0), 0);
  if (entries.length > 250 || totalSize > 25 * 1024 * 1024 || entries.some(e => /vbaProject|externalLinks|embeddings/i.test(e.name))) throw new WorkbookValidationError("UNSUPPORTED_CONTENT", "Workbook contains unsupported content or exceeds safe workbook limits. Remove macros, external links and embedded objects, or use a fresh template.");
  if (!["[Content_Types].xml", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"].every(part => zip.file(part))
    || !entries.some(entry => /^xl\/worksheets\/[^/]+\.xml$/.test(entry.name))) throw unreadableWorkbook();
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(buffer as any); } catch (error) { throw unreadableWorkbook(error); }
  const sheet = book.getWorksheet(FORM_SHEET);
  const version = sheet?.getCell("A1").value;
  if (!sheet || !isTemplateVersion(version)) throw new WorkbookValidationError("TEMPLATE_VERSION", "Unsupported template version. Download the current single-sheet Recruitment A1–A5 template and transfer your values.");
  const legacy = version === LEGACY_VERSION;
  const blocks = blocksForVersion(version);
  if (book.worksheets.length !== 1) throw new WorkbookValidationError("EXTRA_SHEETS", "Workbook has unsupported sheets. Use only the downloaded single-sheet form.");
  const expected = createTemplateWorkbook(catalogs, version).getWorksheet(FORM_SHEET)!;
  if (JSON.stringify([...(sheet.model.merges || [])].sort()) !== JSON.stringify([...(expected.model.merges || [])].sort())) throw new WorkbookValidationError("MODIFIED_LAYOUT", "Modified form layout. Do not insert rows, move fields or change merged boxes. Download a fresh template.");
  const inputs = new Set<string>();
  for (const block of blocks) for (let row = 0; row < (block.rows || 1); row++) block.fields.forEach((_, j) => inputs.add(cellLocation(block, j, row)));
  const isLookup = (column: number) => (column >= LOOKUP_START_COLUMN && column < LOOKUP_START_COLUMN + Object.keys(catalogs).length) || (!legacy && isAutofillLookup(column));
  // Verify all fixed text once. Labels and instructions are not input data,
  // and merged aliases must not be counted as extra populated cells.
  const fixed = new Set<string>();
  const labels = new Map(blocks.flatMap(block => block.fields.map((field, j) =>
    [labelLocation(block, j), { label: field.label, required: isRequiredLabel(block.entity, field.key, legacy, version !== VERSION),
      formula: spouseHeadingFormula(block, field, version) }] as const)));
  expected.eachRow(row => row.eachCell(cell => {
    if (cell.type === ExcelJS.ValueType.Merge || inputs.has(cell.address) || isLookup(Number(cell.col)) || cell.value === null) return;
    fixed.add(cell.address);
    const actual = fixedText(sheet.getCell(cell.address).value);
    const label = labels.get(cell.address);
    const valid = label ? label.formula ? matchesHeadingFormula(sheet.getCell(cell.address).value, label.formula)
      : actual === label.label || (label.required && actual === `${label.label} *`)
      : cell.address === "A4" ? version === VERSION ? actual === CURRENT_LEGEND : legacy ? actual === PREVIOUS_LEGEND || actual === LEGACY_LEGEND : actual === FORM_LEGEND
        : cell.address === `A${usesAlignedLayout(version) ? FORM_GUIDELINE_START + 3 : 232}` ? [CERTIFICATE_GUIDE, PREVIOUS_CERTIFICATE_GUIDE, AUTOFILL_CERTIFICATE_GUIDE, ...(usesDocumentCatalog(version) ? [DOCUMENT_SELECTION_GUIDE] : [])].includes(actual!)
      : actual !== undefined && actual === fixedText(cell.value);
    if (!valid) throw new WorkbookValidationError("MODIFIED_HEADING", `Modified heading or instructions at ${cell.address}. Do not move or rename template fields.`);
  }));
  const today = new Date().toISOString().slice(0, 10);
  const readCertificateDefault = certificateDefaultReader(sheet, catalogs);
  for (const block of blocks) {
    data[block.entity] = [];
    if (!legacy && block.entity === "vesselTypes") {
      const cell = cellLocation(block, 0, 0);
      const parsed = parseVesselTypes(sheet.getCell(cell).value, catalogs, { section: block.section, sheet: FORM_SHEET, cell, field: block.fields[0].label });
      data.vesselTypes = parsed.records;
      errors.push(...parsed.errors);
      summary.A1 += parsed.records.length;
      continue;
    }
    for (let row = 0; row < (block.rows || 1); row++) {
      const record: Record<string, string> = {};
      const rowErrors: ImportError[] = [];
      const report = (key: string, message: string) => {
        const j = block.fields.findIndex(f => f.key === key);
        rowErrors.push({ section: block.section, sheet: block.sheet, cell: cellLocation(block, Math.max(j, 0), row), field: block.fields[Math.max(j, 0)].label, message });
      };
      for (let j = 0; j < block.fields.length; j++) {
        const field = block.fields[j];
        let raw = sheet.getCell(cellLocation(block, j, row)).value;
        let derivedDefault = false;
        if (!legacy && isCertificateDefault(block.entity, field.key) && typeof raw === "object" && raw !== null && !(raw instanceof Date)) {
          const derived = readCertificateDefault(block, row, field.key, record);
          if (derived.error) { report(field.key, derived.error); continue; }
          raw = derived.value ?? null;
          derivedDefault = true;
        }
        if (field.key === "email" && raw && typeof raw === "object" &&
          "text" in raw && typeof raw.text === "string" &&
          "hyperlink" in raw && typeof raw.hyperlink === "string" &&
          /^mailto:/i.test(raw.hyperlink) &&
          raw.hyperlink.slice(7) === raw.text.trim() &&
          !/[?#]/.test(raw.hyperlink.slice(7))) {
          raw = raw.text;
        }
        if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) continue;
        if (typeof raw === "object" && !(raw instanceof Date)) { report(field.key, "Use a plain value, not a formula, link or formatted object."); continue; }
        if (raw instanceof Date && Number.isNaN(raw.getTime())) { report(field.key, "Enter a valid date as YYYY-MM-DD or DD-MMM-YYYY."); continue; }
        let value = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).trim();
        record[field.key] = value; // Preserve zero and false; don't use truthiness to decide presence.
        if (derivedDefault) record.__certificateDefaults = [record.__certificateDefaults, field.key].filter(Boolean).join(",");
        let linkedMaster = false;
        if (field.documentCatalog) {
          const resolved = resolveCertificate(value, catalogs[field.documentCatalog] || []);
          if (resolved.error) report(field.key, resolved.error);
          else {
            record[field.key] = value = resolved.name;
            if (resolved.id) {
              linkedMaster = true; // Linked master names are not restricted to the manual-entry limit.
              record.documentId = resolved.id;
              record.__documentInput = resolved.fingerprintName;
            }
          }
        }
        if (field.certificateCatalog) {
          const resolved = resolveCertificate(value, catalogs[field.certificateCatalog] || []);
          if (resolved.error) report(field.key, resolved.error);
          else {
            record[field.key] = value = resolved.name;
            if (resolved.id) {
              linkedMaster = true;
              record[field.certificateCatalog === "licenses" ? "licenseId" : "courseId"] = resolved.id;
              record.__certificateInput = resolved.fingerprintName;
            }
          }
        }
        if (!linkedMaster && !derivedDefault && value.length > (field.max || 50)) report(field.key, `Maximum ${field.max || 50} characters.`);
        if (field.date) {
          const parsed = strictDate(raw instanceof Date ? raw : value);
          if (!parsed) report(field.key, "Enter a valid date as YYYY-MM-DD or DD-MMM-YYYY.");
          else {
            record[field.key] = value = parsed;
            if (!["expiry", "toDate"].includes(field.key) && value > today) report(field.key, "This date cannot be in the future.");
            if (field.key === "toDate" && value > today) report(field.key, "Sea-service end date cannot be in the future.");
            if (block.entity === "candidate" && field.key === "dob") {
              const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
              if (value > cutoff.toISOString().slice(0, 10)) report(field.key, "Crew member must be at least 18 years old.");
            }
          }
        }
        if (field.choices) {
          const match = field.choices.find(c => c.toLowerCase() === value.toLowerCase());
          if (!match) report(field.key, `Choose one of: ${field.choices.join(", ")}.`);
          else record[field.key] = match;
        }
        if (field.catalog) {
          const matches = (catalogs[field.catalog] || []).filter(c => c.label.trim().toLowerCase() === value.toLowerCase() || c.value === value);
          const unique = [...new Map(matches.map(c => [c.value, c])).values()];
          if (unique.length !== 1) report(field.key, unique.length ? "Ambiguous master value. Ask your administrator to resolve duplicate labels." : "Unknown or inactive master value. Choose a current dropdown value.");
          else record[field.key] = unique[0].value;
        }
        if ((field.key.includes("Name") || ["firstName", "middleName", "familyName"].includes(field.key)) && block.entity !== "sea" && !/^[a-zA-Z' -]+$/.test(value) && field.key !== "documentName") report(field.key, "Names may contain letters, spaces, apostrophes and hyphens only.");
        if (field.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) report(field.key, "Enter a valid email address.");
        if (["heightCm", "weightKg", "numDependentChildren"].includes(field.key) && (!/^\d+$/.test(value) || (field.key !== "numDependentChildren" && Number(value) <= 0))) report(field.key, "Enter a valid whole number.");
      }
      const present = Object.keys(record).length > 0 || rowErrors.length > 0;
      if (!present) continue;
      for (const key of ROW_REQUIRED[block.entity] || []) if (!record[key]) report(key, "Required for a populated row.");
      if (block.entity === "family" && record.maritalStatus === "Married") {
        for (const key of SPOUSE_REQUIRED) if (!record[key]) {
          report(key, `${key === "spouseFirstName" ? "Spouse first name" : "Spouse family name"} is required when Marital Status is Married.`);
        }
      }
      if (record.issued && record.expiry && record.expiry < record.issued) report("expiry", "Expiry cannot be earlier than issued date.");
      if (record.fromDate && record.toDate && record.toDate < record.fromDate) report("toDate", "End date cannot be earlier than start date.");
      // Keep workbook row identity for errors while ignoring empty rows.
      record.__row = String(row);
      data[block.entity].push(record);
      summary[block.section.split(".")[0]]++;
      errors.push(...rowErrors);
    }
  }
  sheet.eachRow(row => row.eachCell(cell => {
    if (cell.type === ExcelJS.ValueType.Merge || cell.value === null || String(cell.value).trim() === "" || isLookup(Number(cell.col)) || inputs.has(cell.address) || fixed.has(cell.address)) return;
    errors.push({ sheet: FORM_SHEET, cell: cell.address, field: "Outside input area", message: "Data is outside the designated input boxes and would not be imported. Move it into a supported form field." });
  }));
  const candidateBlock = blocks.find(b => b.entity === "candidate")!;
  if (!data.candidate[0]?.firstName) errors.push({ section: candidateBlock.section, sheet: FORM_SHEET, cell: cellLocation(candidateBlock, 0, 0), field: "First name", message: "First name is required." });
  const sea = data.sea || [];
  const block = blocks.find(b => b.entity === "sea")!;
  for (let i = 0; i < sea.length; i++) for (let j = 0; j < i; j++) {
    if (sea[i].fromDate && sea[i].toDate && sea[j].fromDate && sea[j].toDate && sea[i].fromDate < sea[j].toDate && sea[j].fromDate < sea[i].toDate) errors.push({ section: block.section, sheet: FORM_SHEET, cell: cellLocation(block, block.fields.findIndex(f => f.key === "fromDate"), Number(sea[i].__row)), field: "From", message: `Sea-service dates overlap with row ${block.start + Number(sea[j].__row) * block.rowStep}.` });
  }
  const vesselIds = new Set<string>();
  const vesselBlock = blocks.find(b => b.entity === "vesselTypes")!;
  for (const row of data.vesselTypes || []) {
    if (vesselIds.has(row.vesselTypeUuid)) errors.push({ section: vesselBlock.section, sheet: FORM_SHEET, cell: cellLocation(vesselBlock, 0, Number(row.__row)), field: "Vessel type", message: "Duplicate vessel type applied for." });
    vesselIds.add(row.vesselTypeUuid);
  }
  const candidateName = [data.candidate[0]?.firstName, data.candidate[0]?.middleName, data.candidate[0]?.familyName].filter(Boolean).join(" ");
  return { data, errors, summary, candidateName, isValid: errors.length === 0, status: "Applied" };
}
