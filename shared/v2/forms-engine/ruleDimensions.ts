/** Subject-neutral applicability contracts. Business sources belong to adapters. */
export type RuleOperator = "in" | "not_in" | "contains_any" | "contains_all" | "is";
export type RuleDimension = {
  key: string;
  label: string;
  kind: "scalar" | "set" | "boolean";
  operators: readonly RuleOperator[];
  available: boolean;
  unavailableReason?: string;
};
export type RuleMasterChoice = { id: string; label: string };
export type RuleDimensionValue = {
  key: string;
  status: "resolved" | "unresolved" | "not_yet_available";
  value: string | string[] | boolean | null;
  labels: string[];
  reason?: string;
  source: Record<string, unknown>;
};
export type AssignmentDimensionReport = {
  subjectRef: string;
  dimensions: Array<RuleDimension & RuleDimensionValue>;
};
