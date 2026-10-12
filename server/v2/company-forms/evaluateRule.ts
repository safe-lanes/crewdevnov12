import type { ApplicabilityDraft, RuleOutcome, RulePreview } from "../../../shared/v2/admin/applicabilityPreview";
import type { AssignmentDimensionReport } from "../../../shared/v2/forms-engine/ruleDimensions";

/** Pure three-valued trial. No repository access, clock, capture or resolution. */
export function evaluateRule(policy: ApplicabilityDraft, facts: AssignmentDimensionReport): Pick<RulePreview, "outcome" | "explanation" | "sets"> {
  if (policy.mode === "manual_only") return {
    outcome: "manual_only", sets: [],
    explanation: "Manual only. This form creates no automatic requirement and a manual start never fulfils or skips one.",
  };
  if (policy.mode === "all") return {
    outcome: "applies", sets: [], explanation: "These conditions apply to all seafarers for the selected stage.",
  };
  const sets = (policy.sets ?? []).map(set => {
    const conditions = set.conditions.map(condition => {
      const fact = facts.dimensions.find(d => d.key === condition.dimensionKey);
      const label = fact?.label ?? "Unavailable condition";
      if (!fact || fact.status !== "resolved" || fact.value === null) return {
        label, outcome: "unresolved" as RuleOutcome, observed: "Unresolved",
        explanation: "A reliable recorded value is missing. This condition cannot be decided; review Form rule facts.",
      };
      const expected = condition.value;
      const actual = fact.value;
      const list = Array.isArray(actual) ? actual : [actual];
      const match = condition.operator === "is" ? actual === expected :
        condition.operator === "in" ? Array.isArray(expected) && expected.includes(actual as string) :
        condition.operator === "not_in" ? Array.isArray(expected) && !expected.includes(actual as string) :
        condition.operator === "contains_all" ? Array.isArray(expected) && expected.every(v => list.includes(v)) :
        Array.isArray(expected) && expected.some(v => list.includes(v));
      return { label, outcome: (match ? "applies" : "does_not_apply") as RuleOutcome,
        observed: typeof actual === "boolean" ? actual ? "Yes" : "No" : fact.labels.join(", ") || "Recorded value",
        explanation: match ? "The recorded value matches this condition." : "The recorded value does not match this condition." };
    });
    // Conservatively disclose missing deciding facts, never silently demote to false.
    const outcome: RuleOutcome = conditions.some(c => c.outcome === "unresolved") ? "unresolved" :
      conditions.every(c => c.outcome === "applies") ? "applies" : "does_not_apply";
    return { outcome, conditions };
  });
  const outcome: RuleOutcome = sets.some(s => s.outcome === "applies") ? "applies" :
    sets.some(s => s.outcome === "unresolved") ? "unresolved" : "does_not_apply";
  return { outcome, sets, explanation: outcome === "applies" ? "All conditions in at least one card match." :
    outcome === "unresolved" ? "Missing recorded facts prevent a reliable decision." : "No condition card matches all its conditions." };
}
