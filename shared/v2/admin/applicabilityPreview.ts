import type { VersionApplicability } from "./applicability";

/** Transient author input: never persists or accepts deciding facts. */
export type ApplicabilityDraft = {
  mode: VersionApplicability["mode"];
  obligation?: "mandatory" | "optional";
  effectiveKind?: "on_release" | "specific_date";
  specificDate?: string;
  sets?: Array<{ setUuid?: string; conditions: Array<{
    conditionUuid?: string; dimensionKey: string;
    operator: "in" | "not_in" | "contains_any" | "contains_all" | "is";
    value: string[] | boolean;
  }> }>;
};
export type RuleAssignmentChoice = { subjectRef: string; label: string };
export type RuleOutcome = "applies" | "does_not_apply" | "unresolved" | "manual_only";
export type RulePreview = {
  outcome: RuleOutcome;
  explanation: string;
  stageLabel: string;
  timing: string;
  sets: Array<{ outcome: RuleOutcome; conditions: Array<{
    label: string; outcome: RuleOutcome; observed: string; explanation: string;
  }> }>;
};
