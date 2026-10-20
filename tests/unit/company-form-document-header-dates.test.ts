import { describe, it, expect } from "vitest";
import { documentHeaderFields } from "../../server/v2/company-forms/documentHeaderDates";
import type { FrozenDocumentInput } from "../../shared/v2/forms-engine/documentEvidence";

function input(stageKey: string, planned: string | null, actual: string | null) {
  return { source: { stageKey }, header: { subject: { fields: [
    { label: "Vessel", value: "Frozen vessel" },
    { label: "Planned joining date", value: planned },
    { label: "Sign-on date", value: actual },
  ] } } } as FrozenDocumentInput;
}
describe("frozen stage-specific document dates", () => {
  it("uses the frozen planned joining date before joining, never sign-on", () => {
    expect(documentHeaderFields(input("before_joining", "2026-10-23", "2026-10-24")))
      .toEqual([{ label: "Vessel", value: "Frozen vessel" },
        { label: "Planned joining date", value: "2026-10-23" }]);
  });
  it("omits missing planned and sign-on dates rather than inventing a value", () => {
    expect(documentHeaderFields(input("before_joining", null, null))).toHaveLength(1);
    expect(documentHeaderFields(input("on_board", "2026-10-23", null))).toHaveLength(1);
  });
  it.each(["on_board", "at_sign_off"])("shows only actual sign-on for %s", stage => {
    expect(documentHeaderFields(input(stage, "2026-10-23", "2026-10-24")))
      .toEqual([{ label: "Vessel", value: "Frozen vessel" },
        { label: "Sign-on date", value: "2026-10-24" }]);
  });
});
