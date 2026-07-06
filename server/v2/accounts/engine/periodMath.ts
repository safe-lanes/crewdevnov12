/**
 * Pure date + money helpers for the wage calculation engine.
 *
 * All money math is done in scaled integers (amounts in cents, rates ×10^4)
 * so results are exact and deterministic — no floating point. Dates are ISO
 * `YYYY-MM-DD` strings (lexicographic order == chronological order); periods
 * are `YYYY-MM`.
 */

export type RoundingRule = "nearest" | "up" | "down";
export type ProrationBasis = "thirty_day_month" | "calendar_days";

// ============================================================================
// Dates
// ============================================================================

export interface MonthInfo {
  period: string; // YYYY-MM
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  monthStart: string; // YYYY-MM-DD
  monthEnd: string; // YYYY-MM-DD
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthInfo(period: string): MonthInfo {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) throw new Error(`Invalid period (expected YYYY-MM): ${period}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid period month: ${period}`);
  }
  const dim = daysInMonth(year, month);
  return {
    period,
    year,
    month,
    daysInMonth: dim,
    monthStart: `${m[1]}-${m[2]}-01`,
    monthEnd: `${m[1]}-${m[2]}-${pad2(dim)}`,
  };
}

export function parseIsoDate(
  value: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function addDays(date: string, days: number): string {
  const p = parseIsoDate(date);
  if (!p) throw new Error(`Invalid date: ${date}`);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Add calendar months, clamping the day (e.g. 31 Jan + 1mo = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const p = parseIsoDate(date);
  if (!p) throw new Error(`Invalid date: ${date}`);
  const total = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(p.day, daysInMonth(year, month));
  return toIso(year, month, day);
}

export function dayOfMonth(date: string): number {
  const p = parseIsoDate(date);
  if (!p) throw new Error(`Invalid date: ${date}`);
  return p.day;
}

/** Inclusive calendar-day count between two ISO dates (from <= to). */
export function calendarDaysInclusive(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (!a || !b) throw new Error(`Invalid date range: ${from}..${to}`);
  const ms =
    Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86_400_000) + 1;
}

/** Thirty-day-month day index: the 31st maps to day 30. */
export function cappedIndex(date: string): number {
  return Math.min(dayOfMonth(date), 30);
}

// ============================================================================
// Day allocation across sub-periods
// ============================================================================

export interface DatedSegment {
  from: string; // YYYY-MM-DD, inside the month
  to: string; // YYYY-MM-DD, inside the month, >= from
}

/**
 * Allocate paid days to contiguous sub-periods of one service month.
 *
 * thirty_day_month rules (precedence strictly top-down):
 *  1. Crew aboard the whole month and a single segment -> 30 days
 *     (any calendar month length, incl. February).
 *  2. Month fully served but split into segments -> capped-day-index
 *     arithmetic for every segment except the last; the LAST segment takes
 *     30 - (days already allocated), so the month always sums to 30.
 *  3. Partial month, segment touching the month end -> min(inclusive
 *     calendar days, 30).
 *  4. Otherwise -> cappedIndex(to) - cappedIndex(from) + 1.
 *
 * calendar_days: actual inclusive calendar days; basis = days in month.
 *
 * Segments must be contiguous, ordered, and span serviceFrom..serviceTo.
 * Returned array parallels `segments`; zero-day segments (possible under
 * rule 2, e.g. a change effective on the 31st) must be skipped by the caller.
 */
export function allocateDays(
  segments: DatedSegment[],
  month: MonthInfo,
  serviceFrom: string,
  serviceTo: string,
  basis: ProrationBasis,
): { days: number[]; daysBasis: number } {
  if (segments.length === 0) return { days: [], daysBasis: 0 };

  if (basis === "calendar_days") {
    return {
      days: segments.map((s) => calendarDaysInclusive(s.from, s.to)),
      daysBasis: month.daysInMonth,
    };
  }

  const fullMonth =
    serviceFrom === month.monthStart && serviceTo === month.monthEnd;

  if (fullMonth && segments.length === 1) {
    return { days: [30], daysBasis: 30 };
  }

  if (fullMonth) {
    const days: number[] = [];
    let allocated = 0;
    for (let i = 0; i < segments.length; i++) {
      if (i === segments.length - 1) {
        days.push(Math.max(30 - allocated, 0));
      } else {
        const d = Math.max(
          cappedIndex(segments[i].to) - cappedIndex(segments[i].from) + 1,
          0,
        );
        days.push(d);
        allocated += d;
      }
    }
    return { days, daysBasis: 30 };
  }

  const days = segments.map((s) => {
    if (s.to === month.monthEnd) {
      return Math.min(calendarDaysInclusive(s.from, s.to), 30);
    }
    return Math.max(cappedIndex(s.to) - cappedIndex(s.from) + 1, 0);
  });
  return { days, daysBasis: 30 };
}

// ============================================================================
// Scaled-integer money math
// ============================================================================

/**
 * Parse a decimal string/number into an integer scaled by 10^scale.
 * Extra fractional digits are rounded half-up. Exact — no floats.
 */
export function parseScaled(
  value: string | number | null | undefined,
  scale: number,
): number {
  if (value == null) throw new Error("parseScaled: value is null/undefined");
  const s = String(value).trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`parseScaled: invalid decimal "${s}"`);
  const sign = m[1] === "-" ? -1 : 1;
  const intPart = m[2];
  const fracPart = m[3] ?? "";
  const fracKept = fracPart.slice(0, scale).padEnd(scale, "0");
  let scaled = Number(intPart) * 10 ** scale + Number(fracKept || "0");
  const nextDigit = fracPart.length > scale ? Number(fracPart[scale]) : 0;
  if (nextDigit >= 5) scaled += 1;
  return sign * scaled;
}

