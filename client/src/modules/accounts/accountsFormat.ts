/** Shared display formatters for the Accounts admin UI (DD-MMM-YYYY dates). */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format an ISO date (or Date) as DD-MMM-YYYY; empty string when absent. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** Format a numeric-string money value with thousands separators. */
export function formatMoney(
  value: string | number | null | undefined,
  currency?: string | null,
): string {
  if (value == null || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

/** Convert a 1-based scale year step to an inclusive experience-months window. */
export function yearStepToMonths(step: number): {
  min: number;
  max: number;
} {
  return { min: (step - 1) * 12, max: step * 12 - 1 };
}
