export type PayItemMode = "add_element" | "replace_scale_value" | "suppress_element";

export interface EligibilityElement {
  payElementUuid: string;
  status: string;
  category: string;
  calcMethod: string;
  nationalityConditional?: boolean | null;
  applicableNationalityUuids?: string[] | null;
}

export interface PayItemRuleRow {
  epeUuid: string;
  payElementUuid: string;
  overrideMode: string;
  amount?: string | null;
  rate?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  paymentTimingOverride?: string | null;
  eligibilityRulesVersion?: number;
  isDeleted?: boolean | null;
}

export interface ElementEligibilitySlice {
  from: string;
  to: string;
  applicable: boolean;
  basePresent: boolean;
  providerItemUuids: string[];
  modifierItemUuids: string[];
}

export interface ContractSetupSlice {
  from: string;
  to: string;
  baseElementUuids: string[];
}

export function dedicatedScreenReason(element: EligibilityElement): string | null {
  switch (element.category) {
    case "allotment": return "Manage in Allotments";
    case "advance_recovery": return "Manage in Advances";
    case "bond_slop_chest": return "Manage in Vessel Portage";
  }
  return element.calcMethod === "manual_entry" ? "Manage in transaction entry" : null;
}

export function eligibilityReason(
  element: EligibilityElement,
  mode: PayItemMode,
  slices: ElementEligibilitySlice[],
  editingItemUuid?: string,
): string | null {
  if (element.status !== "active") return "Inactive";
  const ownerReason = dedicatedScreenReason(element);
  if (ownerReason) return ownerReason;
  if (slices.length === 0) return "No applicable contract period";
  if (slices.some((slice) => !slice.applicable)) {
    return "Not applicable to this crew member";
  }
  const present = (slice: ElementEligibilitySlice) =>
    slice.basePresent ||
    slice.providerItemUuids.some((uuid) => uuid !== editingItemUuid);
  if (mode === "add_element") {
    return slices.some(present) ? "Already added" : null;
  }
  if (slices.some((slice) => !present(slice))) return "Not currently added";
  if (slices.some((slice) =>
    slice.modifierItemUuids.some((uuid) => uuid !== editingItemUuid))) {
    return "Conflicting instruction";
  }
  return null;
}

export function isValuePayItem(row: PayItemRuleRow): boolean {
  return !row.isDeleted && !(
    row.amount == null && row.rate == null &&
    row.paymentTimingOverride != null &&
    row.overrideMode === "replace_scale_value"
  );
}

export function itemOverlaps(row: PayItemRuleRow, from: string, to: string): boolean {
  return (row.effectiveFrom == null || row.effectiveFrom <= to) &&
    (row.effectiveTo == null || row.effectiveTo >= from);
}

function canonicalDecimal(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(value);
  if (!match) return value;
  const whole = match[2].replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  const number = whole + (fraction ? `.${fraction}` : "");
  return (match[1] === "-" && number !== "0" ? "-" : "") + number;
}

export function hasMeaningfulPayItemChange(
  before: Partial<PayItemRuleRow>,
  after: Partial<PayItemRuleRow>,
): boolean {
  return (["payElementUuid", "overrideMode", "effectiveFrom", "effectiveTo"] as const)
    .some((key) => (before[key] || null) !== (after[key] || null)) ||
    (["amount", "rate"] as const)
      .some((key) => canonicalDecimal(before[key]) !== canonicalDecimal(after[key]));
}
