// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { getTableName } from "drizzle-orm";
import { v5 } from "uuid";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint, cleanRecord, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import { BLOCKS, LEGACY_VERSION, DOCUMENT_VERSION, VERSION, blocksForVersion, cellLocation, type Catalogs, type TemplateVersion } from "../../server/v2/recruitment/import/contract";
import { FORM_SHEET } from "../../server/v2/recruitment/import/formLayout";
import { certificateOption, resolveCertificate, PREVIOUS_CERTIFICATE_GUIDE } from "../../server/v2/recruitment/import/certificateCatalogs";
import { hasCertificateDatabaseId } from "../../client/src/modules/recruitment/certificateBinding";

vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));
const catalogs: Catalogs = {
  countries: [{ label: "India", value: "country-uuid" }],
  licenses: [{ label: "Chief Engineer", value: "LIC007" }],
  training: [{ label: "Company Safety Induction", value: "SAF029" }],
};
const nameKey = (entity: string) => entity === "licenses" ? "certificateDocument" : "trainingCourse";
async function read(rows: Record<string, Record<string, any>[]>, options: {
  version?: TemplateVersion; source?: Catalogs; live?: Catalogs; edit?: (sheet: ExcelJS.Worksheet) => void;
} = {}) {
  const book = createTemplateWorkbook(options.source || catalogs, options.version || VERSION);
  const sheet = book.getWorksheet(FORM_SHEET)!;
  sheet.getCell("F8").value = "Import";
  for (const [entity, records] of Object.entries(rows)) {
    const block = blocksForVersion(options.version || VERSION).find(b => b.entity === entity)!;
    records.forEach((record, row) => Object.entries(record).forEach(([key, value]) => {
      sheet.getCell(cellLocation(block, block.fields.findIndex(f => f.key === key), row)).value = value;
    }));
  }
  options.edit?.(sheet);
  return parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), options.live || catalogs);
}

