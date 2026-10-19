// Real spreadsheet-engine verification with synthetic catalogs; no database writes.
// LIBREOFFICE_BIN=/path/to/soffice npx tsx tests/e2e/recruitment-certificate-autofill-native.ts
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint } from "../../server/v2/recruitment/import/persistence";
import { FORM_SHEET } from "../../server/v2/recruitment/import/formLayout";
import { certificateOption } from "../../server/v2/recruitment/import/certificateCatalogs";
import type { Catalogs } from "../../server/v2/recruitment/import/contract";

const catalogs: Catalogs = {
  licenses: [
    { label: "Chief Engineer", value: "LIC007", abbr: "CE", requirement: "Engineering officers" },
    { label: "Deck Officer", value: "LIC008", abbr: "DO", requirement: "Deck officers" },
  ],
  training: [
    { label: "Company Safety *?", value: "SAF029", abbr: "CSI", requirement: "Company requirement" },
    { label: "Company Induction", value: "SAF030", abbr: "IND", requirement: "Before joining" },
  ],
};
async function main() {
  const binary = process.env.LIBREOFFICE_BIN;
  assert.ok(binary, "Set LIBREOFFICE_BIN to an available LibreOffice/soffice executable.");
  const temp = await mkdtemp(join(tmpdir(), "recruitment-autofill-"));
  const output = join(temp, "recalculated");
  await mkdir(output);
  // Calc otherwise defaults to retaining caches in externally generated XLSX
  // files. Force calculation in this isolated test profile, as an edit would.
  const profile = join(temp, "profile");
  await mkdir(join(profile, "user"), { recursive: true });
  await writeFile(join(profile, "user", "registrymodifications.xcu"),
    '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry">' +
    '<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item></oor:items>');
  const fixtures: { name: string; book: ExcelJS.Workbook; catalogs: Catalogs; expected: string[] }[] = [];
  const add = (name: string, source = catalogs) => {
    const book = createTemplateWorkbook(source);
    const sheet = book.getWorksheet(FORM_SHEET)!;
    sheet.getCell("F8").value = "Native Preview";
    const fixture = { name, book, catalogs: source, expected: ["", "", "", ""] };
    fixtures.push(fixture);
    return { fixture, sheet };
  };
  const linked = add("linked");
  linked.sheet.getCell("A90").value = certificateOption(catalogs.licenses[0]);
  linked.sheet.getCell("A108").value = certificateOption(catalogs.training[0]);
  linked.fixture.expected = ["CE", "Engineering officers", "CSI", "Company requirement"];
  const changed = add("changed");
  changed.sheet.getCell("A90").value = certificateOption(catalogs.licenses[1]);
  changed.sheet.getCell("A108").value = certificateOption(catalogs.training[1]);
  for (const address of ["E90", "I90", "E108", "I108"]) {
    const cell = changed.sheet.getCell(address);
    cell.value = { formula: cell.formula!, result: "OLD DEFAULT" };
  }
  changed.fixture.expected = ["DO", "Deck officers", "IND", "Before joining"];
  const cleared = add("cleared");
  for (const address of ["E90", "I90", "E108", "I108"]) {
    const cell = cleared.sheet.getCell(address);
    cell.value = { formula: cell.formula!, result: "OLD DEFAULT" };
  }
  const manual = add("manual");
  manual.sheet.getCell("A90").value = "Custom License";
  manual.sheet.getCell("A108").value = "Custom Training";
  ["E90", "I90", "E108", "I108"].forEach((address, i) => { manual.sheet.getCell(address).value = `Manual ${i}`; });
  manual.fixture.expected = ["Manual 0", "Manual 1", "Manual 2", "Manual 3"];
  const wildcard = add("wildcard");
  wildcard.sheet.getCell("A90").value = "*";
  wildcard.sheet.getCell("A108").value = "?";
  const missing = add("missing", {
    licenses: [{ ...catalogs.licenses[0], abbr: null, requirement: "" }],
    training: [{ ...catalogs.training[0], abbr: "", requirement: null }],
  });
  missing.sheet.getCell("A90").value = certificateOption(catalogs.licenses[0]);
  missing.sheet.getCell("A108").value = certificateOption(catalogs.training[0]);
  const long = add("long", {
    ...catalogs, training: [{ ...catalogs.training[0], requirement: "Company-specific long requirement ".repeat(4).trim() }],
  });
  long.sheet.getCell("A108").value = certificateOption(catalogs.training[0]);
  long.fixture.expected = ["", "", "CSI", long.fixture.catalogs.training[0].requirement!];
  try {
    const paths: string[] = [];
    const before = new Map<string, string>();
    for (const fixture of fixtures) {
      const path = join(temp, `${fixture.name}.xlsx`);
      const bytes = Buffer.from(await fixture.book.xlsx.writeBuffer());
      const parsed = await parseWorkbook(bytes, fixture.catalogs);
      assert.equal(parsed.isValid, true, JSON.stringify(parsed.errors));
      before.set(fixture.name, candidateFingerprint(parsed));
      await writeFile(path, bytes); paths.push(path);
    }
    const engine = execFileSync(binary, [
      "--headless", `-env:UserInstallation=file://${profile}`,
      "--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", output, ...paths,
    ], { timeout: 90000, encoding: "utf8" });
    console.log(engine.trim());
    for (const fixture of fixtures) {
      const bytes = await readFile(join(output, `${fixture.name}.xlsx`));
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes as any);
      const sheet = book.getWorksheet(FORM_SHEET)!;
      const computed = ["E90", "I90", "E108", "I108"].map(address => {
        const cell = sheet.getCell(address);
        return String(cell.type === ExcelJS.ValueType.Formula ? cell.result ?? "" : cell.value ?? "");
      });
      assert.deepEqual(computed, fixture.expected, `${fixture.name}: real spreadsheet calculation`);
      const parsed = await parseWorkbook(bytes, fixture.catalogs);
      if (!parsed.isValid) console.error(JSON.stringify({
        case: fixture.name, spreadsheetFormula: sheet.getCell("E90").formula,
        generatedFormula: fixture.book.getWorksheet(FORM_SHEET)!.getCell("E90").formula,
      }));
      assert.equal(parsed.isValid, true, `${fixture.name}: ${JSON.stringify(parsed.errors.slice(0, 3))}`);
      assert.equal(candidateFingerprint(parsed), before.get(fixture.name), `${fixture.name}: spreadsheet recalculation must not alter retry identity`);
      if (fixture.name === "cleared") {
        assert.equal(parsed.data.licenses.length, 0); assert.equal(parsed.data.training.length, 0);
      }
      for (let col = 52; col < 58; col++) assert.equal(sheet.getColumn(col).hidden, true);
    }
    console.log(JSON.stringify({ success: true, nativeSpreadsheetEngine: true, cases: fixtures.map(fixture => fixture.name),
      calculationAndImportVerified: true, fingerprintsPreserved: true, databaseWrites: 0 }));
  } finally { await rm(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
