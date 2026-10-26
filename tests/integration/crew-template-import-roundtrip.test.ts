import { afterAll, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
import { generateImportTemplate } from "../../server/v2/crew-pool/services/importTemplate";
import { executeImport, validateImportData } from "../../server/v2/crew-pool/services/crewImportService";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const employee = `ROUNDTRIP-${randomUUID()}`;
state.db = drizzle(pool);
afterAll(async () => {
  await pool.query("DELETE FROM crew_members_v2 WHERE emp_no=$1", [employee]);
  await pool.end();
});

it("SAIL validates and imports a populated file from the actual shared-formula template generator", async () => {
  const bytes = await generateImportTemplate();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("Crew Details")!;
  const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
  // Replace illustrative rows on all data sheets, as an actual importer does.
  // Leave every attachment formula (rows 3..30002) intact.
  for (const dataSheet of workbook.worksheets) {
    if ((dataSheet.getRow(1).values as ExcelJS.CellValue[]).includes("Employee ID"))
      dataSheet.getRow(2).eachCell(cell => { cell.value = null; });
  }
  for (const [key, value] of Object.entries({
    "Employee ID": employee, "First Name": "TEST ONLY Roundtrip",
    "Date of Recruitment": "20-Oct-2026",
  })) sheet.getCell(3, headers.indexOf(key)).value = value;
  const populated = Buffer.from(await workbook.xlsx.writeBuffer());
  const validation = await validateImportData(populated);
  expect(validation.errors).toEqual([]);
  expect(validation.summary.crew).toBe(1);
  const imported = await executeImport(populated);
  expect(imported.errors).toEqual([]);
  expect(imported.success).toBe(true);
  expect(imported.imported.crew).toBe(1);
  const rows = (await pool.query("SELECT first_name FROM crew_members_v2 WHERE emp_no=$1", [employee])).rows;
  expect(rows).toEqual([{ first_name: "TEST ONLY Roundtrip" }]);
}, 120000);
