import type { CompanyFormSubjectAdapter } from "./contracts";
import type { ApplicabilityCondition } from "../../../shared/v2/admin/applicability";

/** Structural/master validation only: never evaluate a rule for an assignment. */
export async function validateDimensionCondition(
  adapter: CompanyFormSubjectAdapter<any>, condition: ApplicabilityCondition, tx: unknown,
) {
  const d = adapter.ruleDimensions?.find(dimension => dimension.key === condition.dimensionKey);
  const prefix = `Condition ${condition.conditionUuid} (${condition.dimensionKey}): `;
  if (!d) throw new Error(`${prefix}dimension is not declared by this subject`);
  if (!d.available) throw new Error(`${prefix}${d.unavailableReason ?? "dimension is not yet available"}`);
  if (!d.operators.includes(condition.operator)) throw new Error(`${prefix}operator is not supported`);
  if (d.kind === "boolean") {
    if (typeof condition.value !== "boolean") throw new Error(`${prefix}a boolean value is required`);
    return [];
  }
  if (!Array.isArray(condition.value) || !condition.value.length) throw new Error(`${prefix}selected master identifiers are required`);
  if (!adapter.ruleMasterChoices) throw new Error(`${prefix}master choices are not available`);
  const choices = await adapter.ruleMasterChoices(d.key, tx, true);
  return condition.value.map(id => {
    const matches = choices.filter(choice => choice.id === id);
    if (matches.length !== 1) throw new Error(`${prefix}master identifier ${id} is missing, invalid or ambiguous`);
    return matches[0];
  });
}
