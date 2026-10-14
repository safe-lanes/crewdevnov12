import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));

describe("development backend watch command", () => {
  it("watches the backend, including files outside the loaded import graph", () => {
    expect(scripts.dev).toContain("NODE_ENV=development tsx watch");
    expect(scripts.dev).toContain("--include 'server/**/*'");
    expect(scripts.dev).toContain("server/index.ts");
  });

  it("preserves restart logs and excludes frontend-only hot updates", () => {
    expect(scripts.dev).toContain("--clear-screen=false");
    expect(scripts.dev).toContain("--exclude 'client/**'");
  });

  it("does not introduce a watch process into production startup", () => {
    expect(scripts.start).not.toContain("watch");
    expect(scripts["start:prod"]).not.toContain("watch");
  });
});