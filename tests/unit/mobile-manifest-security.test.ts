import { describe, expect, it } from "vitest";
import { validateMobileManifest } from "../../scripts/inspect-mobile-manifest.mjs";

const secureConfig = {
  expo: {
    android: { package: "com.sail.crewapp", allowBackup: false },
    ios: {
      bundleIdentifier: "com.sail.crewapp",
      entitlements: { "com.apple.developer.default-data-protection": "NSFileProtectionComplete" },
    },
  },
};

describe("mobile manifest security inspection", () => {
  it("accepts the hardened Expo configuration", () => {
    expect(() => validateMobileManifest(secureConfig)).not.toThrow();
  });

  it("rejects backups, sensitive permissions, and cleartext", () => {
    const unsafe = {
      expo: {
        ...secureConfig.expo,
        android: {
          ...secureConfig.expo.android,
          allowBackup: true,
          permissions: ["android.permission.RECORD_AUDIO"],
        },
      },
    };
    expect(() => validateMobileManifest(unsafe, '<application android:allowBackup="true" android:usesCleartextTraffic="true" />'))
      .toThrow(/backups.*RECORD_AUDIO.*allowBackup.*cleartext/i);
  });
});
