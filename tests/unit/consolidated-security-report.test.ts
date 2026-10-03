import fs from "node:fs";
import { describe, expect, it } from "vitest";

const report = fs.readFileSync("reports/sail-crew-mobile-consolidated-security-readiness-2026-10-02.md", "utf8");

describe("consolidated mobile security report", () => {
  it("states an honest release decision and preserves the ERP boundary", () => {
    expect(report).toContain("NO-GO");
    expect(report).toContain("do not change ERP code");
    expect(report).toContain("mobile client never connects directly");
    expect(report).toContain("does not constitute an independent penetration test");
  });

  it("covers completed remediation areas and outstanding evidence", () => {
    for (const heading of ["Authentication, sessions and authorization", "ERP command safety", "File and malware security", "Privacy and deletion", "Backup, restore", "Mobile hardening and MFA", "CI, SAST, SCA", "VAPT preparation", "Signed build preparation"]) expect(report).toContain(heading);
    for (const blocker of ["ClamAV runtime", "Independent VAPT", "Signed AAB/IPA", "Store declarations/submission"]) expect(report).toContain(blocker);
  });

  it("contains the verified 2026 store requirements and final gates", () => {
    expect(report).toContain("API 36");
    expect(report).toContain("31 August 2026");
    expect(report).toContain("Xcode 26");
    expect(report).toContain("28 April 2026");
    expect(report).toContain("Go/no-go checklist");
  });
});
