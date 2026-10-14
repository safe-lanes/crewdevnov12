import type { ApplicabilityMode } from "@shared/v2/admin/applicability";
import type { RuleOperator } from "@shared/v2/forms-engine/ruleDimensions";

export type EditableApplicabilityCondition = {
  uiKey: string;
  conditionUuid?: string;
  dimensionKey: string;
  operator: RuleOperator;
  value: string[] | boolean;
  valueLabels?: Array<{ id: string; label: string }>;
};

export type EditableApplicabilitySet = {
  uiKey: string;
  setUuid?: string;
  conditions: EditableApplicabilityCondition[];
};

export type EditableApplicabilityPolicy = {
  mode: ApplicabilityMode;
  obligation: "mandatory" | "optional";
  effectiveKind: "on_release" | "specific_date";
  specificDate: string;
  effectiveFrom: string | null;
  sets: EditableApplicabilitySet[];
};