describe("Excel database and manual certificates", () => {
  it("keeps non-blocking list validations on all 45 license/training name inputs after XLSX roundtrip", async () => {
    const book = new ExcelJS.Workbook();
    const bytes = Buffer.from(await createTemplateWorkbook(catalogs).xlsx.writeBuffer());
    await book.xlsx.load(bytes as any);
    expect(book.worksheets).toHaveLength(1);
    const sheet = book.getWorksheet(FORM_SHEET)!;
    for (const entity of ["licenses", "training"]) {
      const block = BLOCKS.find(b => b.entity === entity)!;
      for (let row = 0; row < block.rows!; row++) {
        const cell = sheet.getCell(cellLocation(block, 0, row));
        expect(cell.dataValidation.type).toBe("list");
        expect(Boolean(cell.dataValidation.showErrorMessage)).toBe(false);
        expect(cell.dataValidation.allowBlank).toBe(true);
        const [column, end] = /^\$([A-Z]+)\$2:\$[A-Z]+\$(\d+)$/.exec(cell.dataValidation.formulae![0])!.slice(1);
        expect(Number(end)).toBe(2);
        expect(sheet.getCell(`${column}2`).text).toBe(certificateOption(catalogs[entity][0]));
        expect(sheet.getColumn(column).hidden).toBe(true);
        expect(cell.note).toBeUndefined();
      }
    }
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).some(path => /comments|vmlDrawing/i.test(path))).toBe(false);
    expect(sheet.getCell("A205").text).toContain("type a custom name");
  });

  it("retains revision 5 selections, custom rows and historical issuing country without filling unrelated details", async () => {
    const parsed = await read({
      licenses: [{ certificateDocument: certificateOption(catalogs.licenses[0]), certificateNo: "0007", issuingCountryUuid: "India" }, {}, { certificateDocument: "Local Harbor License", abbr: "LHL" }],
      training: [{ trainingCourse: certificateOption(catalogs.training[0]), requirement: "User requirement" }, {}, { trainingCourse: "Custom Company Workshop", issued: "2020-01-01" }],
    }, { version: DOCUMENT_VERSION });
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary.A3).toBe(4);
    expect(parsed.data.licenses.map(cleanRecord)).toEqual([
      { certificateDocument: "Chief Engineer", licenseId: "LIC007", certificateNo: "0007", issuingCountryUuid: "country-uuid" },
      { certificateDocument: "Local Harbor License", abbr: "LHL" },
    ]);
    expect(parsed.data.training.map(cleanRecord)).toEqual([
      { trainingCourse: "Company Safety Induction", courseId: "SAF029", requirement: "User requirement" },
      { trainingCourse: "Custom Company Workshop", issued: "2020-01-01" },
    ]);
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
    const uuid = await writeCandidate(tx, parsed, "actor");
    const licenses = saved.filter(row => row.table === "cand_licenses").map(row => row.values);
    const training = saved.filter(row => row.table === "cand_training_courses").map(row => row.values);
    expect(licenses[0]).toMatchObject({ licenseId: "LIC007", certificateDocument: "Chief Engineer", recCanUuid: uuid, certificateNo: "0007", sortOrder: 0 });
    expect(licenses[1]).not.toHaveProperty("licenseId");
    expect(training[0]).toMatchObject({ courseId: "SAF029", trainingCourse: "Company Safety Induction", requirement: "User requirement" });
    expect(training[1]).not.toHaveProperty("courseId");
    for (const row of [...licenses, ...training]) {
      expect(row).not.toHaveProperty("__certificateInput");
      expect(row).not.toHaveProperty("__row");
    }
    expect(licenses[0]).not.toHaveProperty("abbr");
    expect(training[0]).not.toHaveProperty("certificateNo");
    expect(training[0]).not.toHaveProperty("expiry");
    expect(saved[0].values).toMatchObject({ status: "Applied", fileNo: `R-${new Date().getFullYear()}-0018` });
    expect(saved[0].values.screeningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each([VERSION, LEGACY_VERSION])("preserves pre-dropdown typed name fingerprints and supported headings for %s", async version => {
    const parsed = await read({ licenses: [{ certificateDocument: "chief engineer", abbr: "Typed" }], training: [{ trainingCourse: "company safety induction" }] },
      { version, edit: sheet => { sheet.getCell(version === VERSION ? "A205" : "A232").value = PREVIOUS_CERTIFICATE_GUIDE; } });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.licenses[0]).toMatchObject({ licenseId: "LIC007", certificateDocument: "Chief Engineer" });
    // Recreate the exact historical algorithm, before derived association fields.
    const oldData = structuredClone(parsed.data);
    for (const entity of ["licenses", "training"]) {
      for (const record of oldData[entity]) {
        record[nameKey(entity)] = record.__certificateInput;
        delete record.__certificateInput;
        delete record[entity === "licenses" ? "licenseId" : "courseId"];
      }
    }
    const historical = v5(JSON.stringify(BLOCKS.map(block => (oldData[block.entity] || []).map(record =>
      Object.fromEntries(Object.entries(record).filter(([key, value]) => key !== "__row" && value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "")))
    ))), "bf5b954d-4b5a-4c9f-91d6-dc413ed620c1");
    expect(candidateFingerprint(parsed)).toBe(historical);
  });

  it("makes current dropdown selections retry-compatible with the same canonical names in older templates", async () => {
    const plain = await read({ licenses: [{ certificateDocument: "Chief Engineer" }], training: [{ trainingCourse: "Company Safety Induction" }] });
    const selected = await read({ licenses: [{ certificateDocument: certificateOption(catalogs.licenses[0]) }], training: [{ trainingCourse: certificateOption(catalogs.training[0]) }] });
    expect(candidateFingerprint(plain)).toBe(candidateFingerprint(selected));
  });

  it.each(["licenses", "training"])("disambiguates duplicate %s names and preserves distinct master identities", async entity => {
    const live = { ...catalogs, [entity]: [{ label: "Same Name", value: "CODE-A" }, { label: "Same Name", value: "CODE-B" }] };
    const ambiguous = await read({ [entity]: [{ [nameKey(entity)]: "Same Name" }] }, { source: live, live });
    expect(ambiguous.isValid).toBe(false);
    expect(ambiguous.errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining("More than one"), cell: entity === "licenses" ? "A90" : "A108" }));
    const a = await read({ [entity]: [{ [nameKey(entity)]: certificateOption(live[entity][0]) }] }, { source: live, live });
    const b = await read({ [entity]: [{ [nameKey(entity)]: certificateOption(live[entity][1]) }] }, { source: live, live });
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    expect(a.data[entity][0][entity === "licenses" ? "licenseId" : "courseId"]).toBe("CODE-A");
    expect(b.data[entity][0][entity === "licenses" ? "licenseId" : "courseId"]).toBe("CODE-B");
    expect(candidateFingerprint(a)).not.toBe(candidateFingerprint(b));
  });

  it.each(["licenses", "training"])("rejects stale, renamed and forged %s options instead of making manual rows", async entity => {
    const option = certificateOption(catalogs[entity][0]);
    for (const entries of [[], [{ ...catalogs[entity][0], label: "Renamed" }], [{ ...catalogs[entity][0], value: "new-business-id" }]]) {
      const parsed = await read({ [entity]: [{ [nameKey(entity)]: option }] }, { live: { ...catalogs, [entity]: entries } });
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors.some(error => error.message.includes("no longer available"))).toBe(true);
    }
    const forged = await read({ [entity]: [{ [nameKey(entity)]: "Forged [DB:made-up]" }] }, {
      edit: sheet => {
        const original = sheet.getCell(entity === "licenses" ? "A90" : "A108").dataValidation.formulae![0];
        const col = /^\$([A-Z]+)\$/.exec(original)![1];
        sheet.getCell(`${col}2`).value = "Forged [DB:made-up]";
      },
    });
    expect(forged.isValid).toBe(false);
    expect(forged.errors.some(error => error.message.includes("no longer available"))).toBe(true);
  });

  it("accepts long live names without treating the readable database suffix as user field length", async () => {
    const entry = { label: "Advanced safety and survival training for officers in international maritime operations", value: "TRAINING-123" };
    const live = { ...catalogs, training: [entry] };
    const parsed = await read({ training: [{ trainingCourse: certificateOption(entry) }] }, { source: live, live });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.training[0]).toMatchObject({ courseId: entry.value, trainingCourse: entry.label });
  });

  it("continues to report names missing from partially populated certificate rows", async () => {
    const parsed = await read({ licenses: [{ certificateNo: "0007" }], training: [{ abbr: "PARTIAL" }] });
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContainEqual(expect.objectContaining({ cell: "A90", field: "Certificate / document", message: "Required for a populated row." }));
    expect(parsed.errors).toContainEqual(expect.objectContaining({ cell: "A108", field: "Training course", message: "Required for a populated row." }));
  });

  it("does not infer a database reference from a bare business code or a custom abbreviation", () => {
    expect(resolveCertificate("LIC007", catalogs.licenses)).toEqual({ name: "LIC007", fingerprintName: "LIC007" });
    expect(hasCertificateDatabaseId(null, "license")).toBe(false);
    expect(hasCertificateDatabaseId("LIC-123", "license")).toBe(false);
    expect(hasCertificateDatabaseId("TRN-123", "training")).toBe(false);
    expect(hasCertificateDatabaseId("NEW-LIVE-LICENSE", "license")).toBe(true);
    expect(hasCertificateDatabaseId("SAF029", "training")).toBe(true);
    expect(hasCertificateDatabaseId("", "training")).toBe(false);
  });

  it("fails conflicting business codes rather than picking a catalog row", () => {
    const entries = [{ label: "A", value: "DUP" }, { label: "B", value: "DUP" }];
    expect(resolveCertificate("A", entries).error).toContain("more than one");
    expect(resolveCertificate("A [DB:DUP]", entries).error).toContain("ambiguous");
  });
});
