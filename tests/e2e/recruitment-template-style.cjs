// Read-only smoke: downloads the actual template and validates it, never executes an import.
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");

async function main() {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  let executions = 0;
  await page.route("**/import/execute", route => route.abort());
  page.on("request", request => { if (request.url().endsWith("/import/execute")) executions++; });
  try {
    const before = await (await page.request.get(`${base}/api/v2/recruitment/candidates`)).json();
    await page.goto(`${base}/recruitment`);
    await page.getByTestId("button-import-candidate-excel").click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .xlsx template", exact: true }).click();
    const download = await downloaded;
    const bytes = await fs.readFile(await download.path());
    await fs.mkdir("generated-artifacts/recruitment", { recursive: true });
    await fs.writeFile("generated-artifacts/recruitment/Recruitment_Application_Template.xlsx", bytes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    assert.equal(workbook.worksheets.length, 1);
    const sheet = workbook.getWorksheet("APPLICATION FORM");
    const notedCells = [];
    sheet.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => {
      if (cell.note) notedCells.push(cell.address);
    }));
    assert.deepEqual(notedCells, [], "Downloaded template must not contain cell notes");
    assert.equal(sheet.getCell("A2").font.name, "Calibri");
    assert.equal(sheet.getCell("A2").font.size, 16);
    assert.equal(sheet.getCell("A2").fill.fgColor.argb, "FF808080");
    assert.equal(sheet.getCell("A5").fill.fgColor.argb, "FF808080");
    assert.equal(sheet.getCell("A47").fill.fgColor.argb, "FFE7E7E7");
    assert.equal(sheet.getCell("A8").text, "First name *");
    assert.equal(sheet.getCell("A8").value.richText[1].font.color.argb, "FFC62828");
    assert.equal(sheet.getCell("A10").text, "Gender");
    assert.equal(sheet.getCell("A27").text, "Spouse first name");
    assert.equal(sheet.getCell("Q10").text, "Vessel types applied for");
    assert.equal(sheet.getCell("V10").value, null);
    assert.equal(Boolean(sheet.getCell("V10").dataValidation.showErrorMessage), false);
    assert.equal(sheet.getCell("A5").text, "A1.1 General Particulars");
    assert.equal(sheet.getCell("A46").text, "A2.1 Travel & Identification Documents");
    assert.equal(sheet.getCell("A139").text, "A4.1 Details of Sea Service");
    assert.equal(sheet.getCell("F141").text, "IMO Number");
    assert.equal(sheet.getCell("F8").border.bottom.style, "dotted");
    assert.equal(sheet.getCell("F8").value, null);
    assert.equal(sheet.getCell("A212").value, null);
    assert.equal(sheet.getCell("A4").text.includes("Spouse fields are optional"), true);
    assert.equal(sheet.pageSetup.printArea, "A1:AF207");
    assert.equal(sheet.pageSetup.fitToHeight, 0);
    for (const address of ["E90", "I90", "E108", "I108"]) {
      assert.ok(sheet.getCell(address).formula.includes("VLOOKUP("), "Certificate defaults must autofill in Excel, not only on import");
    }
    for (let col = 52; col < 58; col++) assert.equal(sheet.getColumn(col).hidden, true);
    // Validate a filled copy in memory, leaving the delivered example blank.
    sheet.getCell("F8").value = "Template Preview";
    sheet.getCell("F25").value = "Married";
    const lookup = /^\$([A-Z]+)\$2:\$[A-Z]+\$(\d+)$/.exec(sheet.getCell("V10").dataValidation.formulae[0]);
    assert.ok(lookup, "Vessel names must remain discoverable through the dropdown");
    const names = Array.from({ length: Number(lookup[2]) - 1 }, (_, i) => sheet.getCell(`${lookup[1]}${i + 2}`).text);
    assert.ok(names.length >= 2, "Smoke requires at least two current master vessel types");
    sheet.getCell("V10").value = names.slice(0, 2).join("; ");
    const rankLookup = /^\$([A-Z]+)\$2:\$[A-Z]+\$(\d+)$/.exec(sheet.getCell("X142").dataValidation.formulae[0]);
    assert(rankLookup, "Sea-service rank must use a database dropdown");
    sheet.getCell("A142").value = "Template Preview Ship";
    sheet.getCell("F142").value = "1234567";
    sheet.getCell("I142").value = names[0];
    sheet.getCell("X142").value = sheet.getCell(`${rankLookup[1]}2`).value;
    sheet.getCell("AA142").value = "2021-01-01";
    sheet.getCell("AD142").value = "2021-04-01";
    for (const [address, manualAddress, manualName] of [
      ["A90", "A91", "Custom Port License"], ["A108", "A109", "Custom Company Workshop"],
    ]) {
      const validation = sheet.getCell(address).dataValidation;
      assert.equal(validation.type, "list");
      assert.equal(Boolean(validation.showErrorMessage), false, "Custom certificate names must not be blocked");
      const match = /^\$([A-Z]+)\$2:\$[A-Z]+\$(\d+)$/.exec(validation.formulae[0]);
      assert.ok(match, "Database certificate choices must be present");
      const option = sheet.getCell(`${match[1]}2`).text;
      assert.ok(option.includes("[DB:"), "Database options must carry a readable business reference");
      sheet.getCell(address).value = option;
      sheet.getCell(manualAddress).value = manualName;
    }
    await page.locator("#candidate-excel-file").setInputFiles({
      name: "professional-template.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    const validated = page.waitForResponse(response => response.url().endsWith("/import/validate") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Validate workbook", exact: true }).click();
    const validation = await (await validated).json();
    assert.equal(validation.isValid, true);
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.summary.A1, 4, "Candidate + Married family + two separate vessel records");
    assert.equal(validation.summary.A3, 4, "Two linked certificates plus two custom certificate rows");
    assert.equal(validation.summary.A4, 1, "Sea service with optional IMO Number validates");
    await page.getByText("Ready to import", { exact: true }).waitFor();
    const after = await (await page.request.get(`${base}/api/v2/recruitment/candidates`)).json();
    assert.deepEqual(after, before);
    assert.equal(executions, 0);
    await page.screenshot({ path: "/tmp/recruitment-template-style-dialog.png" });
    console.log(JSON.stringify({ success: true, downloadedPolishedTemplate: true, orderedSubsections: true, seaServiceWithImo: true, noCellNotes: true, multipleVesselTypes: true, marriedWithoutSpouse: true, databaseAndManualCertificates: true, dependentAutofillFormulas: true, blankExampleSaved: true, styledTemplateValidates: true, candidateDataUnchanged: true, importsExecuted: executions }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
