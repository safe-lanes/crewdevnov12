import fs from "node:fs";
import { describe, expect, it } from "vitest";

const pack = fs.readFileSync("release-evidence/2026-10-02/RELEASE-EVIDENCE-PACK.md", "utf8");

describe("release evidence pack", () => {
  it("contains exactly the requested decision sections", () => {
    for (const heading of ["# RELEASE EVIDENCE MATRIX", "# ARTIFACT INTEGRITY MATRIX", "# OPEN RISK REGISTER", "# GO/NO-GO CHECKLIST", "## FINAL DECISION"]) expect(pack).toContain(heading);
  });

  it("accounts for every numbered gate without unsupported PASS claims", () => {
    for (let gate = 1; gate <= 30; gate += 1) expect(pack).toContain(`| ${gate}.`);
    expect(pack).not.toContain("| PASS |");
    expect(pack).toContain("Final Decision = NO-GO");
  });

  it("records actual critical/high dependency evidence and immutable hashes", () => {
    expect(pack).toContain("1 critical/2 high/20 moderate");
    expect(pack).toContain("0 critical/4 high/9 moderate");
    expect(pack).toContain("GHSA-m7jm-9gc2-mpf2");
    expect(pack).toContain("665F643C6592576DA3791319929C4ADEF8C43836AE6AFD2F58AA0961CA7B2051");
  });

  it("does not declare external authority approval", () => {
    expect(pack).toContain("does not declare legal, maritime, store, production-operations or independent security approval");
    expect(pack).toContain("DIRTY — 121 changed/untracked paths");
  });
});
