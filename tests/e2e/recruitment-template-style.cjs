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
    assert.equal(sheet.getCell("A10").fill.fgColor.argb, "FF808080");
    assert.equal(sheet.getCell("A28").fill.fgColor.argb, "FFE7E7E7");
    assert.equal(sheet.getCell("A8").text, "First name *");
    assert.equal(sheet.getCell("A8").value.richText[1].font.color.argb, "FFC62828");
    assert.equal(sheet.getCell("A5").text, "Gender");
    assert.equal(sheet.getCell("A22").text, "Spouse first name *");
    assert.equal(sheet.getCell("F8").border.bottom.style, "dotted");
    assert.equal(sheet.getCell("F8").value, null);
    assert.equal(sheet.getCell("A212").value, null);
    assert.equal(sheet.getCell("A4").text.includes("only if Married"), true);
    assert.equal(sheet.pageSetup.printArea, "A1:AF234");
    assert.equal(sheet.pageSetup.fitToHeight, 0);
    // Validate a filled copy in memory, leaving the delivered example blank.
    sheet.getCell("F8").value = "Template Preview";
    await page.locator("#candidate-excel-file").setInputFiles({
      name: "professional-template.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    await page.getByRole("button", { name: "Validate workbook", exact: true }).click();
    await page.getByText("Ready to import", { exact: true }).waitFor();
    const after = await (await page.request.get(`${base}/api/v2/recruitment/candidates`)).json();
    assert.deepEqual(after, before);
    assert.equal(executions, 0);
    await page.screenshot({ path: "/tmp/recruitment-template-style-dialog.png" });
    console.log(JSON.stringify({ success: true, downloadedPolishedTemplate: true, noCellNotes: true, blankExampleSaved: true, styledTemplateValidates: true, candidateDataUnchanged: true, importsExecuted: executions }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
