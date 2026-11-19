type SourceDates = {
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};
export const MISSING_SUPERSEDED_FROM =
  "Effective From date of the superseded Wage Scale is not present. Please enter an Effective From date first.";
export function isIsoDate(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000-")
  ) {
    return false;
  }
  const date = new Date(value + "T00:00:00.000Z");
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function shiftIsoDate(value: string, days: number): string {
  if (!isIsoDate(value)) {
    throw new Error("Invalid effective date");
  }
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  if (!isIsoDate(result)) {
    throw new Error(
      "Effective date is outside the supported calendar range",
    );
  }
  return result;
}
export function getRevisionDateError(
  source: SourceDates,
  revisionFrom: string | null | undefined,
): string | null {
  if (!source.effectiveFrom) {
    return MISSING_SUPERSEDED_FROM;
  }
  if (!revisionFrom) {
    return "Effective From is required for the new revision.";
  }
  if (!isIsoDate(revisionFrom)) {
    return "Enter a valid Effective From date for the revision.";
  }
  const error = getWageScaleDateError(revisionFrom, null, { revision: true });
  if (error) return error;
  try {
    if (revisionFrom < revisionMinimum(source)) {
      return "The revision must start after the superseded scale's start month.";
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid revision month.";
  }
  return null;
}

export function monthStart(month: string): string {
  const value = `${month}-01`;
  if (!isIsoDate(value)) throw new Error("Enter a valid month.");
  return value;
}

export function monthEnd(month: string): string {
  const date = new Date(monthStart(month) + "T00:00:00.000Z");
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  const value = date.toISOString().slice(0, 10);
  if (!isIsoDate(value)) throw new Error("Month is outside the supported calendar range.");
  return value;
}

function nextMonthStart(value: string): string {
  return shiftIsoDate(monthEnd(value.slice(0, 7)), 1);
}

export function revisionMinimum(source: SourceDates): string {
  if (!source.effectiveFrom) throw new Error(MISSING_SUPERSEDED_FROM);
  if (!isIsoDate(source.effectiveFrom)) {
    throw new Error("The superseded scale's Effective From date is invalid.");
  }
  // Revision chronology depends on its predecessor, not today's month.
  return nextMonthStart(source.effectiveFrom);
}

export function getWageScaleDateError(
  from: string | null | undefined,
  to: string | null | undefined,
  options: { revision?: boolean; activation?: boolean; now?: Date } = {},
): string | null {
  if (options.activation && !from) return "Effective From is required before activation.";
  if (from) {
    if (!isIsoDate(from) || !from.endsWith("-01")) {
      return "Effective From must be the first day of a valid month.";
    }
  }
  if (to) {
    if (!isIsoDate(to) || to !== monthEnd(to.slice(0, 7))) {
      return "Effective To must be the last day of a valid month.";
    }
    if (from && to < from) return "Effective To must be on or after Effective From.";
  }
  return null;
}

export interface PredecessorAdjustment {
  predecessorUuid: string;
  previousEffectiveTo: string | null;
  revisionEffectiveFrom: string;
  nextEffectiveTo: string;
}