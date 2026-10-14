/** SAIL calendar dates are displayed consistently, without browser-local shifts. */
export function sailDate(value: string | Date | null | undefined): string {
  if (!value) return "Unavailable";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getUTCDate()).padStart(2, "0")}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

export function sailUtcTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable (UTC)";
  return `${sailDate(date)} ${date.toISOString().slice(11, 19)} UTC`;
}