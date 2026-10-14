export type ApplicabilityMode = "manual_only" | "all" | "conditional";
export type ApplicabilityCondition = {
  conditionUuid: string;
  dimensionKey: string;
  operator: "in" | "not_in" | "contains_any" | "contains_all" | "is";
  value: string[] | boolean;
  valueLabels?: Array<{ id: string; label: string }>;
};
export type ApplicabilitySet = { setUuid: string; conditions: ApplicabilityCondition[] };
export type VersionApplicability = {
  versionUuid: string;
  mode: ApplicabilityMode;
  obligation: "mandatory" | "optional" | null;
  effectiveKind: "on_release" | "specific_date" | null;
  specificDate: string | null;
  effectiveFrom: string | null;
  copiedFromVersionUuid: string | null;
  sets: ApplicabilitySet[];
};
export type VersionChangeSummary = {
  previousVersionUuid: string | null;
  contentChanged: boolean;
  applicabilityChanged: boolean;
  details: string[];
};
export const applicabilityModeLabels: Record<ApplicabilityMode, string> = {
  manual_only: "Manual only", all: "Applies to all", conditional: "Applies when conditions match",
};
