// RH-03 follow-up: rh_daily_records_v2.daily_records is a text column holding a
// month of day entries as JSON. Two instances can hold the same content with
// different key order or spacing, which a text compare would report as a
// change. Store one canonical form: compact JSON, object keys sorted
// recursively. Array order is kept (the client addresses entries by index).

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

export class InvalidDailyBlobError extends Error {
  constructor() {
    super("Invalid daily records: must be a JSON array");
    this.name = "InvalidDailyBlobError";
  }
}

export function canonicalizeDailyRecords(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidDailyBlobError();
  }
  if (!Array.isArray(parsed)) throw new InvalidDailyBlobError();
  return JSON.stringify(sortKeys(parsed));
}

// Fields inside each day entry that are computed from the hour slots. They are
// recomputed, not data; an engine comparing blobs should ignore them.
export const RH_DAILY_BLOB_DERIVED_FIELDS = [
  "violations",
  "violationDiagnostics",
  "hoursOfRest24hr",
  "hoursOfWork24hr",
  "hoursOfRest48hr",
  "hoursOfWork48hr",
  "hoursOfRest7day",
  "hoursOfWork7day",
  "hoursOfRest96hr",
  "hoursOfWork96hr",
  "anyPeriodRest24hr",
  "anyPeriodRest7day",
  "anyPeriodWork24hr",
  "anyPeriodWork7day",
] as const;
