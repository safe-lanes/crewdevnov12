import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalDocumentJson, evidenceStatus, sha256 } from "../../server/v2/company-forms/documentEvidenceRepository";

describe("subject-neutral canonical document evidence", () => {
  it("hashes equivalent JSON identically and preserves ordered content", () => {
    const first = { z: [{ b: "é 中文", a: null }], a: new Date("2026-10-20T00:00:00Z") };
    const second = { a: "2026-10-20T00:00:00.000Z", z: [{ a: null, b: "é 中文" }] };
    expect(canonicalDocumentJson(first)).toBe(canonicalDocumentJson(second));
    expect(sha256(canonicalDocumentJson(first))).toBe(sha256(canonicalDocumentJson(second)));
    expect(sha256(canonicalDocumentJson([1, 2]))).not.toBe(sha256(canonicalDocumentJson([2, 1])));
    expect(sha256(canonicalDocumentJson({ rank: "Not recorded" })))
      .not.toBe(sha256(canonicalDocumentJson({ rank: "Master" })));
  });
  it("never exposes internal failure codes or stack traces", () => {
    for (const reasonCode of ["HISTORICAL_HEADER_MISSING", "SIGNATURE_EVIDENCE_MISSING", "SUBJECT_NAME_NOT_RECORDED", "SQL failure"]) {
      const status = evidenceStatus({ status: "completed", outcome: "UNAVAILABLE", reasonCode });
      expect(status.status).toBe("unavailable");
      expect(status.message).toContain("Ask the office");
      expect(status.message).not.toContain(reasonCode);
    }
    expect(evidenceStatus({ status: "completed" }).status).toBe("unavailable");
  });
  it("logs only presence flags in email startup configuration, never secret prefixes", () => {
    const source = readFileSync("server/v2/shared/emailService.ts", "utf8");
    const initialization = source.split("logEmailEvent('INFO', 'EmailService Initializing', {")[1].split("});")[0];
    expect(initialization).not.toMatch(/substring|slice|GMAIL_CLIENT_ID:|GMAIL_REFRESH_TOKEN:|EMAIL_API_URL:/);
    expect(initialization).toContain("gmailConfigured: Boolean(");
    expect(initialization).toContain("externalServiceConfigured: Boolean(");
  });
});
