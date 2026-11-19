/** Sign-on needs an explicit, real calendar day; never silently substitute today. */
export function getSignOnDateError(
  value: unknown,
  today = new Date().toISOString().slice(0, 10),
): string | null {
  if (value === undefined || value === null || value === "") return "Sign On Date is required.";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) {
    return "Enter a valid Sign On Date.";
  }
  const day = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) {
    return "Enter a valid Sign On Date.";
  }
  return value > today ? "Sign On Date cannot be a future date when Sign On Status is Signed On." : null;
}
