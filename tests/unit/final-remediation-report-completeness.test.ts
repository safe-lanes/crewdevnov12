import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const report = readFileSync("reports/mobile-security-remediation-final-2026-10-01.md", "utf8");

describe("final mobile remediation report", () => {
  it.each([
    "EXECUTIVE SUMMARY", "CLEARANCE", "FINDINGS COMPARISON", "SEVERITY COUNTS",
    "SECTION SCORECARD", "CODE CHANGE REPORT", "REMAINING RELEASE BLOCKERS",
    "INDEPENDENT VERIFICATION REQUIRED", "MASVS RETEST",
  ])("contains %s", section => expect(report).toContain(section));

  it("compares all twenty original findings", () => {
    for (let id = 1; id <= 20; id++) expect(report).toContain(`MOB-${String(id).padStart(3, "0")}`);
  });

  it("does not overstate production or store readiness", () => {
    expect(report).toContain("Final clearance: **NOT READY**");
    expect(report).toContain("Google result: **4/10 — NOT READY**");
    expect(report).toContain("Apple result: **4/10 — NOT READY**");
    expect(report).toContain("20 concurrent approvals | **NOT VERIFIED**");
  });
});
