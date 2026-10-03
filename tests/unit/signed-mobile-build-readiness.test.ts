import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { validateReleaseConfig } from "../../scripts/validate-mobile-release-config.mjs";

const eas = JSON.parse(fs.readFileSync("mobile/eas.json", "utf8"));
const app = JSON.parse(fs.readFileSync("mobile/app.json", "utf8"));

describe("signed mobile build readiness", () => {
  const validEnv = { EXPO_PUBLIC_API_BASE_URL: "https://crew-api.sail.example", EXPO_PROJECT_ID: "12345678-1234-1234-1234-123456789abc" };

  it("uses store artifacts, remote credentials, remote versioning and draft submission", () => {
    expect(() => validateReleaseConfig({ eas, app, env: validEnv })).not.toThrow();
    expect(eas.build.production.android.buildType).toBe("app-bundle");
    expect(eas.build.production.ios.simulator).toBe(false);
    expect(eas.submit.production.android.releaseStatus).toBe("draft");
  });

  it("fails closed for missing or unsafe public release configuration", () => {
    expect(() => validateReleaseConfig({ eas, app, env: {} })).toThrow("EXPO_PUBLIC_API_BASE_URL");
    expect(() => validateReleaseConfig({ eas, app, env: { ...validEnv, EXPO_PUBLIC_API_BASE_URL: "http://localhost:5000" } })).toThrow("production HTTPS");
  });

  it("keeps signing material and release artifacts out of Git", () => {
    const ignore = fs.readFileSync(".gitignore", "utf8");
    for (const pattern of ["credentials.json", "*.jks", "*.p12", "*.mobileprovision", "*.aab", "*.ipa"]) expect(ignore).toContain(pattern);
  });

  it("loads local public build values from the repository-root env file", () => {
    const config = fs.readFileSync("mobile/app.config.js", "utf8");
    expect(config).toContain('path.resolve(__dirname, "../.env")');
    expect(config).toContain("process.env.EXPO_PROJECT_ID");
    expect(config).not.toMatch(/password|privateKey|keystorePassword/);
  });

  it("provides platform signature and entitlement verification instructions", () => {
    const runbook = fs.readFileSync("docs/security/signed-mobile-build-runbook.md", "utf8");
    for (const term of ["jarsigner -verify", "keytool -printcert", "bundletool", "codesign --verify", "data-protection entitlement", "matching hashes"]) expect(runbook).toContain(term);
  });
});
