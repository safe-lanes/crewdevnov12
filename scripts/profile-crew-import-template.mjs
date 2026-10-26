// Production-template profiling on synthetic masters only. Never writes data.
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { prepareTestEnvironment } from "./test-database-guard.mjs";
await prepareTestEnvironment();
const { default: ExcelJS } = await import("exceljs");
const workbook = new ExcelJS.Workbook();
const phases = [];
const wrap = (prototype, key) => {
  const original = prototype[key];
  prototype[key] = function (...args) {
    const start = performance.now();
    const result = original.apply(this, args);
    if (key !== "protect" && result?.then) return result.finally(() => phases.push({ phase: key, milliseconds: performance.now() - start }));
    phases.push({ phase: key, milliseconds: performance.now() - start });
    return result;
  };
};
wrap(workbook.addWorksheet("probe").constructor.prototype, "protect");
wrap(workbook.xlsx.constructor.prototype, "writeBuffer");
const { generateImportTemplate } = await import("../server/v2/crew-pool/services/importTemplate.ts");
const { parseDate } = await import("../server/v2/crew-pool/services/crewImportService.ts");
if (parseDate("2026-10-01") !== "2026-10-01") throw Error("Import module failed to load.");
const require = createRequire(import.meta.url);
const loadedPdfModules = Object.keys(require.cache).filter(p => /node_modules\/(?:pdf-lib|@pdf-lib\/fontkit)\//.test(p)).length;
const start = performance.now(), cpu = process.cpuUsage();
const bytes = await generateImportTemplate();
const report = { elapsedMilliseconds: performance.now() - start, cpu: process.cpuUsage(cpu),
  loadedPdfModules, byteLength: bytes.length, phases };
await fs.writeFile(process.argv[2] ?? "generated-artifacts/company-pdf-layout/excel-profile.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);
