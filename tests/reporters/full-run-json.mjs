import path from "node:path";
import { JsonReporter } from "vitest/reporters";

// Vitest 4's built-in JSON does not include the unhandled errors reported
// by onTestRunEnd. Keep its existing output format and add run provenance.
export class FullRunJsonReporter extends JsonReporter {
  async onTestRunStart(selected) {
    const config = this.ctx.config;
    const relative = (specs) => specs.map(({ moduleId }) =>
      path.relative(config.root, moduleId).split(path.sep).join("/")).sort();
    const discoveredFiles = relative(await this.ctx.globTestSpecifications());
    const selectedFiles = relative(selected);
    const filtered = Boolean(config.watch || config.testNamePattern || config.shard ||
      config.related?.length || config.diff || config.changed || config.project?.length ||
      config.cliExclude?.length || config.bail > 0 || this.ctx.filenamePattern?.length ||
      selected.some((spec) => spec.testLines?.length));
    this.scope = {
      root: config.root,
      full: !filtered && discoveredFiles.length > 0 &&
        JSON.stringify(discoveredFiles) === JSON.stringify(selectedFiles),
      discoveredFiles,
      selectedFiles,
    };
  }

  async onTestRunEnd(modules, errors, reason) {
    this.completion = {
      reason,
      unhandledErrors: errors.map((error) => ({
        name: typeof error?.name === "string" ? error.name : "Unhandled error",
      })),
    };
    await super.onTestRunEnd(modules);
  }

  async writeReport(contents) {
    const report = JSON.parse(contents);
    report.fullRun = { version: 1, ...this.scope, ...this.completion };
    await super.writeReport(JSON.stringify(report));
  }
}
