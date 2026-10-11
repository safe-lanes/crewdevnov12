import { describe, expect, it } from "vitest";
import { crewAssignmentRuleDimensions } from "../../server/v2/company-forms/subjects/crewAssignmentDimensions";
describe("subject-owned rule dimension declarations", () => {
  it("declares independent typed dimensions without local owner/flag catalogues", () => {
    expect(new Set(crewAssignmentRuleDimensions.map(d => d.key)).size).toBe(12);
    expect(crewAssignmentRuleDimensions.filter(d => !d.available).map(d => d.key)).toEqual(["owner", "flag"]);
    expect(crewAssignmentRuleDimensions.find(d => d.key === "first_in_rank")?.operators).toEqual(["is"]);
  });
});
