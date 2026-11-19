import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { withAccountDb } from "../accountDbScope";
import { coordinateAccounts } from "../accountCoordination";
import { accEngagementsV2 } from "../../../../shared/v2/accounts/schema";
import type { AccEngagementV2 } from "../../../../shared/v2/accounts/types";
import {
  eligibilityReason, isValuePayItem, itemOverlaps,
  type EligibilityElement, type ElementEligibilitySlice,
  type ContractSetupSlice, type PayItemMode, type PayItemRuleRow,
} from "../../../../shared/v2/accounts/contractPayItemRules";
import { EngagementsRepository, PayElementsRepository } from "../repositories";
import { readContractPayItemSetup } from "../engine/wageEngineService";
import { addDays, parseIsoDate } from "../engine/periodMath";
import {
  contractWindow,
  getEffectivePeriodReason,
  selectionChanged,
} from "../../../../shared/v2/accounts/payElementEffectivePeriod";

const engagements = new EngagementsRepository();
const elements = new PayElementsRepository();
const error = (code: string, message: string) => Object.assign(new Error(message), { code });

export interface PayItemOptionsInput {
  overrideMode: PayItemMode;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  editingItemUuid?: string;
}

/** The parent lock serializes pay-item writers; subsequent reads see the last commit. */
export async function withPayItemWrite<T>(engagementUuid: string, work: () => Promise<T>): Promise<T> {
  try {
    return await coordinateAccounts("shared", () => getDb().transaction(async (tx: any) =>
      withAccountDb(tx, async () => {
        const [parent] = await tx.select().from(accEngagementsV2)
          .where(eq(accEngagementsV2.engagementUuid, engagementUuid)).for("update");
        if (!parent || parent.isDeleted) throw error("NOT_FOUND", "Engagement not found");
        return work();
      }),
    ));
  } catch (caught: any) {
    const code = caught?.code ?? caught?.cause?.code;
    if (code === "40001" || code === "40P01") {
      throw error("CONFLICT", "Contract pay items changed. Refresh and try again.");
    }
    throw caught;
  }
}

function boundaryDates(rows: PayItemRuleRow[]): string[] {
  return rows.flatMap(row => [
    ...(row.effectiveFrom ? [row.effectiveFrom] : []),
    ...(row.effectiveTo && row.effectiveTo < "9999-12-31"
      ? [addDays(row.effectiveTo, 1)] : []),
  ]);
}

function validateWindow(input: { effectiveFrom?: string | null; effectiveTo?: string | null }) {
  for (const value of [input.effectiveFrom, input.effectiveTo]) {
    if (value && !parseIsoDate(value)) throw error("VALIDATION", "Enter valid effective dates.");
  }
  if (input.effectiveFrom && input.effectiveTo && input.effectiveFrom > input.effectiveTo) {
    throw error("VALIDATION", "Effective from must be on or before effective to");
  }
}

/**
 * Legacy fallback sources are anchored to the BEFORE setup. Deleting an Add
 * must not turn its dependent Replace into a newly invented underlying source.
 */
export function elementSlices(
  setup: { slices: ContractSetupSlice[]; nationalityUuid: string | null },
  element: EligibilityElement,
  beforeItems: PayItemRuleRow[],
  items: PayItemRuleRow[],
  window: { effectiveFrom?: string | null; effectiveTo?: string | null },
): ElementEligibilitySlice[] {
  const forElement = (rows: PayItemRuleRow[], from: string, to: string) =>
    rows.filter(row => isValuePayItem(row) && row.payElementUuid === element.payElementUuid &&
      itemOverlaps(row, from, to));
  return setup.slices.filter(slice =>
    (!window.effectiveFrom || slice.to >= window.effectiveFrom) &&
    (!window.effectiveTo || slice.from <= window.effectiveTo),
  ).map(slice => {
    const before = forElement(beforeItems, slice.from, slice.to);
    const current = forElement(items, slice.from, slice.to);
    const basePresent = slice.baseElementUuids.includes(element.payElementUuid);
    const fallbackIds = !basePresent && !before.some(row => row.overrideMode === "add_element")
      ? new Set(before.filter(row => row.eligibilityRulesVersion !== 1 &&
          row.overrideMode === "replace_scale_value" &&
          (row.amount != null || row.rate != null)).map(row => row.epeUuid))
      : new Set<string>();
    return {
      from: slice.from, to: slice.to, basePresent,
      applicable: !element.nationalityConditional ||
        (!!setup.nationalityUuid &&
          (element.applicableNationalityUuids ?? []).includes(setup.nationalityUuid)),
      providerItemUuids: current.filter(row => row.overrideMode === "add_element" ||
        (row.eligibilityRulesVersion !== 1 &&
          row.overrideMode === "replace_scale_value" && fallbackIds.has(row.epeUuid)))
        .map(row => row.epeUuid),
      modifierItemUuids: current.filter(row =>
        row.overrideMode === "replace_scale_value" || row.overrideMode === "suppress_element")
        .map(row => row.epeUuid),
    };
  });
}

