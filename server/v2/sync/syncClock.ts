// Clock check for sync (TZ-1). Decision of 26 Nov 2026: copy Technical's rule,
// every ship and office Postgres and Node process runs in UTC, and the columns
// stay `timestamp without time zone`.
//
// Why: the Rest Hours updated_at columns hold a wall-clock time with no zone.
// The DB trigger / default stamps the DB's wall clock, the app stamps UTC. When
// the two zones differ (the local dev DB is +5:30) the same instant is stored
// two ways, and watermarks and stale checks go wrong.
//
// now() is a timestamptz, so its epoch is the same in any zone and cannot show
// a zone problem. This check therefore compares three different things:
//   1. the DB session's wall-clock offset from UTC (must be 0 and a UTC zone),
//   2. the app process's offset from UTC (must be 0),
//   3. the real drift between the DB host's clock and the app host's clock.
// Anything wrong goes in `problems`; sync must not be enabled while `ok` is false.

import { sql } from "drizzle-orm";

type Queryable = { execute: (q: any) => Promise<any> };

export interface ClockSample {
  dbEpochMs: number;
  dbTimeZone: string;
  // Seconds the DB's wall clock is ahead of UTC (IST = 19800).
  dbOffsetSeconds: number;
}

export interface ClockReport {
  ok: boolean;
  dbTimeZone: string;
  dbOffsetSeconds: number;
  appOffsetSeconds: number;
  // DB clock minus app clock, in ms (positive: the DB is ahead).
  driftMs: number;
  problems: string[];
}

// Zone names that mean UTC. Others fail even when their offset is 0 today
// (Europe/London is 0 in winter and +1h in summer).
const UTC_ZONES = new Set(["UTC", "ETC/UTC", "ETC/UCT", "UCT", "ETC/ZULU", "ZULU", "ETC/GMT", "GMT", "ETC/GREENWICH"]);

export const DEFAULT_MAX_DRIFT_MS = 5000;

const fmtOffset = (secs: number) => {
  const sign = secs < 0 ? "-" : "+";
  const a = Math.abs(secs);
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  return `UTC${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Pure: turns a DB sample and the app's clock into a report.
export function evaluateClock(
  sample: ClockSample,
  app: { nowMs: number; offsetSeconds: number },
  maxDriftMs: number = DEFAULT_MAX_DRIFT_MS,
): ClockReport {
  const problems: string[] = [];
  const driftMs = sample.dbEpochMs - app.nowMs;

  if (sample.dbOffsetSeconds !== 0) {
    problems.push(
      `The database session runs at ${fmtOffset(sample.dbOffsetSeconds)} (TimeZone '${sample.dbTimeZone}'). ` +
        "Sync needs UTC: set the database's timezone to UTC.",
    );
  } else if (!UTC_ZONES.has(sample.dbTimeZone.trim().toUpperCase())) {
    problems.push(
      `The database TimeZone is '${sample.dbTimeZone}', which is at UTC now but is not a UTC zone and will move with daylight saving. Set it to UTC.`,
    );
  }
  if (app.offsetSeconds !== 0) {
    problems.push(
      `The Node process runs at ${fmtOffset(app.offsetSeconds)}. Start the server with TZ=UTC.`,
    );
  }
  if (Math.abs(driftMs) > maxDriftMs) {
    problems.push(
      `The database clock and the app clock differ by ${Math.round(driftMs / 1000)}s (limit ${Math.round(maxDriftMs / 1000)}s). ` +
        "Fix the host clock or time sync.",
    );
  }

  return {
    ok: problems.length === 0,
    dbTimeZone: sample.dbTimeZone,
    dbOffsetSeconds: sample.dbOffsetSeconds,
    appOffsetSeconds: app.offsetSeconds,
    driftMs,
    problems,
  };
}

// Reads the DB clock and compares it with this process. Takes the clock as an
// option so tests need no real time. Throws if the DB cannot be read: an
// unreadable clock is not a passing clock.
export async function checkClock(
  db: Queryable,
  opts: { now?: () => Date; maxDriftMs?: number } = {},
): Promise<ClockReport> {
  const res = await db.execute(sql`
    SELECT extract(epoch FROM now()) * 1000 AS db_epoch_ms,
           current_setting('TimeZone') AS db_tz,
           extract(epoch FROM (now()::timestamp - (now() AT TIME ZONE 'UTC')))::int AS db_offset_seconds
  `);
  const row = ((res as any)?.rows ?? res)?.[0];
  if (!row) throw new Error("Clock check: the database returned no clock row.");
  const appNow = (opts.now ?? (() => new Date()))();
  return evaluateClock(
    {
      dbEpochMs: Number(row.db_epoch_ms),
      dbTimeZone: String(row.db_tz),
      dbOffsetSeconds: Number(row.db_offset_seconds),
    },
    { nowMs: appNow.getTime(), offsetSeconds: -appNow.getTimezoneOffset() * 60 },
    opts.maxDriftMs,
  );
}

// One log line per problem, for boot.
export function describeClock(report: ClockReport): string {
  return report.ok
    ? `Clock OK: DB '${report.dbTimeZone}', app UTC, drift ${report.driftMs}ms.`
    : `Clock NOT OK: ${report.problems.join(" ")}`;
}
