import { monthStart, monthEnd } from "./wageScaleRevisionDates";

export const NOT_EFFECTIVE_FOR_PERIOD =
  "Not effective for the selected period";

export interface EffectiveWindow {
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

interface ElementSelection extends EffectiveWindow {
  payElementUuid?: string | null;
}

export function getEffectivePeriodReason(
  element: EffectiveWindow | null | undefined,
  window: EffectiveWindow,
): string | null {
  if (!element || (!window.effectiveFrom && !window.effectiveTo)) {
    return null;
  }

  const from = window.effectiveFrom || "0001-01-01";
  const to = window.effectiveTo || "9999-12-31";

  return (
    from > to ||
    (element.effectiveFrom && element.effectiveFrom > to) ||
    (element.effectiveTo && element.effectiveTo < from)
  )
    ? NOT_EFFECTIVE_FOR_PERIOD
    : null;
}

export function monthWindow(
  period: string | null | undefined,
): EffectiveWindow {
  if (!period) return {};

  return {
    effectiveFrom: monthStart(period),
    effectiveTo: monthEnd(period),
  };
}

export function contractWindow(
  engagement: {
    startDate?: string | null;
    endDate?: string | null;
  },
  item: EffectiveWindow = {},
): EffectiveWindow {
  const starts = [engagement.startDate, item.effectiveFrom]
    .filter((value): value is string => !!value)
    .sort();
  const ends = [engagement.endDate, item.effectiveTo]
    .filter((value): value is string => !!value)
    .sort();

  return {
    effectiveFrom: starts[starts.length - 1] ?? null,
    effectiveTo: ends[0] ?? null,
  };
}

export function selectionChanged(
  before: ElementSelection | null | undefined,
  after: ElementSelection,
): boolean {
  return !before ||
    (["payElementUuid", "effectiveFrom", "effectiveTo"] as const)
      .some((key) => (before[key] || null) !== (after[key] || null));
}

export function scaleCellKey(line: {
  rankId?: string | null;
  nationalityUuid?: string | null;
  experienceMinMonths?: number | null;
  payElementUuid?: string | null;
}): string {
  return [
    line.rankId,
    line.nationalityUuid ?? "",
    line.experienceMinMonths ?? "",
    line.payElementUuid,
  ].join("|");
}
