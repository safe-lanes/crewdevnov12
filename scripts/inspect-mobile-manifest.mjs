import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const forbiddenAndroidPermissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.CAMERA",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.MANAGE_EXTERNAL_STORAGE",
  "android.permission.READ_SMS",
];

export function validateMobileManifest(config, androidManifest = "") {
  const errors = [];
  const expo = config?.expo ?? config;

  if (expo?.android?.allowBackup !== false) {
    errors.push("Android backups must be disabled");
  }
  if (!expo?.android?.package || !expo?.ios?.bundleIdentifier) {
    errors.push("Android package and iOS bundle identifiers are required");
  }
  if (expo?.ios?.entitlements?.["com.apple.developer.default-data-protection"] !== "NSFileProtectionComplete") {
    errors.push("iOS complete file protection entitlement is required");
  }

  const configuredPermissions = new Set(expo?.android?.permissions ?? []);
  for (const permission of forbiddenAndroidPermissions) {
    if (configuredPermissions.has(permission) || androidManifest.includes(permission)) {
      errors.push(`Forbidden Android permission: ${permission}`);
    }
  }

  if (androidManifest) {
    if (!/android:allowBackup="false"/.test(androidManifest)) {
      errors.push("Generated Android manifest must set allowBackup=false");
    }
    if (/android:usesCleartextTraffic="true"/.test(androidManifest)) {
      errors.push("Generated Android manifest enables cleartext traffic");
    }
  }

  if (errors.length) {
    throw new Error(`Mobile manifest security validation failed: ${errors.join("; ")}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configPath = process.argv[2] ?? new URL("../mobile/app.json", import.meta.url);
  const manifestPath = process.argv[3];
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const manifest = manifestPath ? fs.readFileSync(manifestPath, "utf8") : "";
  validateMobileManifest(config, manifest);
  console.log("Mobile manifest security configuration is valid.");
}
