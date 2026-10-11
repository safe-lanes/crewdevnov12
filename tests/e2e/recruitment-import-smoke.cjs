// Explicit opt-in smoke test against the existing development workflow.
// Creates one synthetic candidate and records its UUID for the paired cleanup script.
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");

async function main() {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  let uuid;
  try {
    await page.goto(`${base}/recruitment`);
    await page.getByTestId("button-import-candidate-excel").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .xlsx template" }).click();
    const download = await downloadPromise;
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(await download.path());
    const suffix = Date.now().toString().replace(/[0-9]/g, c => String.fromCharCode(65 + Number(c)));
    const name = `ExcelImport${suffix}`;
    const personal = book.getWorksheet("A1 Personal");
    personal.getCell("D6").value = name;
    personal.getCell("D8").value = "Test";
    personal.getCell("D10").value = "1990-01-01";
    const reference = book.getWorksheet("Reference");
    const rank = reference.getCell("F2").value;
    const vesselType = reference.getCell("D2").value;
    personal.getCell("D13").value = rank;
    book.getWorksheet("A1 Family").getCell("D7").value = "0";
    book.getWorksheet("A2 Documents").getCell("A6").value = "Passport";
    book.getWorksheet("A2 Documents").getCell("B6").value = `SMOKE${Date.now()}`;
    book.getWorksheet("A3 Education").getCell("D6").value = "Test Qualification";
    const sea = book.getWorksheet("A4 Sea Service");
    [["A6", "Test Vessel"], ["B6", vesselType], ["F6", rank], ["G6", "2021-01-01"], ["H6", "2021-04-01"]].forEach(([cell, value]) => { sea.getCell(cell).value = value; });
    book.getWorksheet("A5 Additional").getCell("A6").value = "Test Information";
    book.getWorksheet("A5 Additional").getCell("B6").value = false;
    const bytes = Buffer.from(await book.xlsx.writeBuffer());
    await page.locator("#candidate-excel-file").setInputFiles({ name: "filled.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes });
    await page.getByRole("button", { name: "Validate workbook" }).click();
    await page.getByText("Ready to import", { exact: true }).waitFor();
    const before = await page.request.get(`${base}/api/v2/recruitment/candidates`);
    assert(!(await before.json()).some(c => c.firstName === name), "Preview must not create candidate");
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith("/import/execute") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Confirm & import candidate", exact: true }).click(),
    ]);
    const result = await response.json();
    assert.equal(response.status(), 201, JSON.stringify(result));
    uuid = result.recCanUuid;
    await fs.writeFile("/tmp/recruitment-browser-test-uuid.txt", uuid);
    assert.equal(result.status, "Applied");
    await page.getByRole("heading", { name: "Candidate imported", exact: true }).waitFor();
    await page.getByRole("button", { name: "Open Candidate", exact: true }).click();
    await page.waitForURL(`**/recruitment/${uuid}`, { timeout: 10000 }).catch(async error => {
      await page.screenshot({ path: "/tmp/recruitment-import-open-failure.png" });
      console.error("Current URL after Open Candidate:", page.url());
      throw error;
    });
    await page.locator('[data-testid="text-first-name"]').waitFor();
    assert.equal(await page.locator('[data-testid="text-first-name"]').textContent(), name);
    // Existing collection tables render values in inputs even in read mode.
    for (const [section, key, expected] of [
      ["education", "qualifications", "Test Qualification"],
      ["sea-service", "vesselName", "Test Vessel"],
      ["additional-info", "response", "false"],
    ]) {
      const rows = await (await page.request.get(`${base}/api/v2/recruitment/candidates/${uuid}/${section}`)).json();
      assert(rows.some(row => row[key] === expected), `${section} must retain the imported value`);
    }
    const duplicate = await page.request.post(`${base}/api/v2/recruitment/import/execute`, { data: { fileData: bytes.toString("base64"), fileName: "filled.xlsx", auditUserUuid: null } });
    assert.equal(duplicate.status(), 409);
    const candidate = await (await page.request.get(`${base}/api/v2/recruitment/candidates/${uuid}`)).json();
    assert.equal(candidate.status, "Applied");
    assert(!candidate.fileNo);
    assert(!candidate.screeningDate);
    await page.screenshot({ path: "/tmp/recruitment-import-form.png" });
    console.log(JSON.stringify({ success: true, uuid, status: candidate.status, duplicateStatus: duplicate.status() }));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
