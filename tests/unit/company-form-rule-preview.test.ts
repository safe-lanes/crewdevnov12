import { describe, expect, it } from "vitest";
import { evaluateRule } from "../../server/v2/company-forms/evaluateRule";
import type { AssignmentDimensionReport } from "../../shared/v2/forms-engine/ruleDimensions";
import type { ApplicabilityDraft } from "../../shared/v2/admin/applicabilityPreview";
import { createCrewAssignmentSubject } from "../../server/v2/company-forms/subjects/crewAssignmentSubject";
import type { CompanyFormPrincipal } from "../../server/v2/company-forms/contracts";
const fact = (key: string, value: string | boolean | string[] | null) => ({
  key, value, label: key, available: true, kind: "scalar" as const,
  operators: ["in" as const], labels: [], source: {}, status: value === null ? "unresolved" as const : "resolved" as const,
});
const c = (key: string, value: string[] | boolean, operator = "in") =>
  ({ dimensionKey: key, operator, value }) as NonNullable<ApplicabilityDraft["sets"]>[number]["conditions"][number];
const rule: ApplicabilityDraft = { mode: "conditional", obligation: "mandatory", sets: [
  { conditions: [c("type", ["LPG"]), c("nationality", ["Indian"])] }, { conditions: [c("rank", ["Master"])] },
] };
const facts = (...dimensions: AssignmentDimensionReport["dimensions"]): AssignmentDimensionReport => ({ subjectRef: "test", dimensions });
describe("Company Form read-only rule evaluation", () => {
  it("uses AND within cards and OR between cards", () => {
    expect(evaluateRule(rule, facts(fact("type", "LPG"), fact("nationality", "Indian"), fact("rank", "AB"))).outcome).toBe("applies");
    expect(evaluateRule(rule, facts(fact("type", "Container"), fact("nationality", "Indian"), fact("rank", "Master"))).outcome).toBe("applies");
    expect(evaluateRule(rule, facts(fact("type", "LPG"), fact("nationality", "Other"), fact("rank", "AB"))).outcome).toBe("does_not_apply");
  });
  it("never treats missing facts as a negative match, including negative comparisons", () => {
    const result = evaluateRule({ ...rule, sets: [{ conditions: [c("first", true, "is"), c("rank", ["AB"], "not_in")] }] }, facts(fact("first", null), fact("rank", null)));
    expect(result.outcome).toBe("unresolved");
    expect(result.sets[0].conditions.every(c => c.outcome === "unresolved")).toBe(true);
  });
  it("discloses unresolved branches even when a complete OR branch matches", () => {
    const result = evaluateRule(rule, facts(fact("type", null), fact("nationality", "Indian"), fact("rank", "Master")));
    expect(result.outcome).toBe("applies"); expect(result.sets[0].outcome).toBe("unresolved");
  });
  it("evaluates set membership and booleans", () => {
    const p: ApplicabilityDraft = { ...rule, sets: [{ conditions: [c("groups", ["A", "B"], "contains_all"), c("first", false, "is")] }] };
    expect(evaluateRule(p, facts(fact("groups", ["A", "B"]), fact("first", false))).outcome).toBe("applies");
  });
  it("manual only is never a requirement and all does not need unrelated facts", () => {
    expect(evaluateRule({ mode: "manual_only" }, facts()).outcome).toBe("manual_only");
    expect(evaluateRule({ mode: "all", obligation: "optional" }, facts()).outcome).toBe("applies");
  });
  it("does not mutate policy or facts", () => {
    const report = facts(fact("rank", "Master")); const before = JSON.stringify([rule, report]);
    evaluateRule(rule, report); expect(JSON.stringify([rule,report])).toBe(before);
  });
  it("authoring reads do not invoke operational grants and vessel reads keep their exact scope", () => {
    const adapter = createCrewAssignmentSubject({ authorizeOffice: async () => { throw Error("Operational permission must not be queried"); } });
    const subject = { assignUuid: "assignment", crewUuid: "crew", vesselUuid: "vessel",
      isDeleted: false, isCurrent: true, signOnDate: null, signOffDate: null, assignmentType: "OnBoard" };
    const office: CompanyFormPrincipal = { kind: "office", userId: 1, roleId: "author", roleName: "Forms Author", roleType: "Office" };
    expect(adapter.authorizeRuleRead!(office, subject)).toBe(true);
    const ship: CompanyFormPrincipal = { kind: "vessel", userId: 2, roleId: "ship", roleName: "Author aboard",
      roleType: "Ship", vesselUuids: ["vessel"] };
    expect(adapter.authorizeRuleRead!(ship, subject)).toBe(true);
    expect(adapter.authorizeRuleRead!({ ...ship, vesselUuids: ["other"] }, subject)).toBe(false);
    expect(adapter.authorizeRuleRead!(office, { ...subject, isDeleted: true })).toBe(false);
  });
});
