import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createHash } from "node:crypto";
import { appendVoidNotice } from "../../server/v2/company-forms/documentVoidRenderer";

describe("stored void notice PDF", () => {
  it("appends notice pages without changing the original input, including long reasons and missing historic facts", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("Frozen original page");
    const original = Buffer.from(await pdf.save());
    const digest = () => createHash("sha256").update(original).digest("hex");
    const before = digest();
    const result = await appendVoidNotice(original, {
      actorName: "Recorded witness", designation: null, voidedAt: "2026-10-20T10:00:00Z",
      reason: "A long recorded reason. ".repeat(450), originalFileSha256: before,
      replacementSubmissionUuid: null,
    }, "CF-2026-000123", 1);
    expect(result.pageCount).toBeGreaterThan(2);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(result.pageCount);
    expect(digest()).toBe(before);
    expect(result.bytes.equals(original)).toBe(false);
  });
});
