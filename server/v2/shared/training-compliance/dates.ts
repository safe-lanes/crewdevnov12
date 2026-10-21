/** Civil dates only: no server clock, time zone or time-of-day comparisons. */
export function civilDate(value: string | null): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const normalized = value.trim();
  const [year, month, day] = normalized.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day ? normalized : null;
}

export function contractEndDate(joining: string, months: number): string | null {
  if (!civilDate(joining) || !Number.isSafeInteger(months) || months < 0) return null;
  const [year, month, day] = joining.split("-").map(Number);
  const index = year * 12 + month - 1 + months;
  if (!Number.isSafeInteger(index)) return null;
  const targetYear = Math.floor(index / 12), targetMonth = index % 12;
  if (targetYear > 9999) return null;
  const last = new Date(0);
  last.setUTCFullYear(targetYear, targetMonth + 1, 0);
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, last.getUTCDate())).padStart(2, "0")}`;
}
