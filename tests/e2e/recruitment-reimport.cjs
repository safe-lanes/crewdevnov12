// Explicit development browser check; pair with recruitment-reimport-cleanup.ts.
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");

async function main() {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`, uuids = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const endpoint = uuid => `${base}/api/v2/recruitment/candidates/${uuid}`;
  const getCandidate = async uuid => (await page.request.get(endpoint(uuid))).json();
  const nextNumber = async () => (await (await page.request.get(`${base}/api/v2/recruitment/candidates/next-file-number`)).json()).fileNo;
  const close = async () => page.getByRole("button", { name: "Close import dialog", exact: true }).click();
  const importFile = async (bytes, expected = 201) => {
    await page.getByTestId("button-import-candidate-excel").click();
    await page.locator("#candidate-excel-file").setInputFiles({
      name: "crew1.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes,
    });
    const beforePreview = await nextNumber();
    await page.getByRole("button", { name: "Validate workbook", exact: true }).click();
    await page.getByText("Ready to import", { exact: true }).waitFor();
    assert.equal(await nextNumber(), beforePreview, "Preview is read-only");
    const done = page.waitForResponse(response => response.url().endsWith("/import/execute") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm & import candidate", exact: true }).click();
    const response = await done, result = await response.json();
    if (response.status() === 201) {
      uuids.push(result.recCanUuid);
      await fs.writeFile("/tmp/recruitment-reimport-uuids.json", JSON.stringify(uuids));
    }
    assert.equal(response.status(), expected, JSON.stringify(result));
    if (expected === 201) {
      await page.getByRole("heading", { name: "Candidate imported", exact: true }).waitFor();
      const candidate = await getCandidate(result.recCanUuid);
      assert.equal(candidate.fileNo, beforePreview);
      assert.equal(candidate.status, "Applied");
      assert(/^\d{4}-\d{2}-\d{2}$/.test(candidate.screeningDate));
      return candidate;
    }
    await page.getByRole("alert").waitFor();
    assert.equal(result.code, "DUPLICATE_IMPORT");
    assert((await page.getByRole("alert").textContent()).includes("active candidate"));
    assert(await page.getByRole("button", { name: "Confirm & import candidate", exact: true }).isDisabled());
    assert.equal(await nextNumber(), beforePreview, "Active duplicate must not allocate a number");
  };
  const deleteThroughUi = async uuid => {
    page.once("dialog", dialog => dialog.accept());
    const removed = page.waitForResponse(response => response.url() === endpoint(uuid) && response.request().method() === "DELETE");
    await page.getByTestId(`button-delete-${uuid}`).click();
    assert.equal((await removed).status(), 200);
    await page.getByTestId(`button-delete-${uuid}`).waitFor({ state: "detached" });
    assert.equal((await page.request.get(endpoint(uuid))).status(), 404);
  };
  try {
    await fs.writeFile("/tmp/recruitment-reimport-uuids.json", "[]");
    await page.goto(`${base}/recruitment`);
    await page.getByTestId("button-import-candidate-excel").click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .xlsx template", exact: true }).click();
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(await (await download).path());
    const name = `ExcelImportReupload${Date.now().toString().replace(/[0-9]/g, c => String.fromCharCode(65 + Number(c)))}`;
    const form = book.getWorksheet("APPLICATION FORM");
    form.getCell("F8").value = name;
    form.getCell("F7").value = "Test";
    form.getCell("F9").value = "Original";
    form.getCell("V7").value = "1990-01-01";
    const bytes = Buffer.from(await book.xlsx.writeBuffer());
    await close();
    let current = await importFile(bytes);
    await close();
    await deleteThroughUi(current.recCanUuid);
    for (let i = 0; i < 3; i++) {
      const prior = current;
      current = await importFile(bytes);
      assert.notEqual(current.recCanUuid, prior.recCanUuid);
      assert.notEqual(current.fileNo, prior.fileNo);
      assert.equal(current.middleName, "Original");
      await close();
      await importFile(bytes, 409);
      await close();
      if (i < 2) await deleteThroughUi(current.recCanUuid);
    }
    await deleteThroughUi(current.recCanUuid);
    form.getCell("F9").value = "Edited";
    current = await importFile(Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(current.middleName, "Edited");
    await page.getByRole("button", { name: "Open Candidate", exact: true }).click();
    await page.waitForURL(`**/recruitment/${current.recCanUuid}`);
    await page.getByText(current.fileNo, { exact: true }).last().waitFor();
    assert.equal(await page.getByTestId("text-first-name").textContent(), name);
    assert((await page.getByTestId("text-a5-screening-date").textContent()).includes("Submitted for screening on"));
    await page.screenshot({ path: "/tmp/recruitment-reimport-success.png" });
    const active = await (await page.request.get(`${base}/api/v2/recruitment/candidates`)).json();
    const own = active.filter(candidate => uuids.includes(candidate.recCanUuid));
    assert.equal(own.length, 1);
    assert.equal(own[0].recCanUuid, current.recCanUuid);
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ success: true, normalUiDeletes: 4, unchangedReimports: 3, activeDuplicatesBlocked: 3, editedReimportOpened: true, activeApplications: 1 }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