/** Format a scaled integer back into a fixed-point decimal string. */
export function formatScaled(scaledValue: number, scale: number): string {
  const sign = scaledValue < 0 ? "-" : "";
  const abs = Math.abs(scaledValue);
  const base = 10 ** scale;
  const intPart = Math.floor(abs / base);
  const frac = String(abs % base).padStart(scale, "0");
  return scale === 0 ? `${sign}${intPart}` : `${sign}${intPart}.${frac}`;
}

/** Amount cents helpers (scale 2). */
export const toCents = (v: string | number) => parseScaled(v, 2);
export const centsToString = (c: number) => formatScaled(c, 2);

/**
 * Round `numerator / denominator` (a rational number of cents) to a multiple
 * of `unitCents`, honoring the rounding rule. Non-negative inputs only.
 */
export function divRound(
  numerator: number,
  denominator: number,
  rule: RoundingRule,
  unitCents: number,
): number {
  if (denominator <= 0) throw new Error("divRound: denominator must be > 0");
  if (unitCents <= 0) throw new Error("divRound: unit must be > 0");
  if (numerator < 0) throw new Error("divRound: negative amounts unsupported");
  const d = denominator * unitCents;
  const q = Math.floor(numerator / d);
  const rem = numerator - q * d;
  let result = q;
  if (rule === "up") {
    if (rem > 0) result = q + 1;
  } else if (rule === "down") {
    // floor — nothing to do
  } else {
    // nearest, half-up
    if (2 * rem >= d) result = q + 1;
  }
  return result * unitCents;
}

/** Round a plain cents amount to the element's precision/rule. */
export function roundCents(
  cents: number,
  rule: RoundingRule,
  unitCents: number,
): number {
  return divRound(cents, 1, rule, unitCents);
}

/** monthly amount (cents) × daysServed / daysBasis, rounded per element. */
export function prorateCents(
  monthlyCents: number,
  daysServed: number,
  daysBasis: number,
  rule: RoundingRule,
  unitCents: number,
): number {
  if (daysBasis <= 0) throw new Error("prorateCents: daysBasis must be > 0");
  return divRound(monthlyCents * daysServed, daysBasis, rule, unitCents);
}

/** rate (×10^4) × qty (×10^2) -> cents, rounded per element. */
export function rateTimesQtyCents(
  rateE4: number,
  qtyE2: number,
  rule: RoundingRule,
  unitCents: number,
): number {
  // rateE4 * qtyE2 is value ×10^6; cents = value ×10^2 => divide by 10^4.
  return divRound(rateE4 * qtyE2, 10_000, rule, unitCents);
}

/** percentage (×10^2, e.g. 10.00% -> 1000) of a cents base, rounded. */
export function percentageOfCents(
  baseCents: number,
  percentE2: number,
  rule: RoundingRule,
  unitCents: number,
): number {
  // baseCents * percentE2 / (100 * 10^2)
  return divRound(baseCents * percentE2, 10_000, rule, unitCents);
}

/** Rounding precision (e.g. "0.01") -> unit in cents (>= 1). */
export function precisionToUnitCents(
  precision: string | number | null | undefined,
): number {
  if (precision == null) return 1;
  const unit = parseScaled(precision, 2);
  return unit >= 1 ? unit : 1;
}
