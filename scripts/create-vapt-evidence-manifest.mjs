import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function sha256File(file) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

export function createManifest(files, options = {}) {
  if (!files.length) throw new Error("At least one evidence or binary file is required");
  const cwd = options.cwd ?? process.cwd();
  let sourceCommit = options.sourceCommit;
  if (!sourceCommit) {
    try { sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim(); }
    catch { sourceCommit = "UNAVAILABLE"; }
  }
  return {
    schemaVersion: 1,
    assessmentId: options.assessmentId ?? "UNASSIGNED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    files: files.map(file => {
      const absolute = path.resolve(cwd, file);
      const stat = fs.statSync(absolute);
      if (!stat.isFile()) throw new Error(`Not a file: ${file}`);
      return { name: path.basename(file), size: stat.size, sha256: sha256File(absolute) };
    }),
  };
}

function cli(argv) {
  const args = [...argv];
  let assessmentId = "UNASSIGNED";
  let output;
  const files = [];
  while (args.length) {
    const arg = args.shift();
    if (arg === "--assessment-id") assessmentId = args.shift() ?? "";
    else if (arg === "--output") output = args.shift();
    else files.push(arg);
  }
  if (!assessmentId) throw new Error("--assessment-id requires a value");
  const json = `${JSON.stringify(createManifest(files, { assessmentId }), null, 2)}\n`;
  if (output) fs.writeFileSync(path.resolve(output), json, { flag: "wx", mode: 0o600 });
  else process.stdout.write(json);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
