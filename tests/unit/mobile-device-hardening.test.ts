import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile device hardening configuration", () => {
  it("uses device-only secure storage accessibility", () => {
    const source = readFileSync("mobile/src/auth/secureStore.ts", "utf8");
    expect(source).toContain("AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY");
    expect(source).not.toMatch(/from\s+["']@react-native-async-storage/);
  });
  it("disables Android backup and enables complete iOS file protection", () => {
    const config = JSON.parse(readFileSync("mobile/app.json", "utf8"));
    expect(config.expo.android.allowBackup).toBe(false);
    expect(config.expo.ios.entitlements["com.apple.developer.default-data-protection"]).toBe("NSFileProtectionComplete");
  });
  it("does not declare deep links or unnecessary sensitive permissions", () => {
    const config = JSON.parse(readFileSync("mobile/app.json", "utf8"));
    expect(config.expo.scheme).toBeUndefined();
    expect(config.expo.android.permissions ?? []).toEqual([]);
  });
});
