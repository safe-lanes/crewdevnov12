// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import { getTableName } from "drizzle-orm";
import { VERSION, DOCUMENT_VERSION, ALIGNED_VERSION, PREVIOUS_VERSION, LEGACY_VERSION, blocksForVersion, cellLocation, type TemplateVersion } from "../../server/v2/recruitment/import/contract";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint, cleanRecord, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import { visaCountryCatalog } from "../../server/v2/recruitment/import/visaCountries";
import { mapApiResponseToVisaCountries, mergeWithDefaultCountries, DEFAULT_VISA_COUNTRIES } from "../../client/src/utils/data/visaCountryTemplates";
import { masterLabel, masterReference } from "../../client/src/modules/recruitment/masterLabels";

vi.mock("../../server/v2/db", () => ({ getDb: vi.fn() }));
const countryUuid = "11111111-1111-4111-8111-111111111111";
const entries = [{ id: 9, name: "Indian" }, { id: 10, name: "Atlantis", nuid: "not-a-country-uuid" }];
const countries = [{ label: "INDIA", value: countryUuid }];
const catalogs = { countries, visaCountries: visaCountryCatalog(entries, countries) };
const versions = [LEGACY_VERSION, PREVIOUS_VERSION, ALIGNED_VERSION, DOCUMENT_VERSION, VERSION] as const;
function form(version: TemplateVersion = VERSION) {
  const book = createTemplateWorkbook(catalogs, version), sheet = book.worksheets[0];
  const set = (entity: string, values: Record<string, ExcelJS.CellValue>, row = 0) => {
    const block = blocksForVersion(version).find(b => b.entity === entity)!;
    for (const [key, value] of Object.entries(values)) {
      const j = block.fields.findIndex(f => f.key === key);
      if (j < 0) throw new Error(`Unknown ${entity}.${key}`);
      sheet.getCell(cellLocation(block, j, row)).value = value;
    }
  };
  set("candidate", { firstName: "Synthetic" });
  return { book, sheet, set };
}
const parse = async (book: ExcelJS.Workbook, live = catalogs) => parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), live);
function txRecorder() {
  const saved: { table: string; values: any }[] = [];
  const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain, limit: async () => [],
    then: (resolve: any) => resolve([{ maxNum: 17 }]) };
  return { saved, tx: { execute: vi.fn(), select: () => chain,
    insert: (table: any) => ({ values: async (values: any) => { saved.push({ table: getTableName(table), values }); } }) } };
}

