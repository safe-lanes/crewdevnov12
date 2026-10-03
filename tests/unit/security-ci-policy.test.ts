import fs from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(".github/workflows/security-ci.yml", "utf8");
const dependabot = fs.readFileSync(".github/dependabot.yml", "utf8");

describe("security CI policy", () => {
  it("runs SAST, full-history secret scanning, dependency review, and SBOM generation", () => {
    expect(workflow).toContain("github/codeql-action/analyze@v3");
    expect(workflow).toContain("gitleaks/gitleaks-action@v2");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("actions/dependency-review-action@v4");
    expect(workflow).toContain("fail-on-severity: high");
    expect(workflow).toContain("--sbom-format=cyclonedx");
  });

  it("uses deterministic installs and scans both dependency trees", () => {
    expect(workflow).toContain("npm ci --ignore-scripts && npm ci --ignore-scripts --prefix mobile");
    expect(workflow.match(/npm audit --audit-level=critical/g)).toHaveLength(2);
    expect(workflow).toContain('NODE_VERSION: "20"');
  });

  it("keeps root, mobile, and workflow dependencies updated", () => {
    expect(dependabot).toContain("directory: /mobile");
    expect(dependabot).toContain("package-ecosystem: github-actions");
    expect(dependabot.match(/interval: weekly/g)).toHaveLength(3);
  });
});
