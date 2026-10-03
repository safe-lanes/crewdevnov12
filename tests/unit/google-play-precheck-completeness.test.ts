import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const report = readFileSync("docs/security/google-play-release-precheck-2026-10-01.md", "utf8");

describe("Google Play release precheck", () => {
  it.each([
    "GOOGLE PLAY SCORE", "STATUS: NOT READY", "Target SDK", "Compile SDK", "Minimum SDK",
    "Package ID", "Release signing", "Production API", "Permission review",
    "Draft Play Data Safety mapping", "Final AAB verification checklist",
  ])("contains %s", item => expect(report).toContain(item));

  it("keeps unavailable evidence unverified", () => {
    expect(report).toContain("No signed AAB");
    expect(report).toContain("Play Console items — NOT VERIFIED");
    expect(report).toContain("final AAB value NOT VERIFIED");
  });

  it("includes the current API 36 requirement and official guidance", () => {
    expect(report).toContain("31 August 2026");
    expect(report).toContain("API 36");
    expect(report).toContain("support.google.com/googleplay/android-developer/answer/11926878");
    expect(report).toContain("support.google.com/googleplay/android-developer/answer/10787469");
  });
});
