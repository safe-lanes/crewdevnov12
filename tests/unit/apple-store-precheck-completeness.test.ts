import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const report = readFileSync("docs/security/apple-app-store-release-precheck-2026-10-01.md", "utf8");

describe("Apple App Store release precheck", () => {
  it.each([
    "APPLE STORE SCORE", "STATUS: NOT READY", "Xcode version", "iOS SDK",
    "Bundle identifier", "Info.plist and permission review", "Entitlements review",
    "Privacy manifest review", "Draft App Privacy mapping", "Final IPA/archive verification checklist",
  ])("contains %s", item => expect(report).toContain(item));

  it("keeps unavailable release evidence unverified", () => {
    expect(report).toContain("No signed IPA/archive");
    expect(report).toContain("App Store Connect items — NOT VERIFIED");
    expect(report).toContain("Privacy-manifest compliance is currently **NOT VERIFIED**");
  });

  it("includes current Apple requirements and official sources", () => {
    expect(report).toContain("28 April 2026");
    expect(report).toContain("Xcode 26");
    expect(report).toContain("iOS 26");
    expect(report).toContain("developer.apple.com/news/upcoming-requirements");
    expect(report).toContain("developer.apple.com/support/offering-account-deletion-in-your-app");
  });
});
