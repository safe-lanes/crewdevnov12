// @vitest-environment node
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import express from "express";
import request from "supertest";
import { generateTemplate } from "../../server/v2/recruitment/import/workbook";
import { decodeFile, parseWorkbook } from "../../server/v2/recruitment/import/parser";
import { WorkbookValidationError } from "../../server/v2/recruitment/import/errors";
import { readImportFailure } from "../../client/src/modules/recruitment/importErrors";
import { loadCatalogs } from "../../server/v2/recruitment/import/catalogs";
import { authorizeImport, ImportAccessError } from "../../server/v2/recruitment/import/access";
import { persistCandidate, DuplicateImportError } from "../../server/v2/recruitment/import/persistence";
import { candidateImportRouter } from "../../server/v2/recruitment/import/routes";

vi.mock("../../server/v2/recruitment/import/catalogs", () => ({ loadCatalogs: vi.fn() }));
vi.mock("../../server/v2/recruitment/import/access", () => ({
  authorizeImport: vi.fn(),
  ImportAccessError: class ImportAccessError extends Error {},
}));
vi.mock("../../server/v2/recruitment/import/persistence", () => ({
  persistCandidate: vi.fn(),
  DuplicateImportError: class DuplicateImportError extends Error {},
}));
const catalogs = { countries: [], nationalities: [], languages: [], vesselTypes: [], agents: [], ranks: [] };
let template: Buffer, valid: Buffer, malformed: Buffer;
const app = express();
app.use(express.json({ limit: "8mb" }), candidateImportRouter);
const upload = (bytes: Buffer, fileName = "candidate.xlsx") => ({ fileData: bytes.toString("base64"), fileName });
beforeAll(async () => {
  template = await generateTemplate(catalogs);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(template as any);
  book.worksheets[0].getCell("F8").value = "ErrorTest";
  valid = Buffer.from(await book.xlsx.writeBuffer());
  const zip = await JSZip.loadAsync(template);
  zip.file("xl/workbook.xml", "<workbook>");
  malformed = await zip.generateAsync({ type: "nodebuffer" });
});
beforeEach(() => {
  vi.mocked(loadCatalogs).mockResolvedValue(catalogs);
  vi.mocked(authorizeImport).mockResolvedValue({ auditUuid: null });
  vi.mocked(persistCandidate).mockResolvedValue("synthetic-candidate");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe("Safe workbook read failures", () => {
  it("reproduces the screenshot exception, then returns a readable domain error", async () => {
    await expect(new ExcelJS.Workbook().xlsx.load(malformed as any)).rejects.toThrow("reading 'sheets'");
    await expect(parseWorkbook(malformed, catalogs)).rejects.toMatchObject({
      name: "WorkbookValidationError", code: "WORKBOOK_READ", message: expect.stringContaining("could not be opened"),
      recovery: expect.stringContaining("unencrypted .xlsx"),
    });
  });
  it("handles a truncated ZIP and missing essential workbook parts", async () => {
    await expect(parseWorkbook(template.subarray(0, 80), catalogs)).rejects.toBeInstanceOf(WorkbookValidationError);
    const zip = await JSZip.loadAsync(template);
    zip.remove("xl/workbook.xml");
    await expect(parseWorkbook(await zip.generateAsync({ type: "nodebuffer" }), catalogs)).rejects.toMatchObject({ code: "WORKBOOK_READ" });
    const otherZip = new JSZip().file("readme.txt", "Not Excel");
    await expect(parseWorkbook(await otherZip.generateAsync({ type: "nodebuffer" }), catalogs)).rejects.toMatchObject({ code: "WORKBOOK_READ" });
  });
  it("does not call old, renamed, or encrypted data a valid Excel workbook", () => {
    expect(() => decodeFile(valid.toString("base64"), "candidate.xls")).toThrow(".xlsx");
    // OLE signature used by encrypted Office workbooks and legacy .xls files.
    expect(() => decodeFile(Buffer.from("d0cf11e0a1b11ae1", "hex").toString("base64"), "encrypted.xlsx")).toThrow("could not be opened");
    expect(() => decodeFile(Buffer.from("renamed text file").toString("base64"), "renamed.xlsx")).toThrow("could not be opened");
    expect(() => decodeFile("A".repeat(7 * 1024 * 1024), "large.xlsx")).toThrow("5 MB");
  });
  it("preserves specific unsafe-content and layout explanations", async () => {
    const zip = await JSZip.loadAsync(valid);
    zip.file("xl/vbaProject.bin", "macro");
    await expect(parseWorkbook(await zip.generateAsync({ type: "nodebuffer" }), catalogs)).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT" });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(valid as any);
    book.worksheets[0].unMergeCells("F8:P8");
    await expect(parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).rejects.toMatchObject({ code: "MODIFIED_LAYOUT" });
  });
  it("accepts generated and Excel-rewritten templates, with section/cell errors for ordinary data", async () => {
    expect((await parseWorkbook(valid, catalogs)).isValid).toBe(true);
    const blank = await parseWorkbook(template, catalogs);
    expect(blank.errors).toEqual([expect.objectContaining({ section: "A1", cell: "F8", field: "First name" })]);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(valid as any);
    book.worksheets[0].getCell("V7").value = new Date("1990-01-01T00:00:00Z");
    expect((await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs)).isValid).toBe(true);
    book.worksheets[0].getCell("V7").value = "2024-02-31";
    const badDate = await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()), catalogs);
    expect(badDate.errors).toContainEqual(expect.objectContaining({ section: "A1", cell: "V7", field: "Date of birth", message: expect.stringContaining("valid date") }));
  });
});

