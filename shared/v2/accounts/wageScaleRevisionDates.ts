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
  const boundary = source.effectiveTo || source.effectiveFrom;
  if (revisionFrom <= boundary) {
    return source.effectiveTo
      ? "The revision's Effective From date must be after the superseded scale's Effective To date."
      : "The revision's Effective From date must be after the superseded scale's Effective From date.";
  }
  return null;
}