export async function payItemOptions(engagementUuid: string, input: PayItemOptionsInput) {
  validateWindow(input);
  const engagement = await engagements.findByUuid(engagementUuid);
  if (!engagement) throw error("NOT_FOUND", "Engagement not found");
  const rows = await engagements.findOverridesByEngagement(engagementUuid);
  if (input.editingItemUuid && !rows.some(row => row.epeUuid === input.editingItemUuid)) {
    throw error("NOT_FOUND", "Pay item does not belong to this contract");
  }
  const setup = await readContractPayItemSetup(engagement, boundaryDates([
    ...rows, { ...input, epeUuid: "", payElementUuid: "" },
  ]));
  const options: Record<string, { disabled: boolean; reason: string | null }> = {};
  for (const element of await elements.findAll()) {
    const reason = eligibilityReason(element, input.overrideMode,
      elementSlices(setup, element, rows, rows, input), input.editingItemUuid);
    options[element.payElementUuid] = { disabled: reason != null, reason };
  }
  return { options };
}

export async function assertPayItemChangeAllowed(input: {
  engagement: AccEngagementV2;
  beforeItems: PayItemRuleRow[];
  afterItems: PayItemRuleRow[];
  changedItem?: PayItemRuleRow;
}): Promise<void> {
  const { engagement, beforeItems, afterItems, changedItem } = input;
  if (changedItem) validateWindow(changedItem);
  const setup = await readContractPayItemSetup(engagement,
    boundaryDates([...beforeItems, ...afterItems]));
  const byUuid = new Map((await elements.findAll()).map(element => [element.payElementUuid, element]));
  if (changedItem) {
    const element = byUuid.get(changedItem.payElementUuid);
    if (!element) throw error("VALIDATION", "Pay element is unavailable");
    const slices = elementSlices(setup, element, beforeItems, afterItems, changedItem);
    const reason = eligibilityReason(element, changedItem.overrideMode as PayItemMode,
      slices, changedItem.epeUuid);
    if (reason) throw error("VALIDATION", `${element.code}: ${reason}`);
    const previousItem = beforeItems.find(
      (row) => row.epeUuid === changedItem.epeUuid,
    );

    if (selectionChanged(previousItem, changedItem)) {
      const periodReason = getEffectivePeriodReason(
        element,
        contractWindow(engagement, changedItem),
      );

      if (periodReason) {
        throw error("VALIDATION", `${element.code}: ${periodReason}`);
      }
    }
  }
  for (const dependent of beforeItems.filter(row => isValuePayItem(row) &&
    row.overrideMode !== "add_element" && row.epeUuid !== changedItem?.epeUuid)) {
    const remaining = afterItems.find(row => row.epeUuid === dependent.epeUuid && !row.isDeleted);
    const element = byUuid.get(dependent.payElementUuid);
    if (!remaining || !element) continue;
    const before = elementSlices(setup, element, beforeItems, beforeItems, dependent);
    const after = elementSlices(setup, element, beforeItems, afterItems, dependent);
    const present = (slice: ElementEligibilitySlice) =>
      slice.basePresent || slice.providerItemUuids.some(uuid => uuid !== dependent.epeUuid);
    if (before.some((slice, index) => present(slice) && !present(after[index]))) {
      throw error("CONFLICT",
        `${element.code}: adjust or remove the dependent Replace/Suppress item first.`);
    }
  }
}
