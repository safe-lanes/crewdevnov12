import { describe, it, expect } from "vitest";
import { checklistOverrideEligible, checklistBlockerMessage, type ChecklistBlocker } from "../../server/v2/company-forms/checklistPolicy";

const requirement = (status: string): ChecklistBlocker =>
  ({ kind: "requirement", status, formName: "Pre-Joining Declaration" });
describe("Company Form checklist exception scope", () => {
  it.each(["OUTSTANDING", "STARTED"])("refuses %s even alongside missing facts and failed checks", status => {
    const blockers: ChecklistBlocker[] = [requirement("UNRESOLVED"), requirement(status), { kind: "check", status: "FAILED" }];
    expect(checklistOverrideEligible(blockers)).toBe(false);
    expect(checklistBlockerMessage(blockers)).toContain("Pre-Joining Declaration: this mandatory form must be completed.");
  });
  it("allows only an entirely unresolved/pending/failed blocker set", () => {
    expect(checklistOverrideEligible([requirement("UNRESOLVED"), { kind: "check", status: "PENDING" },
      { kind: "check", status: "FAILED" }])).toBe(true);
  });
  it("does not override a missing deployment or invent an empty exception", () => {
    expect(checklistOverrideEligible([{ kind: "check", status: "NOT_CHECKED" }])).toBe(false);
    expect(checklistOverrideEligible([])).toBe(false);
  });
});
