import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import type { RuleDimension, RuleMasterChoice, RuleOperator } from "@shared/v2/forms-engine/ruleDimensions";
import type { EditableApplicabilityCondition, EditableApplicabilitySet } from "./companyFormApplicabilityTypes";

export type ApplicabilityEditorDimension = RuleDimension & { choices: RuleMasterChoice[] };

const operatorLabels: Record<RuleOperator, string> = {
  in: "is any of",
  not_in: "is none of",
  contains_any: "contains any of",
  contains_all: "contains all of",
  is: "is",
};

export function createCondition(
  key: string,
  dimensions: readonly ApplicabilityEditorDimension[],
): EditableApplicabilityCondition {
  const first = dimensions.find((dimension) => dimension.available);
  const firstOperator = first?.operators[0] ?? "in";
  return {
    uiKey: key,
    dimensionKey: first?.key ?? "",
    operator: firstOperator,
    value: first?.kind === "boolean" ? false : [],
  };
}

export function isConditionValid(
  condition: EditableApplicabilityCondition,
  dimensions: readonly ApplicabilityEditorDimension[],
): boolean {
  const dimension = dimensions.find((item) => item.key === condition.dimensionKey);
  if (!dimension?.available || !dimension.operators.includes(condition.operator)) return false;
  if (dimension.kind === "boolean") return condition.operator === "is" && typeof condition.value === "boolean";
  if (typeof condition.value === "boolean" || condition.value.length === 0) return false;
  return condition.value.every((id) => dimension.choices.some((choice) => choice.id === id));
}

export function isApplicabilitySetValid(
  set: EditableApplicabilitySet,
  dimensions: readonly ApplicabilityEditorDimension[],
): boolean {
  return set.conditions.length > 0 && set.conditions.every((condition) => isConditionValid(condition, dimensions));
}

interface CompanyFormConditionCardProps {
  set: EditableApplicabilitySet;
  index: number;
  dimensions: readonly ApplicabilityEditorDimension[];
  disabled?: boolean;
  onChange: (next: EditableApplicabilitySet) => void;
  onRemove: () => void;
  onAddCondition: () => void;
  onRemoveCondition: (uiKey: string) => void;
}