describe("Recruitment template revision 6 fields and visa countries", () => {
  it("uses the web's complete predefined list and priority order without storing presentation IDs", () => {
    expect(catalogs.visaCountries.map(c => c.label)).toEqual(
      mergeWithDefaultCountries(mapApiResponseToVisaCountries(entries)).map(c => c.name));
    expect(catalogs.visaCountries.map(c => c.label).slice(0, 6))
      .toEqual(["United States", "Schengen", "United Kingdom", "China", "Australia", "India"]);
    expect(catalogs.visaCountries).toContainEqual({ label: "India", value: countryUuid });
    expect(catalogs.visaCountries).toContainEqual({ label: "Atlantis", value: "Atlantis" });
    expect(catalogs.visaCountries).toContainEqual({ label: "Schengen", value: "Schengen" });
    expect(visaCountryCatalog([], countries).map(c => c.label)).toEqual(
      mergeWithDefaultCountries([]).map(c => c.name));
    expect(catalogs.visaCountries).toHaveLength(DEFAULT_VISA_COUNTRIES.length + 1);
  });

  it("roundtrips all visa choices in the generated dropdown in web priority order", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await createTemplateWorkbook(catalogs).xlsx.writeBuffer()) as any);
    const sheet = book.worksheets[0];
    const rule = sheet.getCell("A66").dataValidation;
    expect(rule.type).toBe("list");
    const [column] = rule.formulae![0].match(/[A-Z]+/)!;
    expect(sheet.getColumn(column).hidden).toBe(true);
    expect(catalogs.visaCountries.map((_, i) => sheet.getCell(`${column}${i + 2}`).text))
      .toEqual(catalogs.visaCountries.map(c => c.label));
    expect(sheet.getCell("Q1").text).toContain(`revision: ${VERSION.match(/\/ (\d+)/)![1]}`);
  });

  it("has only application fields and correctly ordered Education columns without orphan boxes", () => {
    const { sheet } = form();
    const columns = (entity: string) => {
      const block = blocksForVersion(VERSION).find(b => b.entity === entity)!;
      return block.fields.map((f, j) => ({ field: f.key, cell: sheet.getCell(block.placements[j].label.split(":")[0]) }))
        .sort((a, b) => Number(a.cell.col) - Number(b.cell.col));
    };
    expect(columns("documents").map(c => c.field)).toEqual(["documentName", "number", "issued", "expiry", "issuingAuthority"]);
    expect(columns("visas").map(c => c.field)).toEqual(["countryUuid", "serialNo", "issued", "expiry", "visaType"]);
    for (const entity of ["licenses", "training"]) {
      expect(columns(entity).map(c => c.field)).toEqual([
        entity === "licenses" ? "certificateDocument" : "trainingCourse",
        "abbr", "requirement", "certificateNo", "issuingAuthority", "issued", "expiry",
      ]);
    }
    expect(columns("education").map(c => c.cell.text)).toEqual([
      "Qualifications *", "Subjects/Field", "School/College/University", "Date of Completion",
    ]);
    expect(sheet.getCell("Y79").numFmt).toBe("dd-mmm-yyyy");
    for (const entity of ["documents", "visas", "licenses", "training", "education"]) {
      const cells = columns(entity).map(c => Number(c.cell.col));
      expect(cells[0]).toBe(1);
      // Each visible column starts directly after the previous merged box.
      const block = blocksForVersion(VERSION).find(b => b.entity === entity)!;
      const ranges = block.placements.map(p => p.label).sort((a, b) => Number(sheet.getCell(a.split(":")[0]).col) - Number(sheet.getCell(b.split(":")[0]).col));
      ranges.forEach((range, i) => {
        const end = Number(sheet.getCell(range.split(":")[1]).col);
        expect(end).toBe(i === ranges.length - 1 ? 32 : cells[i + 1] - 1);
      });
    }
  });

  it("persists countries, education and sparse rows correctly and reloads readable visa labels", async () => {
    const { book, set } = form();
    set("visas", { countryUuid: " india ", visaType: "Work", serialNo: "0001" });
    set("visas", { countryUuid: "Schengen", visaType: "Tourist" }, 2);
    set("education", { qualifications: "Degree", subjectsField: "Engineering", institution: "Maritime College", dateOfCompletion: "2010-02-03" });
    set("education", { qualifications: "Diploma" }, 3);
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data.visas.map(cleanRecord)).toEqual([
      { countryUuid, serialNo: "0001", visaType: "Work" }, { countryUuid: "Schengen", visaType: "Tourist" },
    ]);
    expect(parsed.data.education[0]).toMatchObject({
      qualifications: "Degree", subjectsField: "Engineering", institution: "Maritime College", dateOfCompletion: "2010-02-03",
    });
    expect(cleanRecord(parsed.data.education[1])).toEqual({ qualifications: "Diploma" });
    const { tx, saved } = txRecorder();
    await writeCandidate(tx, parsed, "actor");
    const visas = saved.filter(r => r.table === "cand_visas").map(r => r.values);
    expect(visas.map(v => v.sortOrder)).toEqual([0, 2]);
    for (const visa of visas) {
      expect(visa).not.toHaveProperty("source");
      const options = countries.map(c => ({ id: c.value, label: c.label }));
      const shown = masterLabel(visa.countryUuid, options, "country");
      expect(shown).not.toContain("Unresolved");
      expect(masterReference(shown, options)).toBe(visa.countryUuid);
    }
    const education = saved.filter(r => r.table === "cand_education").map(r => r.values);
    expect(education[1].sortOrder).toBe(3);
    expect(education[1]).not.toHaveProperty("dateOfCompletion");
  });

  it.each(versions.filter(v => v !== VERSION))("retains removed populated inputs and original mappings in %s", async version => {
    const { book, set } = form(version);
    set("documents", { documentName: "Custom Pass", issuingCountryUuid: "INDIA" });
    set("visas", { countryUuid: "INDIA", visaType: "Work", source: "manual" });
    set("licenses", { certificateDocument: "Custom License", issuingCountryUuid: "INDIA" });
    set("training", { trainingCourse: "Custom Course", issuingCountryUuid: "INDIA" });
    const parsed = await parse(book);
    expect(parsed.errors).toEqual([]);
    const { tx, saved } = txRecorder();
    await writeCandidate(tx, parsed, "actor");
    for (const entity of ["documents", "licenses", "training"]) {
      expect(parsed.data[entity][0].issuingCountryUuid).toBe(countryUuid);
      expect(saved.find(r => r.table === `cand_${entity === "training" ? "training_courses" : entity}`)!.values.issuingCountryUuid).toBe(countryUuid);
    }
    expect(parsed.data.visas[0].source).toBe("manual");
    expect(saved.find(r => r.table === "cand_visas")!.values.source).toBe("manual");
  });

  it("keeps fingerprints equal across all revisions when removed fields are empty", async () => {
    const fingerprints = [];
    for (const version of versions) {
      const { book, set } = form(version);
      set("visas", { countryUuid, visaType: "Work" });
      set("education", { dateOfCompletion: "2010-01-01", institution: "College", subjectsField: "Navigation", qualifications: "Degree" });
      set("documents", { documentName: "Custom Pass", number: "0001", issued: "2010-01-01", expiry: "2030-01-01", issuingAuthority: "Authority" });
      set("licenses", { certificateDocument: "Custom License", abbr: "CL", requirement: "Optional", certificateNo: "001" });
      const parsed = await parse(book);
      expect(parsed.errors).toEqual([]);
      fingerprints.push(candidateFingerprint(parsed));
    }
    expect(new Set(fingerprints).size).toBe(1);
    const { book, set } = form(DOCUMENT_VERSION);
    set("visas", { countryUuid, visaType: "Work" });
    const withoutSource = candidateFingerprint(await parse(book));
    set("visas", { source: "manual" });
    expect(candidateFingerprint(await parse(book))).not.toBe(withoutSource);
  });

  it("ignores uploaded lookup forgery, rejects unknown countries and flags ambiguous masters", async () => {
    const { book, sheet, set } = form();
    const column = sheet.getCell("A66").dataValidation.formulae![0].match(/[A-Z]+/)![0];
    sheet.getCell(`${column}2`).value = "Forged Country";
    set("visas", { countryUuid: "Forged Country", visaType: "Work" });
    expect((await parse(book)).errors).toContainEqual(expect.objectContaining({ cell: "A66", message: expect.stringContaining("Unknown") }));
    set("visas", { countryUuid: "India", visaType: "Work" });
    const ambiguous = { ...catalogs, visaCountries: visaCountryCatalog(entries, [...countries, { label: "India", value: "second-uuid" }]) };
    expect((await parse(book, ambiguous)).errors).toContainEqual(expect.objectContaining({ cell: "A66", message: expect.stringContaining("Ambiguous") }));
    set("visas", { countryUuid: "Atlantis", visaType: "Work" });
    const stale = { ...catalogs, visaCountries: visaCountryCatalog([], countries) };
    expect((await parse(book, stale)).errors).toContainEqual(expect.objectContaining({ cell: "A66", message: expect.stringContaining("Unknown") }));
  });

  it("still validates completion dates and populated-row qualifications at their new cells", async () => {
    const { book, set } = form();
    set("education", { dateOfCompletion: "2010-02-30", institution: "College" });
    const parsed = await parse(book);
    expect(parsed.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ cell: "Y79", field: "Date of Completion", message: expect.stringContaining("valid date") }),
      expect.objectContaining({ cell: "A79", field: "Qualifications", message: "Required for a populated row." }),
    ]));
  });
});
