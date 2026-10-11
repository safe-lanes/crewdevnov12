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
    assert.equal(book.worksheets.length, 1, "Downloaded template must have exactly one worksheet");
    const form = book.getWorksheet("APPLICATION FORM");
    form.getCell("F8").value = name;
    form.getCell("F7").value = "Test";
    form.getCell("V7").value = "1990-01-01";
    // Same-sheet hidden master-label columns, outside the A:AF print area.
    const rank = form.getCell("AM2").value;
    const vesselType = form.getCell("AK2").value;
    const country = form.getCell("AH2").value;
    const nationality = form.getCell("AI2").value;
    const language = form.getCell("AJ2").value;
    const agency = form.getCell("AL2").value;
    assert(rank && vesselType, "Template must include current company master dropdowns");
    form.getCell("F6").value = rank;
    [["V6", rank], ["F15", nationality], ["V12", country], ["V13", language], ["F17", country],
      ["V17", agency], ["Y39", vesselType], ["AA134", country], ["A151", country], ["G151", "001234"],
      ["U151", "Work"], ["A163", "Test License"], ["W163", country], ["A180", "Test Training"],
      ["W180", country]].forEach(([cell, value]) => { form.getCell(cell).value = value; });
    form.getCell("V18").value = "0";
    form.getCell("A134").value = "Passport";
    form.getCell("G134").value = `SMOKE${Date.now()}`;
    form.getCell("Y29").value = "Test Qualification";
    [["A51", "Test Vessel"], ["Q51", vesselType], ["M51", rank], ["I51", "2021-01-01"], ["I52", "2021-04-01"]].forEach(([cell, value]) => { form.getCell(cell).value = value; });
    form.getCell("A212").value = "Test Information";
    form.getCell("Q212").value = false;
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
    assert.equal(await page.getByTestId("text-nationality").textContent(), nationality);
    assert.equal(await page.getByTestId("text-pob-country").textContent(), country);
    assert.equal(await page.getByTestId("text-native-language").textContent(), language);
    const visaSection = page.locator('div.mb-6').filter({ has: page.getByRole("heading", { name: "A2.2 Visas", exact: true }) });
    const seaSection = page.locator('div.mb-6').filter({ has: page.getByRole("heading", { name: "A4.1 Details of Sea Service", exact: true }) });
    await visaSection.locator("tbody tr").first().locator("input").first().waitFor();
    assert.equal(await visaSection.locator("tbody tr").first().locator("input").first().inputValue(), country);
    assert.equal(await seaSection.locator("tbody tr").first().getByRole("combobox").first().textContent(), vesselType);
    const detail = async section => {
      const response = await page.request.get(`${base}/api/v2/recruitment/candidates/${uuid}/${section}`);
      assert.equal(response.status(), 200);
      return response.json();
    };
    const beforeVisa = (await detail("visas"))[0], beforeSea = (await detail("sea-service"))[0];
    const beforeCore = await (await page.request.get(`${base}/api/v2/recruitment/candidates/${uuid}`)).json();
    const beforePersonal = await detail("personal-details");
    const beforeAddress = await detail("address");
    const beforeVesselTypes = await detail("vessel-types");
    assert.equal(beforeVisa.countryName, country);
    assert.equal(beforeSea.vesselTypeName, vesselType);
    assert.match(beforeVisa.countryUuid, /^[a-f0-9-]{36}$/i);
    assert.match(beforeSea.vesselTypeUuid, /^[a-f0-9-]{36}$/i);
    // Edit an unrelated field, save through the actual form, then reopen.
    await visaSection.locator("tbody tr").first().locator("input").nth(1).fill("009876");
    // Choosing/type-editing the same visible master labels must still save UUIDs.
    await visaSection.locator("tbody tr").first().locator("input").first().fill(country);
    await seaSection.locator("tbody tr").first().getByRole("combobox").first().click();
    await page.getByRole("option", { name: vesselType, exact: true }).last().click();
    await page.getByTestId("button-save-draft").click();
    await page.getByText("Saved", { exact: true }).waitFor();
    const afterVisa = (await detail("visas"))[0], afterSea = (await detail("sea-service"))[0];
    assert.equal(afterVisa.serialNo, "009876");
    assert.equal(afterVisa.countryUuid, beforeVisa.countryUuid);
    assert.equal(afterSea.vesselTypeUuid, beforeSea.vesselTypeUuid);
    const afterCore = await (await page.request.get(`${base}/api/v2/recruitment/candidates/${uuid}`)).json();
    const afterPersonal = await detail("personal-details");
    const afterAddress = await detail("address");
    const afterVesselTypes = await detail("vessel-types");
    assert.equal(afterCore.nationalityUuid, beforeCore.nationalityUuid);
    assert.equal(afterPersonal.placeOfBirthCountryUuid, beforePersonal.placeOfBirthCountryUuid);
    assert.equal(afterPersonal.nativeLanguageUuid, beforePersonal.nativeLanguageUuid);
    assert.equal(afterPersonal.manningAgent, beforePersonal.manningAgent);
    assert.equal(afterAddress.countryOfResidenceUuid, beforeAddress.countryOfResidenceUuid);
    assert.equal(afterVesselTypes[0].vesselTypeUuid, beforeVesselTypes[0].vesselTypeUuid);
    for (const section of ["documents", "licenses", "training"]) {
      const rows = await detail(section);
      assert.equal(rows[0].issuingCountryUuid, beforeVisa.countryUuid, `${section} hidden issuing country must survive save`);
    }
    await page.reload();
    await page.getByText(name, { exact: true }).first().click();
    await page.getByTestId("text-first-name").waitFor();
    await visaSection.locator("tbody tr").first().locator("input").first().waitFor();
    assert.equal(await visaSection.locator("tbody tr").first().locator("input").first().inputValue(), country);
    assert.equal(await seaSection.locator("tbody tr").first().getByRole("combobox").first().textContent(), vesselType);
    const pdfPromise = page.waitForEvent("download");
    await page.getByTestId("button-export").click();
    const pdf = await pdfPromise;
    assert((await fs.readFile(await pdf.path())).subarray(0, 4).toString() === "%PDF");
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
