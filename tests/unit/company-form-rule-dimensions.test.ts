import { describe, expect, it } from "vitest";
import { crewAssignmentRuleDimensions, exactMasterValue } from "../../server/v2/company-forms/subjects/crewAssignmentDimensions";
describe("subject-owned rule dimension declarations", () => {
  it("declares independent typed dimensions without local owner/flag catalogues", () => {
    expect(new Set(crewAssignmentRuleDimensions.map(d => d.key)).size).toBe(12);
    expect(crewAssignmentRuleDimensions.filter(d => !d.available).map(d => d.key)).toEqual(["owner", "flag"]);
    expect(crewAssignmentRuleDimensions.find(d => d.key === "first_in_rank")?.operators).toEqual(["is"]);
  });
  it("stores the master ID, not a uniquely matched legacy label", () => {
    expect(exactMasterValue("fleet_group", "Fleet A", [{ id: "master-id", label: "Fleet A" }], true).value).toBe("master-id");
  });
  it("never guesses an unmapped or ambiguous source label", () => {
    expect(exactMasterValue("crew_pool", "Missing", [], true).status).toBe("unresolved");
    expect(exactMasterValue("crew_pool", "Same", [{ id: "1", label: "Same" }, { id: "2", label: "Same" }], true).status).toBe("unresolved");
  });
});
