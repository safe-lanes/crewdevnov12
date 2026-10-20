import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderFrozenDocument } from "../../server/v2/company-forms/documentPdfRenderer";
import { canonicalDocumentJson, sha256 } from "../../server/v2/company-forms/documentEvidenceRepository";
import type { FrozenDocumentInput } from "../../shared/v2/forms-engine/documentEvidence";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=";
function fixture(logo: boolean): FrozenDocumentInput {
  const input: FrozenDocumentInput = {
    schemaVersion: 1,
    source: { kind: "company_form", recordUuid: "sample", formUuid: "form", versionUuid: "version",
      stageKey: "on_board", subjectType: "crew_assignment", subjectRef: "assignment",
      origin: "MANUAL", requirementUuid: null, completedAt: "2026-10-20T00:00:00Z" },
    header: { schemaVersion: 1, capturedAt: "2026-10-20T00:00:00Z", captureEvent: "signature",
      tenant: { identity: "test", companyName: "Sample Shipping — Étienne / Дмитрий", source: "tenant_setting" },
      branding: logo ? { mode: "logo", logoVersionUuid: "logo-1", assetSha256: sha256(Buffer.from(png, "base64")),
        asset: { bytesBase64: png, mediaType: "image/png", sha256: sha256(Buffer.from(png, "base64")) } }
        : { mode: "company_name", logoVersionUuid: null, assetSha256: null },
      subject: { subjectLabel: "TEST ONLY", fields: [{ label: "Contract rank", value: "Not recorded" }] },
      definition: {
        form: { name: "PDF layout sample" }, version: { versionNo: "01" },
        parts: [{ formPartUuid: "part", partTitle: "Recorded form" }],
        sections: [{ sectionUuid: "section", formPartUuid: "part", sectionTitle: "Signed record" }],
        questions: [{ questionUuid: "q", sectionUuid: "section", questionText: "Long answer", responseType: "free_text" },
          { questionUuid: "rank", sectionUuid: "section", questionText: "Rank", responseType: "system_field" }],
      },
    },
    applicableSectionUuids: ["section"], systemFields: [{ questionUuid: "rank", value: "Not recorded" }],
    answers: [{ questionUuid: "q", answerValue: "A long recorded answer crossing page boundaries. ".repeat(220), answerComment: "Recorded comment" }],
    sectionStates: [{ sectionStateUuid: "state", sectionUuid: "section", submittedAt: "2026-10-20T00:00:00Z", submittedByName: "Sample officer" }],
    signatures: ["officer", "seafarer", "vessel_management"].map(type => ({
      record: { sectionStateUuid: "state", signatureType: type, signerName: "Sample signer",
        signerRank: type === "seafarer" ? "Not recorded" : "Recorded designation", signedAt: "2026-10-20T00:00:00Z",
        signatureMethod: type === "seafarer" ? "witnessed" : type,
        witnessName: type === "seafarer" ? "Sample witness" : null, witnessRank: "Superintendent" },
      asset: { mediaType: "image/png", bytesBase64: png, sha256: sha256(Buffer.from(png, "base64")), byteLength: Buffer.from(png, "base64").length },
    })),
  };
  return input;
}
describe("frozen-input PDF renderer", () => {
  it.each([true, false])("paginates Unicode, all signature kinds and a long answer with logo=%s", async logo => {
    const input = fixture(logo);
    const bytes = await renderFrozenDocument(input, sha256(canonicalDocumentJson(input)));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getAuthor()).toContain("Дмитрий");
    expect(pdf.getTitle()).toBe("PDF layout sample — v01");
    expect(pdf.getCreationDate()?.toISOString()).toBe(input.source.completedAt.replace("Z", ".000Z"));
  });
  it("refuses altered frozen input or altered frozen logo bytes", async () => {
    const input = fixture(true);
    const hash = sha256(canonicalDocumentJson(input));
    input.answers[0].answerValue = "Tampered";
    await expect(renderFrozenDocument(input, hash)).rejects.toThrow("Frozen record checksum");
    input.header.branding.asset!.sha256 = "0".repeat(64);
    await expect(renderFrozenDocument(input, sha256(canonicalDocumentJson(input)))).rejects.toThrow("Frozen logo checksum");
  });
});
