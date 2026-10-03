import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function validateReleaseConfig({ eas, app, env }) {
  const errors = [];
  const profile = eas?.build?.production;
  const url = env.EXPO_PUBLIC_API_BASE_URL;
  const projectId = env.EXPO_PROJECT_ID ?? app?.expo?.extra?.eas?.projectId;
  if (typeof url !== "string" || !url.startsWith("https://") || /REPLACE_WITH_|localhost|127\.0\.0\.1/i.test(url)) errors.push("EXPO_PUBLIC_API_BASE_URL must be an explicit production HTTPS origin");
  if (typeof projectId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) errors.push("EXPO_PROJECT_ID or expo.extra.eas.projectId must be configured by eas init");
  if (eas?.cli?.appVersionSource !== "remote") errors.push("EAS appVersionSource must be remote");
  if (profile?.distribution !== "store" || profile?.credentialsSource !== "remote") errors.push("production must use store distribution and remote credentials");
  if (profile?.android?.buildType !== "app-bundle") errors.push("production Android output must be an app-bundle");
  if (profile?.ios?.simulator !== false) errors.push("production iOS output must target physical devices");
  if (eas?.submit?.production?.android?.releaseStatus !== "draft") errors.push("first Google submission must remain draft");
  if (errors.length) throw new Error(`Mobile release configuration invalid: ${errors.join("; ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("validate-mobile-release-config.mjs")) {
  dotenv.config({ path: path.resolve(".env") });
  const eas = JSON.parse(fs.readFileSync(new URL("../mobile/eas.json", import.meta.url), "utf8"));
  const app = JSON.parse(fs.readFileSync(new URL("../mobile/app.json", import.meta.url), "utf8"));
  try { validateReleaseConfig({ eas, app, env: process.env }); console.log("Mobile release configuration is valid."); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
