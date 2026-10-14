// Read-only compiler-host comparison; never swaps watched workspace sources.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const start = process.argv[2] ?? "222765daf6ab4d0c4c9cacc2819d0bb1fa16fbce";
const root = process.cwd();
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const tracked = new Set(git("ls-tree", "-r", "--name-only", start).trim().split("\n"));
const changed = git("diff", "--name-only", start).trim().split("\n").filter(file => /\.[cm]?tsx?$/.test(file));
const oldSources = new Map(changed.filter(file => tracked.has(file)).map(file => [path.resolve(file), git("show", `${start}:${file}`)]));
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
function check(baseline) {
  const host = ts.createCompilerHost(parsed.options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, ...args) => {
    if (baseline && oldSources.has(path.resolve(file))) {
      return ts.createSourceFile(file, oldSources.get(path.resolve(file)), languageVersion, true);
    }
    return original(file, languageVersion, ...args);
  };
  const roots = baseline ? parsed.fileNames.filter(file => tracked.has(path.relative(root, file))) : parsed.fileNames;
  const program = ts.createProgram(roots, { ...parsed.options, incremental: false, noEmit: true }, host);
  return ts.getPreEmitDiagnostics(program).map(d => {
    const position = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    return { file: d.file ? path.relative(root, d.file.fileName) : null, code: d.code,
      line: position ? position.line + 1 : null,
      source: position ? d.file.text.split("\n")[position.line].trim() : null,
      message: ts.flattenDiagnosticMessageText(d.messageText, "\n") };
  });
}
const baseline = check(true), current = check(false);
const key = d => JSON.stringify([d.file, d.code, d.source]);
const old = new Set(baseline.map(key));
const introduced = current.filter(d => !old.has(key(d)));
const report = { startingHead: start, checkedHead: git("rev-parse", "HEAD").trim(),
  at: new Date().toISOString(), baselineCount: baseline.length, currentCount: current.length,
  introduced, baseline, current };
fs.writeFileSync(".local/verification/signoff-typescript-comparison.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ baselineCount: baseline.length, currentCount: current.length, introduced }, null, 2));
if (introduced.length) process.exitCode = 1;