import { addMonths, differenceInCalendarDays, isValid, parse } from "date-fns";

function parseOnboardDay(value?: string | null): Date | null {
    if (!value) return null;
    // Canonical form dates and legacy display dates, without UTC conversion.
    for (const pattern of ["yyyy-MM-dd", "dd-MMM-yyyy", "dd-MM-yyyy"]) {
        const day = parse(value.trim(), pattern, new Date(2000, 0, 1));
        if (isValid(day)) return day;
    }
    return null;
}

/** Display only: complete calendar months (clamped at month-end), then days. */
export function formatOnboardDuration(
    signOnDate?: string | null,
    signOffDate?: string | null,
): string {
    const start = parseOnboardDay(signOnDate);
    const end = parseOnboardDay(signOffDate);
    if (!start || !end || end < start) return "Onboard duration unavailable.";

    let months = (end.getFullYear() - start.getFullYear()) * 12
        + end.getMonth() - start.getMonth();
    if (addMonths(start, months) > end) months--;
    const days = differenceInCalendarDays(end, addMonths(start, months));
    return `Onboard: ${months} month${months === 1 ? "" : "s"}, ${days} day${days === 1 ? "" : "s"}.`;
}
