import { describe, expect, it } from "vitest";
import { validateDimensionCondition } from "../../server/v2/company-forms/ruleDimensionValidation";
import { createCrewAssignmentSubject } from "../../server/v2/company-forms/subjects/crewAssignmentSubject";
const adapter = { ...createCrewAssignmentSubject(), ruleMasterChoices: async () => [{ id: "rank-master", label: "AB" }] };
const condition = { conditionUuid: "condition", dimensionKey: "rank", operator: "in" as const, value: ["rank-master"] };
describe("release dimension validation", () => {
  it("derives readable labels from real selected master identifiers", async () => {
    expect(await validateDimensionCondition(adapter, condition, {})).toEqual([{ id: "rank-master", label: "AB" }]);
  });
  it.each(["owner", "flag", "unknown"])("refuses unavailable or undeclared %s", async dimensionKey => {
    await expect(validateDimensionCondition(adapter, { ...condition, dimensionKey }, {})).rejects.toThrow();
  });
  it("rejects invented master IDs and unsupported operators", async () => {
    await expect(validateDimensionCondition(adapter, { ...condition, value: ["invented"] }, {})).rejects.toThrow("master identifier");
    await expect(validateDimensionCondition(adapter, { ...condition, operator: "contains_all" }, {})).rejects.toThrow("operator");
  });
});
