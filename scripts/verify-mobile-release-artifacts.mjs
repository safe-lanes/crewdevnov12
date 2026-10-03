import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function command(name, args) { return spawnSync(name, args, { encoding: "utf8", shell: false }); }

export function inspectArtifact(file, expectedSha256) {
  const absolute = path.resolve(file);
  const extension = path.extname(absolute).toLowerCase();
  if (![".aab", ".ipa"].includes(extension)) throw new Error(`Unsupported artifact type: ${extension || "none"}`);
  const stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size < 1024) throw new Error(`Artifact is missing or implausibly small: ${file}`);
  const prefix = fs.readFileSync(absolute).subarray(0, 4).toString("hex");
  if (prefix !== "504b0304") throw new Error(`Artifact is not a ZIP-based ${extension} archive: ${file}`);
  const digest = sha256(absolute);
  if (expectedSha256 && digest !== expectedSha256.toLowerCase()) throw new Error(`SHA-256 mismatch for ${file}`);
  const result = { name: path.basename(file), type: extension.slice(1), size: stat.size, sha256: digest, signatureVerified: false };
  if (extension === ".aab") {
    const verify = command("jarsigner", ["-verify", "-strict", absolute]);
    if (verify.error?.code !== "ENOENT") {
      if (verify.status !== 0) throw new Error(`AAB signature verification failed: ${verify.stderr || verify.stdout}`);
      result.signatureVerified = true;
    }
  }
  return result;
}

function cli(args) {
  if (!args.length) throw new Error("Provide at least one .aab or .ipa artifact");
  const results = args.map(value => inspectArtifact(value));
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), artifacts: results }, null, 2)}\n`);
  if (results.some(item => !item.signatureVerified)) process.stderr.write("Signature verification unavailable for one or more artifacts; complete the platform-specific checks in the signing runbook.\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
