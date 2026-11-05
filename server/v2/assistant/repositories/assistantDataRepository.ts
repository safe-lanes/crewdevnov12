/**
 * Database access for the assistant's live-data tools (stage 2, PILOT TRIAL).
 *
 * Every tool call runs inside ONE transaction that is
 *   - READ ONLY (Postgres rejects any write, whatever the SQL),
 *   - REPEATABLE READ (counts, groups and rows of one answer come from the same snapshot),
 *   - bounded by SET LOCAL statement_timeout (default 5 s).
 * The tenant database is the one selected for this request by tenantConnectionManager (getDb()).
 */
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";

export type Query = (statement: SQL) => Promise<Record<string, unknown>[]>;

export class DataTimeoutError extends Error {
  constructor() {
    super("query timed out");
  }
}

function timeoutMs(): number {
  const n = parseInt(process.env.ASSISTANT_DATA_STATEMENT_TIMEOUT_MS || "5000", 10);
  return Number.isInteger(n) && n >= 100 && n <= 30000 ? n : 5000;
}

export async function runReadOnly<T>(work: (q: Query) => Promise<T>): Promise<T> {
  const db = getDb();
  try {
    return await db.transaction(
      async (tx: { execute: (s: SQL) => Promise<{ rows: Record<string, unknown>[] }> }) => {
        await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${timeoutMs()}`));
        return work(async (statement) => (await tx.execute(statement)).rows);
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "57014") throw new DataTimeoutError();
    const cause = (err as { cause?: { code?: string } })?.cause;
    if (cause?.code === "57014") throw new DataTimeoutError();
    throw err;
  }
}
