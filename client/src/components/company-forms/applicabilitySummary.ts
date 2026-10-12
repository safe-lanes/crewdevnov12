import type { ApplicabilityMode } from "@shared/v2/admin/applicability";
import type { RuleDimension, RuleMasterChoice } from "@shared/v2/forms-engine/ruleDimensions";

export type ApplicabilitySummaryPolicy = {
  mode: ApplicabilityMode;
  obligation: "mandatory" | "optional" | null;
  effectiveKind: "on_release" | "specific_date" | null;
  specificDate: string | null;
  effectiveFrom: string | null;
  sets: Array<{ conditions: Array<{
    dimensionKey: string;
    operator: "in" | "not_in" | "contains_any" | "contains_all" | "is";
    value: string[] | boolean;
    valueLabels?: Array<{ id: string; label: string }>;
  }> }>;
};

type SummaryDimension = RuleDimension & { choices?: readonly RuleMasterChoice[] };

function dateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function valueLabels(
  value: string[] | boolean,
  labels: Array<{ id: string; label: string }> | undefined,
  dimension: SummaryDimension | undefined,
): string[] {
  if (typeof value === "boolean") return [value ? "Yes" : "No"];
  const choiceMap = new Map((dimension?.choices ?? []).map((choice) => [choice.id, choice.label]));
  const savedLabels = new Map((labels ?? []).map((choice) => [choice.id, choice.label]));
  return value.map((id) => savedLabels.get(id) ?? choiceMap.get(id) ?? "Unavailable selected value");
}

function conditionSentence(
  condition: ApplicabilitySummaryPolicy["sets"][number]["conditions"][number],
  dimension: SummaryDimension | undefined,
): string {
  const rawLabel = dimension?.label ?? "Unavailable condition";
  const label = rawLabel.charAt(0).toLocaleLowerCase() + rawLabel.slice(1);
  if (!dimension?.available) return `${label} is not available yet`;
  const values = valueLabels(condition.value, condition.valueLabels, dimension);
  const operator = condition.operator;
  if (operator === "is") return `${label} is ${values[0] ?? "not set"}`;
  if (operator === "in") return values.length === 1
    ? `${label} is ${values[0]}`
    : `${label} is one of ${values.join(", ") || "not set"}`;
  if (operator === "not_in") return values.length === 1
    ? `${label} is not ${values[0]}`
    : `${label} is none of ${values.join(", ") || "not set"}`;
  if (operator === "contains_any") return `${label} includes any of ${values.join(", ") || "a selected value"}`;
  return `${label} includes all of ${values.join(", ") || "the selected values"}`;
}

function whoApplies(
  policy: ApplicabilitySummaryPolicy,
  dimensions: readonly SummaryDimension[],
): string {
  if (policy.mode === "all") return "all crew";
  if (policy.mode === "manual_only") return "crew assigned manually";
  if (!policy.sets.length) return "crew matching the configured conditions";

  const byKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  return policy.sets.map((set) => {
    if (!set.conditions.length) return "any crew member";
    const clauses = set.conditions.map((condition) =>
      conditionSentence(condition, byKey.get(condition.dimensionKey)),
    );
    return `crew whose ${clauses.join(" and ")}`;
  }).join(", or ");
}

/** A short human-readable statement of the full completion policy. */
export function summarizeApplicability(
  policy: ApplicabilitySummaryPolicy,
  dimensions: readonly SummaryDimension[] = [],
  options: { status?: string } = {},
): string {
  if (policy.mode === "manual_only") {
    return "Manual start only: crew may start this form manually. It never makes the form mandatory, blocks progress, satisfies another requirement, or skips a requirement.";
  }

  const obligation = policy.obligation === "optional" ? "Optional" : "Mandatory";
  const specificDate = policy.effectiveKind === "specific_date" ? dateLabel(policy.specificDate) : null;
  const effectiveFromDate = policy.effectiveKind === "on_release" && options.status === "released"
    ? dateLabel(policy.effectiveFrom)
    : null;
  const timing = specificDate
    ? `from ${specificDate}`
    : policy.effectiveKind === "specific_date"
      ? "from a specific date that still needs to be selected"
      : effectiveFromDate
        ? `from release (effective ${effectiveFromDate})`
        : "from release";
  return `${obligation}, ${timing}, for ${whoApplies(policy, dimensions)}.`;
}