describe("Import API separates file, access and server failures", () => {
  for (const action of ["validate", "execute"]) it(`${action} never exposes ExcelJS internals or writes a malformed workbook`, async () => {
    const result = await request(app).post(`/${action}`).send(upload(malformed));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: "WORKBOOK_READ", recovery: expect.stringContaining("Download") });
    expect(JSON.stringify(result.body)).not.toMatch(/undefined|reading|sheets|stack/i);
    expect(result.body).not.toHaveProperty("errors");
    expect(persistCandidate).not.toHaveBeenCalled();
  });
  it("classifies catalog outages as server failures without exposing data in responses or logs", async () => {
    vi.mocked(loadCatalogs).mockRejectedValueOnce(new Error("SQL_PRIVATE_CANDIDATE_DATA"));
    const result = await request(app).post("/validate").send(upload(valid));
    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({ code: "SERVICE_UNAVAILABLE", message: expect.stringContaining("master lists") });
    expect(result.body.message).toContain("do not need to change");
    expect(JSON.stringify([result.body, vi.mocked(console.error).mock.calls])).not.toContain("SQL_PRIVATE_CANDIDATE_DATA");
    expect(persistCandidate).not.toHaveBeenCalled();
  });
  it("retains access-denied and authorization-unavailable distinctions", async () => {
    vi.mocked(authorizeImport).mockRejectedValueOnce(new ImportAccessError("Your authenticated account is not present in the user master."));
    expect((await request(app).post("/validate").send(upload(valid))).body.code).toBe("ACCESS_DENIED");
    vi.mocked(authorizeImport).mockRejectedValueOnce(new Error("PRIVATE_USER_MAPPING"));
    const response = await request(app).post("/validate").send(upload(valid));
    expect(response.status).toBe(500);
    expect(response.body.code).toBe("AUTH_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("PRIVATE_USER_MAPPING");
  });
  it("does not write invalid cell values; execution reports the same correction locations", async () => {
    const preview = await request(app).post("/validate").send(upload(template));
    expect(preview.status).toBe(200);
    expect(preview.body.isValid).toBe(false);
    const result = await request(app).post("/execute").send(upload(template));
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ code: "CELL_VALIDATION", errors: preview.body.errors });
    expect(persistCandidate).not.toHaveBeenCalled();
  });
  it("preserves Applied success and duplicate/persistence-failure responses", async () => {
    expect((await request(app).post("/execute").send(upload(valid))).body).toEqual({ success: true, status: "Applied", recCanUuid: "synthetic-candidate" });
    vi.mocked(persistCandidate).mockRejectedValueOnce(new DuplicateImportError("This candidate was already imported."));
    expect((await request(app).post("/execute").send(upload(valid))).body.code).toBe("DUPLICATE_IMPORT");
    vi.mocked(persistCandidate).mockRejectedValueOnce(new Error("SQL_PRIVATE_DOCUMENT"));
    const failed = await request(app).post("/execute").send(upload(valid));
    expect(failed.status).toBe(500);
    expect(failed.body.message).toContain("No candidate data was saved");
    expect(JSON.stringify(failed.body)).not.toContain("SQL_PRIVATE_DOCUMENT");
  });
});

describe("Client readable response boundaries", () => {
  it("does not show technical messages from an old server or HTML gateway", async () => {
    const response = new Response(JSON.stringify({ message: "Cannot read properties of undefined (reading 'sheets')" }), { status: 400 });
    const result = await readImportFailure(response);
    expect(result.message).toContain("could not be read");
    expect(result.recovery).toContain("Download");
    expect((await readImportFailure(new Response("<html>Bad gateway</html>", { status: 502 }))).message).toContain("service is unavailable");
  });
  it("preserves safe explanations and separates network/access/duplicate errors from file recovery", async () => {
    const result = await readImportFailure(new Response(JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Master lists are unavailable.", errors: [null, {}] }), { status: 500 }));
    expect(result).toEqual({ message: "Master lists are unavailable.", recovery: "", errors: [] });
    for (const status of [401, 403, 409]) {
      const result = await readImportFailure(new Response("{}", { status }));
      expect(result.recovery).toBe("");
      expect(result.message).not.toContain("workbook");
    }
  });
});
