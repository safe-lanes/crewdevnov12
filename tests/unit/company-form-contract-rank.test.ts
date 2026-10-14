import { describe, expect, it } from "vitest";
import { captureDeployRank } from "../../server/v2/company-forms/subjects/crewAssignmentRuleContext";
describe("contract rank capture provenance", () => {
  it("refuses a missing exact planning association", async () => {
    await expect(captureDeployRank("assignment", "planning", { execute: async () => ({ rows: [] }) }))
      .rejects.toThrow("exact recorded reliever planning link");
  });
  it("reads the planning rank and records unresolved ambiguity without a profile fallback", async () => {
    let calls = 0;
    const tx = { execute: async () => {
      calls++;
      return { rows: calls === 1 ? [{ rank_id: "R017" }] : calls === 2 ? [{ ar_uuid: "one" }, { ar_uuid: "two" }] : [] };
    } };
    await captureDeployRank("assignment", "planning", tx);
    expect(calls).toBe(3);
  });
});
