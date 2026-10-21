// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { getTableName } from "drizzle-orm";
import { v5 } from "uuid";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { VERSION, DOCUMENT_VERSION, ALIGNED_VERSION, PREVIOUS_VERSION, LEGACY_VERSION, blocksForVersion, cellLocation, type Catalogs, type TemplateVersion } from "../../server/v2/recruitment/import/contract";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint, cleanRecord, writeCandidate } from "../../server/v2/recruitment/import/persistence";
vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));

const catalogs: Catalogs = {
  countries: [{ label: "India", value: "country-uuid" }],
  travelDocuments: [{ label: "Passport", value: "DOC001" }, { label: "Seaman Book", value: "DOC002" }],
};
async function read(names: ExcelJS.CellValue[], options: {
  version?: TemplateVersion; live?: Catalogs; edit?: (sheet: ExcelJS.Worksheet) => void;
} = {}) {
  const version = options.version || VERSION;
  const book = createTemplateWorkbook(catalogs, version), sheet = book.worksheets[0];
  sheet.getCell("F8").value = "Synthetic";
  const block = blocksForVersion(version).find(b => b.entity === "documents")!;
  names.forEach((name, row) => { sheet.getCell(cellLocation(block, 0, row)).value = name; });
  options.edit?.(sheet);
  return parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), options.live || catalogs);
}