export function CompanyFormConditionCard({
  set,
  index,
  dimensions,
  disabled = false,
  onChange,
  onRemove,
  onAddCondition,
  onRemoveCondition,
}: CompanyFormConditionCardProps) {
  const [searches, setSearches] = useState<Record<string, string>>({});

  const updateCondition = (uiKey: string, updater: (current: EditableApplicabilityCondition) => EditableApplicabilityCondition) => {
    onChange({
      ...set,
      conditions: set.conditions.map((condition) => condition.uiKey === uiKey ? updater(condition) : condition),
    });
  };

  const changeDimension = (condition: EditableApplicabilityCondition, dimensionKey: string) => {
    const dimension = dimensions.find((item) => item.key === dimensionKey);
    if (!dimension?.available) return;
    updateCondition(condition.uiKey, (current) => ({
      ...current,
      dimensionKey,
      operator: dimension.operators[0] ?? "in",
      value: dimension.kind === "boolean" ? false : [],
      valueLabels: [],
    }));
  };

  const changeChoice = (
    condition: EditableApplicabilityCondition,
    dimension: ApplicabilityEditorDimension,
    choiceId: string,
    checked: boolean,
  ) => {
    if (typeof condition.value === "boolean") return;
    const nextIds = checked
      ? [...condition.value, choiceId]
      : condition.value.filter((id) => id !== choiceId);
    const oldLabels = new Map((condition.valueLabels ?? []).map((choice) => [choice.id, choice.label]));
    const labels = nextIds.flatMap((id) => {
      const label = dimension.choices.find((choice) => choice.id === id)?.label ?? oldLabels.get(id);
      return label ? [{ id, label }] : [];
    });
    updateCondition(condition.uiKey, (current) => ({ ...current, value: nextIds, valueLabels: labels }));
  };

  return (
    <section className="rounded-lg border border-[#d4e0e5] bg-white p-4" aria-labelledby={`condition-set-title-${index + 1}`} data-testid="company-form-condition-card">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 id={`condition-set-title-${index + 1}`} className="text-sm font-semibold text-[#284959]">All of these must match</h4>
          <p className="mt-0.5 text-xs text-[#657b86]">Crew group {index + 1}</p>
        </div>
        <button type="button" disabled={disabled} onClick={onRemove} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-[#8b4e43] hover:bg-[#fbf1ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] disabled:opacity-50" aria-label={`Remove crew group ${index + 1}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove group
        </button>
      </header>

      <div className="mt-3 space-y-3">
        {set.conditions.map((condition, conditionIndex) => {
          const dimension = dimensions.find((item) => item.key === condition.dimensionKey);
          const unavailableDimension = !dimension || !dimension.available;
          const valueIsValid = dimension ? isConditionValid(condition, dimensions) : false;
          const search = searches[condition.uiKey] ?? "";
          const selectedIds = typeof condition.value === "boolean" ? [] : condition.value;
          const selectedMissing = selectedIds.filter((id) => !dimension?.choices.some((choice) => choice.id === id));
          const selectedLabelMap = new Map((condition.valueLabels ?? []).map((choice) => [choice.id, choice.label]));
          const visibleChoices = (dimension?.choices ?? []).filter((choice) =>
            choice.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
          );
          return (
            <div key={condition.uiKey} className="rounded-md border border-[#e2e9ec] bg-[#fbfcfc] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[#68808b]">Condition {conditionIndex + 1}</span>
                <button type="button" disabled={disabled} onClick={() => onRemoveCondition(condition.uiKey)} className="rounded px-2 py-1 text-xs text-[#8b4e43] hover:bg-[#fbf1ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] disabled:opacity-50">
                  Remove condition
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(150px,0.85fr)_minmax(150px,0.75fr)_minmax(220px,1.4fr)]">
                <label className="block text-xs font-medium text-[#526b77]">
                  Crew detail
                  <select
                    value={condition.dimensionKey}
                    disabled={disabled}
                    onChange={(event) => changeDimension(condition, event.target.value)}
                    className="mt-1 block h-10 w-full rounded-md border border-[#cfdde2] bg-white px-2 text-sm font-normal text-[#294655] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] disabled:bg-[#f1f4f5]"
                    aria-label="Crew detail"
                  >
                    <option value="" disabled>Choose a detail</option>
                    {dimension && !dimensions.some((item) => item.key === dimension.key) && <option value={dimension.key}>{dimension.label}</option>}
                    {dimensions.map((item) => (
                      <option key={item.key} value={item.key} disabled={!item.available}>
                        {item.label}{!item.available ? " — Not yet available" : ""}
                      </option>
                    ))}
                    {!dimension && condition.dimensionKey && <option value={condition.dimensionKey}>Unavailable crew detail</option>}
                  </select>
                  {unavailableDimension && condition.dimensionKey && <span className="mt-1 block text-xs text-[#a34d40]">This crew detail is not available; remove or replace it.</span>}
                </label>

                <label className="block text-xs font-medium text-[#526b77]">
                  Match rule
                  <select
                    value={condition.operator}
                    disabled={disabled || unavailableDimension}
                    onChange={(event) => updateCondition(condition.uiKey, (current) => ({ ...current, operator: event.target.value as RuleOperator }))}
                    className="mt-1 block h-10 w-full rounded-md border border-[#cfdde2] bg-white px-2 text-sm font-normal text-[#294655] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] disabled:bg-[#f1f4f5]"
                    aria-label="Match rule"
                  >
                    {!dimension?.operators.includes(condition.operator) && <option value={condition.operator} disabled>Unavailable match rule</option>}
                    {(dimension?.operators ?? []).map((operator) => <option value={operator} key={operator}>{operatorLabels[operator]}</option>)}
                  </select>
                </label>

                <div className="min-w-0 text-xs font-medium text-[#526b77]">
                  Match value
                  {dimension?.kind === "boolean" ? (
                    <select
                      value={typeof condition.value === "boolean" ? String(condition.value) : ""}
                      disabled={disabled || unavailableDimension}
                      onChange={(event) => updateCondition(condition.uiKey, (current) => ({ ...current, value: event.target.value === "true" }))}
                      className="mt-1 block h-10 w-full rounded-md border border-[#cfdde2] bg-white px-2 text-sm font-normal text-[#294655] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] disabled:bg-[#f1f4f5]"
                      aria-label="Match value"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <div className="mt-1 rounded-md border border-[#cfdde2] bg-white p-2">
                      <label className="relative block">
                        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-[#78909a]" aria-hidden="true" />
                        <span className="sr-only">Search {dimension?.label ?? "crew detail"} choices</span>
                        <input
                          type="search"
                          value={search}
                          onChange={(event) => setSearches((current) => ({ ...current, [condition.uiKey]: event.target.value }))}
                          disabled={disabled || unavailableDimension}
                          placeholder="Search choices"
                          className="h-8 w-full rounded border border-[#e0e7ea] pl-7 pr-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] disabled:bg-[#f1f4f5]"
                        />
                      </label>
                      {selectedMissing.length > 0 && (
                        <div className="mt-2 space-y-1 border-b border-[#e6d4cf] pb-2">
                          {selectedMissing.map((id) => {
                            const label = selectedLabelMap.get(id) ?? "Unavailable selected value";
                            return (
                              <div key={id} className="flex items-start gap-2 rounded bg-[#fff5f2] px-2 py-1.5 text-xs text-[#8b493d]">
                                <label className="flex min-w-0 flex-1 items-start gap-2">
                                  <input type="checkbox" checked disabled={disabled} onChange={(event) => dimension && changeChoice(condition, dimension, id, event.target.checked)} className="mt-0.5 accent-[#9c5547]" />
                                  <span>{label} <span className="font-medium">(no longer available)</span></span>
                                </label>
                                {!disabled && <button type="button" onClick={() => dimension && changeChoice(condition, dimension, id, false)} className="shrink-0 underline underline-offset-2" aria-label={`Remove ${label}`}>Remove</button>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                        {visibleChoices.map((choice) => {
                          const checked = selectedIds.includes(choice.id);
                          return (
                            <label key={choice.id} className="flex items-start gap-2 rounded px-2 py-1 text-sm font-normal text-[#365461] hover:bg-[#f2f7f8]">
                              <input type="checkbox" checked={checked} disabled={disabled || unavailableDimension} onChange={(event) => changeChoice(condition, dimension!, choice.id, event.target.checked)} className="mt-0.5 accent-[#3e7386]" />
                              <span>{choice.label}</span>
                            </label>
                          );
                        })}
                        {visibleChoices.length === 0 && <p className="px-2 py-2 text-xs font-normal text-[#718791]">{dimension?.available ? "No matching choices." : dimension?.unavailableReason ?? "Not yet available."}</p>}
                      </div>
                      {!valueIsValid && !unavailableDimension && <p className="mt-2 text-xs font-medium text-[#a34d40]" role="alert">Choose one or more available values to make this condition valid.</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" disabled={disabled} onClick={onAddCondition} className="mt-3 inline-flex items-center gap-1 rounded-md border border-[#cad9df] px-3 py-2 text-sm font-medium text-[#315f70] hover:bg-[#f2f7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] disabled:opacity-50">
        <Plus className="h-4 w-4" aria-hidden="true" /> Add condition
      </button>
    </section>
  );
}
