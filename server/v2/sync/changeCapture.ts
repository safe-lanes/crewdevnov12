// Change capture for ship–office sync (PRD-07).
//
// The sync engine Crewing copies from Technical records changes in the app
// code, not with database triggers. So every write to a synced table reports
// the row before and after the write here, on the same executor (transaction)
// as the write. A write that skips this is never sent to the other side.
//
// Nothing listens yet: the engine port sets the sink, which writes the field
// log the way Technical's logFieldChanges() does. Until then a capture is a
// no-op.
//
// Contract, the same as Technical's field logger:
// - `oldRow` null is an insert; both rows is an update. A soft delete is an
//   update of is_deleted. Nothing here hard-deletes.
// - Rows are whole Drizzle rows (camelCase keys) as read before the write and
//   returned by it, so the sink can compare them column by column.
// - The sink runs on the caller's executor. Inside a transaction a sink error
//   propagates and rolls the write back, so a change never commits without
//   its log.

export interface RowChange {
  // SQL table name, e.g. "promo_training_needs_v2".
  table: string;
  rowUuid: string;
  oldRow: Record<string, unknown> | null;
  newRow: Record<string, unknown>;
  // Who made the change; null when unknown.
  actorUuid: string | null;
}

export type ChangeSink = (executor: unknown, change: RowChange) => Promise<void> | void;

let sink: ChangeSink | null = null;

// Set by the sync engine at start-up (and by tests). null turns capture off.
export function setChangeSink(next: ChangeSink | null): void {
  sink = next;
}

const DRIZZLE_TABLE_NAME = Symbol.for("drizzle:Name");

// The SQL name of a Drizzle table, or the string itself.
export function tableNameOf(table: unknown): string {
  if (typeof table === "string") return table;
  const name = (table as Record<symbol, unknown> | null)?.[DRIZZLE_TABLE_NAME];
  if (typeof name !== "string") throw new Error("captureChange: not a Drizzle table");
  return name;
}

// Reports one written row. Call it right after the write, with the row as it
// was before (null for an insert) and the row the write returned. A write
// that changed no row (newRow missing) is not reported.
export async function captureChange(
  executor: unknown,
  change: {
    table: unknown;
    rowUuid: string;
    oldRow: Record<string, unknown> | null | undefined;
    newRow: Record<string, unknown> | null | undefined;
    actorUuid?: string | null;
  },
): Promise<void> {
  if (!sink || !change.newRow) return;
  await sink(executor, {
    table: tableNameOf(change.table),
    rowUuid: change.rowUuid,
    oldRow: change.oldRow ?? null,
    newRow: change.newRow,
    actorUuid: change.actorUuid || null,
  });
}