describe("Recruitment Excel A2.1 database and manual documents", () => {
  it("roundtrips non-blocking database dropdowns on all 15 name inputs without cell comments or changed language inputs", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await createTemplateWorkbook(catalogs).xlsx.writeBuffer()) as any);
    const sheet = book.worksheets[0];
    for (let row = 48; row < 63; row++) {
      const cell = sheet.getCell(`A${row}`);
      expect(cell.dataValidation).toMatchObject({ type: "list", allowBlank: true, showInputMessage: true });
      expect(Boolean(cell.dataValidation.showErrorMessage)).toBe(false);
      expect(cell.dataValidation.prompt).toContain("custom document name");
      const [column] = cell.dataValidation.formulae![0].match(/[A-Z]+/)!;
      expect(sheet.getCell(`${column}2`).value).toBe("Passport [DB:DOC001]");
      expect(cell.note).toBeUndefined();
    }
    expect(sheet.getCell("V15").dataValidation?.type).toBe("any");
    expect(sheet.pageSetup.printArea).toBe("A1:AF207");
    expect(sheet.getCell("A205").text).toContain("Document type: choose a database option");
  });

  it("persists linked and manual rows and leading zeros without adding removed or blank fields", async () => {
    const parsed = await read(["Passport [DB:DOC001]", "Custom Port Pass", null, "Seaman Book [DB:DOC002]"], {
      edit: sheet => {
        sheet.getCell("I48").value = "00123";
        sheet.getCell("V15").value = "Hindi, French";
      },
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary.A2).toBe(3);
    expect(parsed.data.documents[0]).toMatchObject({ documentName: "Passport", documentId: "DOC001", number: "00123" });
    expect(parsed.data.documents[0]).not.toHaveProperty("issuingCountryUuid");
    expect(cleanRecord(parsed.data.documents[1])).toEqual({ documentName: "Custom Port Pass" });
    expect(parsed.data.documents[2]).toMatchObject({ documentId: "DOC002", __row: "3" });
    expect(parsed.data.personal[0].foreignLanguages).toBe("Hindi, French");
    const saved: { table: string; values: any }[] = [];
    const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain,
      limit: async () => [], then: (resolve: any) => resolve([{ maxNum: 17 }]) };
    const tx = { execute: vi.fn(), select: () => chain,
      insert: (table: any) => ({ values: async (values: any) => { saved.push({ table: getTableName(table), values }); } }) };
    await writeCandidate(tx, parsed, "actor");
    const documents = saved.filter(row => row.table === "cand_documents").map(row => row.values);
    expect(documents).toHaveLength(3);
    expect(documents[0]).toMatchObject({ documentId: "DOC001", documentName: "Passport", number: "00123", createdByUuid: "actor" });
    expect(documents[0]).not.toHaveProperty("__documentInput");
    expect(documents[0]).not.toHaveProperty("issued");
    expect(documents[0]).not.toHaveProperty("issuingAuthority");
    expect(documents[0]).not.toHaveProperty("issuingCountryUuid");
    expect(documents[1]).not.toHaveProperty("documentId");
    expect(documents[2].sortOrder).toBe(3);
    expect(saved.find(row => row.table === "recruitment_candidates_v2")!.values).toMatchObject({ status: "Applied", fileNo: expect.stringMatching(/-0018$/), screeningDate: expect.any(String) });
  });

  it.each([
    ["removed", "Passport [DB:DOC001]", []],
    ["renamed", "Passport [DB:DOC001]", [{ label: "New Passport", value: "DOC001" }]],
    ["wrong name", "Forged [DB:DOC001]", catalogs.travelDocuments],
    ["wrong code", "Passport [DB:internal-uuid]", catalogs.travelDocuments],
    ["malformed code", "Passport [DB:DOC001", catalogs.travelDocuments],
    ["reused code", "Passport [DB:DOC001]", [{ label: "Passport", value: "DOC001" }, { label: "Other", value: "DOC001" }]],
    ["ambiguous name", "Passport", [{ label: "Passport", value: "DOC001" }, { label: "Passport", value: "DOC009" }]],
  ] as const)("rejects %s selections using the live server catalog", async (_case, value, entries) => {
    const parsed = await read([value], { live: { ...catalogs, travelDocuments: [...entries] } });
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContainEqual(expect.objectContaining({ section: "A2.1", cell: "A48", field: "Document type", message: expect.stringMatching(/database|dropdown/i) }));
  });

  it("does not trust uploaded hidden catalog cells", async () => {
    const parsed = await read(["Forged [DB:FAKE]"], {
      edit: sheet => { sheet.getCell("AI2").value = "Forged [DB:FAKE]"; },
    });
    expect(parsed.isValid).toBe(false);
    expect(parsed.data.documents[0]).not.toHaveProperty("documentId");
  });

  it("distinguishes equal database names by business code", async () => {
    const live = { ...catalogs, travelDocuments: [{ label: "Passport", value: "DOC001" }, { label: "Passport", value: "DOC009" }] };
    const first = await read(["Passport [DB:DOC001]"], { live });
    const second = await read(["Passport [DB:DOC009]"], { live });
    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(first.data.documents[0].documentId).toBe("DOC001");
    expect(second.data.documents[0].documentId).toBe("DOC009");
    expect(candidateFingerprint(first)).not.toBe(candidateFingerprint(second));
  });

  it.each([LEGACY_VERSION, PREVIOUS_VERSION, ALIGNED_VERSION])("freezes %s text semantics and historical retry fingerprints", async version => {
    const historical = await read(["passport"], { version });
    const current = await read(["passport"]);
    expect(historical.errors).toEqual([]);
    expect(historical.data.documents[0]).not.toHaveProperty("documentId");
    expect(current.data.documents[0].documentId).toBe("DOC001");
    expect(candidateFingerprint(current)).toBe(candidateFingerprint(historical));
    const values = blocksForVersion(version).map(block => (historical.data[block.entity] || []).map(cleanRecord));
    expect(candidateFingerprint(historical)).toBe(v5(JSON.stringify(values), "bf5b954d-4b5a-4c9f-91d6-dc413ed620c1"));
    const frozen = await read(["Passport [DB:unknown]"], { version });
    expect(frozen.data.documents[0].documentName).toBe("Passport [DB:unknown]");
    expect(frozen.data.documents[0]).not.toHaveProperty("documentId");
    const sheet = createTemplateWorkbook(catalogs, version).worksheets[0];
    const block = blocksForVersion(version).find(b => b.entity === "documents")!;
    expect(sheet.getCell(cellLocation(block, 0, 0)).dataValidation?.type).toBeUndefined();
  });

  it("normalizes a unique dropdown selection to the historical plain-name retry identity", async () => {
    expect(candidateFingerprint(await read(["Passport [DB:DOC001]"]))).toBe(candidateFingerprint(await read(["Passport"], { version: ALIGNED_VERSION })));
    const parsed = await read([]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.documents).toEqual([]);
    expect(parsed.summary.A2).toBe(0);
  });

  it("rejects document formulas and validates only populated detail rows", async () => {
    const formula = await read([{ formula: '"Passport"', result: "Passport" }]);
    expect(formula.errors).toContainEqual(expect.objectContaining({ cell: "A48", message: expect.stringContaining("not a formula") }));
    const partial = await read([], { edit: sheet => { sheet.getCell("I48").value = "00123"; } });
    expect(partial.errors).toContainEqual(expect.objectContaining({ section: "A2.1", cell: "A48", message: "Required for a populated row." }));
  });
});
