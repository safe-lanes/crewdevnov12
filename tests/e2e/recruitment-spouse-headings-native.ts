// Actual spreadsheet recalculation; synthetic workbooks only, no DB writes.
// LIBREOFFICE_BIN=/path/to/soffice npx tsx tests/e2e/recruitment-spouse-headings-native.ts
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { createTemplateWorkbook } from "../../server/v2/recruitment/import/workbook";
import { parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { candidateFingerprint } from "../../server/v2/recruitment/import/persistence";

async function main() {
  const binary = process.env.LIBREOFFICE_BIN;
  assert.ok(binary, "Set LIBREOFFICE_BIN to an available soffice executable.");
  const temp = await mkdtemp(join(tmpdir(), "recruitment-spouse-"));
  const profile = join(temp, "profile");
  const output = join(temp, "recalculated");
  try {
    await mkdir(join(profile, "user"), { recursive: true });
    await mkdir(output);
    await writeFile(join(profile, "user", "registrymodifications.xcu"),
      '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry">' +
      '<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item></oor:items>');
    const fixtures = [
      { name: "blank", status: "", names: false, married: false },
      { name: "single", status: "Single", names: false, married: false },
      { name: "married-empty", status: "Married", names: false, married: true },
      { name: "married-complete", status: "Married", names: true, married: true },
      { name: "married-trimmed", status: " married ", names: true, married: true },
    ];
    const paths: string[] = [];
    const fingerprints = new Map<string, string>();
    for (const fixture of fixtures) {
      const book = createTemplateWorkbook({});
      const sheet = book.worksheets[0];
      sheet.getCell("F8").value = "Native Preview";
      sheet.getCell("F25").value = fixture.status;
      // Give non-Married fixtures stale starred caches to prove removal too.
      for (const [address, name] of [["A27", "Spouse first name"], ["A28", "Spouse family name"]]) {
        sheet.getCell(address).value = { formula: sheet.getCell(address).formula!, result: `${name} *` };
      }
      if (fixture.names) {
        sheet.getCell("F27").value = "Partner";
        sheet.getCell("F28").value = "Preview";
      }
      const bytes = Buffer.from(await book.xlsx.writeBuffer());
      fingerprints.set(fixture.name, candidateFingerprint(await parseWorkbook(bytes, {})));
      const path = join(temp, `${fixture.name}.xlsx`);
      await writeFile(path, bytes);
      paths.push(path);
    }
    console.log(execFileSync(binary, ["--headless", `-env:UserInstallation=file://${profile}`, "--convert-to",
      "xlsx:Calc MS Excel 2007 XML", "--outdir", output, ...paths], { timeout: 90000, encoding: "utf8" }).trim());
    for (const fixture of fixtures) {
      const bytes = await readFile(join(output, `${fixture.name}.xlsx`));
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes as any);
      const sheet = book.worksheets[0];
      assert.equal(sheet.getCell("A27").text, `Spouse first name${fixture.married ? " *" : ""}`);
      assert.equal(sheet.getCell("A28").text, `Spouse family name${fixture.married ? " *" : ""}`);
      assert.ok(sheet.conditionalFormattings.length >= 2, "Red required formatting survives save");
      const parsed = await parseWorkbook(bytes, {});
      assert.equal(parsed.isValid, !(fixture.married && !fixture.names), JSON.stringify(parsed.errors));
      assert.equal(candidateFingerprint(parsed), fingerprints.get(fixture.name));
      console.log(`PASS ${fixture.name}: calculated headings, validation and fingerprint preserved`);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
