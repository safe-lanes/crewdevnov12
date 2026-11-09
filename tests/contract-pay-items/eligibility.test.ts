import { describe, expect, it } from "vitest";
import {
  eligibilityReason, hasMeaningfulPayItemChange, isValuePayItem,
  type PayItemMode, type ElementEligibilitySlice,
} from "../../shared/v2/accounts/contractPayItemRules";

const element = { payElementUuid: "basic", status: "active", category: "basic", calcMethod: "scale_lookup" };
const slice = (basePresent = false, providers: string[] = [], modifiers: string[] = []): ElementEligibilitySlice => ({
  from: "2090-01-01", to: "2090-01-31", applicable: true,
  basePresent, providerItemUuids: providers, modifierItemUuids: modifiers,
});
describe("contract pay-item eligibility", () => {
  it.each<PayItemMode>(["add_element", "replace_scale_value", "suppress_element"])(
    "disables inactive and dedicated-screen elements in %s", mode => {
      expect(eligibilityReason({ ...element, status: "inactive" }, mode, [slice(true)])).toBe("Inactive");
      expect(eligibilityReason({ ...element, category: "allotment" }, mode, [slice(true)])).toBe("Manage in Allotments");
      expect(eligibilityReason({ ...element, category: "advance_recovery" }, mode, [slice(true)])).toBe("Manage in Advances");
      expect(eligibilityReason({ ...element, category: "bond_slop_chest" }, mode, [slice(true)])).toBe("Manage in Vessel Portage");
      expect(eligibilityReason({ ...element, calcMethod: "manual_entry" }, mode, [slice(true)])).toBe("Manage in transaction entry");
    },
  );
  it("adds absent elements, not existing or suppressed underlying elements", () => {
    expect(eligibilityReason(element, "add_element", [slice()])).toBeNull();
    expect(eligibilityReason(element, "add_element", [slice(true)])).toBe("Already added");
    expect(eligibilityReason(element, "add_element", [slice(true, [], ["suppress"])])).toBe("Already added");
  });
  it.each<PayItemMode>(["replace_scale_value", "suppress_element"])(
    "requires presence throughout the window for %s", mode => {
      expect(eligibilityReason(element, mode, [slice(true)])).toBeNull();
      expect(eligibilityReason(element, mode, [slice(true), slice()])).toBe("Not currently added");
      expect(eligibilityReason(element, mode, [slice(false, ["add"])])).toBeNull();
    },
  );
  it("rejects Add when only part of the window is absent", () => {
    expect(eligibilityReason(element, "add_element", [slice(), slice(true)])).toBe("Already added");
  });
  it("does not conflict with the edited item itself", () => {
    expect(eligibilityReason(element, "add_element", [slice(false, ["self"])], "self")).toBeNull();
    expect(eligibilityReason(element, "replace_scale_value", [slice(true, [], ["self"])], "self")).toBeNull();
    expect(eligibilityReason(element, "replace_scale_value", [slice(true, [], ["other"])], "self")).toBe("Conflicting instruction");
  });
  it("keeps configured zero values and rates present without payroll or hours", () => {
    expect(eligibilityReason(element, "add_element", [slice(true)])).toBe("Already added");
    expect(eligibilityReason({ ...element, calcMethod: "rate_times_qty" }, "replace_scale_value", [slice(true)])).toBeNull();
  });
  it("fails closed on unavailable periods and nationality restrictions", () => {
    expect(eligibilityReason(element, "add_element", [])).toBe("No applicable contract period");
    expect(eligibilityReason(element, "add_element", [{ ...slice(), applicable: false }])).toBe("Not applicable to this crew member");
  });
  it("ignores equivalent decimal formatting and remarks-only changes", () => {
    const before = { payElementUuid: "basic", overrideMode: "add_element", amount: "100.00", rate: "0.0000" };
    expect(hasMeaningfulPayItemChange(before, { ...before, amount: "0100", rate: "-0" })).toBe(false);
    expect(hasMeaningfulPayItemChange(before, { ...before, amount: "101" })).toBe(true);
    expect(hasMeaningfulPayItemChange(before, { ...before, effectiveFrom: "2090-02-01" })).toBe(true);
    expect(hasMeaningfulPayItemChange(before, { ...before, payElementUuid: "other" })).toBe(true);
    expect(hasMeaningfulPayItemChange(before, { ...before, overrideMode: "replace_scale_value" })).toBe(true);
  });
  it("does not count timing-only rows as pay items", () => {
    expect(isValuePayItem({ epeUuid: "timing", payElementUuid: "basic",
      overrideMode: "replace_scale_value", paymentTimingOverride: "paid_on_board" })).toBe(false);
  });
});
