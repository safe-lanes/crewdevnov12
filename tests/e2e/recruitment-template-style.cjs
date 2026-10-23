// Read-only smoke: downloads the actual template and validates it, never executes an import.
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
require("tsx/cjs");
const { mapApiResponseToVisaCountries, mergeWithDefaultCountries } = require("../../shared/visaCountryTemplates.ts");

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
    assert.equal(sheet.getCell("A1").value, "Recruitment A1-A5 / 7 — Single sheet");
    assert.equal(sheet.getCell("Q21").text, "Residential Address Line 2 (City, State, PIN)");
    assert.equal(sheet.getCell("A22").text, "Contact Landline");
    assert.equal(sheet.getCell("A47").text, "Document *");
    assert.equal(sheet.getCell("A31").text, "First name");
    assert.equal(sheet.getCell("A184").text, "Information");
    const visaResponse = await page.request.get(`${base}/api/v2/masters/data/001/entries`);
    assert.equal(visaResponse.ok(), true);
    const visaChoices = mergeWithDefaultCountries(mapApiResponseToVisaCountries(await visaResponse.json()));
    const visaRule = sheet.getCell("A66").dataValidation;
    assert.equal(visaRule.type, "list");
    const visaColumn = visaRule.formulae[0].match(/[A-Z]+/)[0];
    assert.deepEqual(visaChoices.map((_, i) => sheet.getCell(`${visaColumn}${i + 2}`).text),
      [...new Set(visaChoices.map(c => c.name))], "Visa choices must match the application's complete live list");
    sheet.getCell("A66").value = "United States";
    sheet.getCell("Y66").value = "Work";
    sheet.getCell("A67").value = "Schengen";
    sheet.getCell("Y67").value = "Tourist";
    assert.deepEqual(["A78", "I78", "Q78", "Y78"].map(c => sheet.getCell(c).text),
      ["Qualifications *", "Subjects/Field", "School/College/University", "Date of Completion"]);
    sheet.getCell("A79").value = "Degree";
    sheet.getCell("I79").value = "Navigation";
    sheet.getCell("Q79").value = "Maritime College";
    sheet.getCell("Y79").value = "2010-01-01";
    const languageResponse = await page.request.get(`${base}/api/v2/masters/languages`);
    assert.equal(languageResponse.ok(), true);
    const languagePayload = await languageResponse.json();
    const languages = languagePayload.languages || languagePayload;
    const expectedLanguages = [...new Set(languages.map(row => row.languageName || row.name).filter(Boolean))].sort();
    const languageValidation = sheet.getCell("V15").dataValidation;
    assert.equal(Boolean(languageValidation.showErrorMessage), false);
    assert.equal(languageValidation.showInputMessage, true);
    assert.ok(languageValidation.prompt.includes("For multiple languages, manually enter names separated by commas, e.g. French, Spanish."));
    if (expectedLanguages.length) {
      assert.equal(languageValidation.type, "list");
      const match = /^\$([A-Z]+)\$2:\$[A-Z]+\$(\d+)$/.exec(languageValidation.formulae[0]);
      assert.ok(match);
      const actualLanguages = Array.from({ length: Number(match[2]) - 1 }, (_, i) => sheet.getCell(`${match[1]}${i + 2}`).text);
      assert.deepEqual(actualLanguages, expectedLanguages, "Excel language names must match the web selector's live source");
    } else assert.equal(languageValidation.type, "any");
    sheet.getCell("V15").value = "French, Spanish";
    const documentValidation = sheet.getCell("A48").dataValidation;
    assert.equal(documentValidation.type, "list");
    assert.equal(Boolean(documentValidation.showErrorMessage), false);
    assert.equal(documentValidation.showInputMessage, true);
    const documentColumn = documentValidation.formulae[0].match(/[A-Z]+/)[0];
    const documentOption = sheet.getCell(`${documentColumn}2`).value;
    assert.match(documentOption, / \[DB:[^\]]+\]$/);
    sheet.getCell("A48").value = documentOption;
    sheet.getCell("I48").value = "001234";
    sheet.getCell("A49").value = "Custom Preview Port Pass";
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
    assert.equal(sheet.getCell("Q10").text, "Vessel Type");
    assert.equal(sheet.getCell("V10").value, null);
    assert.equal(Boolean(sheet.getCell("V10").dataValidation.showErrorMessage), false);
    assert.equal(sheet.getCell("A5").text, "A1.1 General Particulars");
    assert.equal(sheet.getCell("A46").text, "A2.1 Travel & Identification Documents");
    assert.equal(sheet.getCell("A139").text, "A4.1 Details of Sea Service");
    assert.equal(sheet.getCell("F141").text, "IMO Number");
    assert.equal(sheet.getCell("F8").border.bottom.style, "dotted");
    assert.equal(sheet.getCell("F8").value, null);
    assert.equal(sheet.getCell("A212").value, null);
    assert.equal(sheet.getCell("A4").text.includes("required only if Married"), true);
    assert.equal(sheet.pageSetup.printArea, "A1:AF207");
    assert.equal(sheet.pageSetup.fitToHeight, 0);
    for (const address of ["H90", "L90", "H108", "L108"]) {
      assert.ok(sheet.getCell(address).formula.includes("VLOOKUP("), "Certificate defaults must autofill in Excel, not only on import");
    }
    for (let col = 52; col < 58; col++) assert.equal(sheet.getColumn(col).hidden, true);
    // Validate a filled copy in memory, leaving the delivered example blank.
    sheet.getCell("F8").value = "Template Preview";
    sheet.getCell("F25").value = "Married";
    const missingSpouseResponse = await page.request.post(`${base}/api/v2/recruitment/import/validate`, {
      data: { fileName: "missing-spouse.xlsx", fileData: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64") },
    });
    assert.equal(missingSpouseResponse.ok(), true);
    const missingSpouse = await missingSpouseResponse.json();
    assert.equal(missingSpouse.isValid, false);
    assert.deepEqual(missingSpouse.errors.map(error => error.cell), ["F27", "F28"]);
    sheet.getCell("F27").value = "Partner";
    sheet.getCell("F28").value = "Preview";
    sheet.getCell("O32").value = "Child";
    sheet.getCell("Q185").value = "Available";
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
    assert.equal(validation.summary.A1, 6, "Candidate + language details + Married family + two vessels + child without First Name");
    assert.equal(validation.summary.A3, 5, "Education plus two linked certificates and two custom certificate rows");
    assert.equal(validation.summary.A4, 1, "Sea service with optional IMO Number validates");
    assert.equal(validation.summary.A2, 4, "Database/manual documents plus master-bound and Schengen visas validate");
    assert.equal(validation.summary.A5, 1, "Response-only additional-information row validates");
    await page.getByText("Ready to import", { exact: true }).waitFor();
    const after = await (await page.request.get(`${base}/api/v2/recruitment/candidates`)).json();
    assert.deepEqual(after, before);
    assert.equal(executions, 0);
    await page.screenshot({ path: "/tmp/recruitment-template-style-dialog.png" });
    console.log(JSON.stringify({ success: true, downloadedPolishedTemplate: true, orderedSubsections: true, seaServiceWithImo: true, noCellNotes: true, multipleVesselTypes: true, marriedWithSpouseNamesOnly: true, databaseAndManualCertificates: true, dependentAutofillFormulas: true, blankExampleSaved: true, styledTemplateValidates: true, candidateDataUnchanged: true, importsExecuted: executions }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
