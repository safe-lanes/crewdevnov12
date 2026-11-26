import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// SYN-02 guard: a write that skips captureChange is never sent to the other
// side. These checks read the source so a new repository method (or a new
// repository file) that writes without capturing fails here.

const root = join(__dirname, "..", "..", "server", "v2");
const rhDir = join(root, "rest-hours", "repositories");

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

// Drizzle writes on a table: .insert(x) / .update(x) / .delete(x)
// (`this.x(` is a repository method calling another, not a table write.)
const DIRECT_WRITE = /(?<!this)\.(insert|update)\(\s*[A-Za-z_]/g;
const HARD_DELETE = /(?<!this)\.delete\(\s*[A-Za-z_]/g;
// Calls that report a change.
const CAPTURE_CALL = /\b(captureChange|capturedInsert|capturedUpdate)\(/g;

const rhFiles = readdirSync(rhDir).filter((f) => f.endsWith("Repository.ts"));

describe("Rest Hours repositories capture every write", () => {
  it("finds the 9 repositories", () => {
    expect(rhFiles.length).toBe(9);
  });

  for (const file of rhFiles) {
    it(`${file}: every write is captured and nothing is hard deleted`, () => {
      const src = strip(readFileSync(join(rhDir, file), "utf8"));
      const writes = count(src, DIRECT_WRITE);
      const captures = count(src, CAPTURE_CALL);
      expect(count(src, HARD_DELETE), "hard delete").toBe(0);
      // Each direct write needs its own capture call; helper calls are writes + capture in one.
      expect(captures).toBeGreaterThanOrEqual(writes);
      // create/update/softDelete must exist and use a capture path.
      if (/async (create|update|softDelete)\(/.test(src)) {
        expect(captures, "repository writes without any capture").toBeGreaterThan(0);
      }
    });
  }
});

describe("Vessel planning repository captures every write", () => {
  const src = strip(readFileSync(join(root, "vessel", "repositories", "vesselPlanningRepository.ts"), "utf8"));

  it("has no direct table writes", () => {
    expect(count(src, DIRECT_WRITE), "use capturedInsert/capturedUpdate").toBe(0);
    expect(count(src, HARD_DELETE)).toBe(0);
  });

  it("create, update, archive, unarchive, delete and attachment writes use the capture helpers", () => {
    expect(count(src, /\bcapturedInsert</g)).toBeGreaterThanOrEqual(3); // plan + 2 attachment creates
    expect(count(src, /\bcapturedUpdate</g) + count(src, /\bcapturedUpdate\(/g)).toBeGreaterThanOrEqual(6);
  });
});

describe("Vessel planning service writes on synced tables are captured", () => {
  const src = strip(readFileSync(join(root, "vessel", "services", "vesselPlanningService.ts"), "utf8"));

  it("every direct write on planning, assignments or sea service is followed by captureRow", () => {
    const writes = count(src, /\.(insert|update)\(\s*(vesselPlanningV2|crewAssignments|crewSeaService)\b/g);
    // Calls pass an executor first (tx / tx3); the helper's own definition is "captureRow(executor: any".
    const captures = count(src, /\bcaptureRow\(\s*tx\w*\s*,/g);
    expect(captures).toBeGreaterThanOrEqual(writes);
  });
});
