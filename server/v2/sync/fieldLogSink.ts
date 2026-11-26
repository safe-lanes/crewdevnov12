// The change sink (SYN-01): turns a captured row change into sync_field_log rows.
// Same output as Technical's logFieldChanges and the database's
// sync_log_changes() trigger (op I/U, skip columns from sync_table_config), with
// these differences from Technical:
// - it writes on the executor it is given, so the log commits or rolls back
//   with the business write;
// - a failure always throws (Technical swallows it outside a transaction).
// A soft delete is an ordinary update of is_deleted.

import { sql } from "drizzle-orm";
import type { ChangeSink, RowChange } from "./changeCapture";
import { getTableSyncConfig, requiresFieldLogging } from "./syncConfig";
import { getEffectiveInstanceId } from "./syncRole";
import { columnNameOf } from "./columnNames";

const CHUNK_SIZE = 1000;

export function serializeFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface LogRow {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

// One entry per field to log: all non-null fields on insert, changed fields on update.
export function diffRow(
  table: string,
  oldRow: Record<string, unknown> | null,
  newRow: Record<string, unknown>,
  skipColumns: string[] = [],
): LogRow[] {
  const skip = new Set(skipColumns);
  const out: LogRow[] = [];
  const keys = new Set([...Object.keys(oldRow ?? {}), ...Object.keys(newRow)]);
  for (const key of keys) {
    const field = columnNameOf(table, key);
    if (skip.has(field)) continue;
    const oldValue = oldRow ? serializeFieldValue(oldRow[key]) : null;
    const newValue = serializeFieldValue(newRow[key]);
    if (oldRow === null ? newValue === null : oldValue === newValue) continue;
    out.push({ field, oldValue, newValue });
  }
  return out;
}

export const fieldLogSink: ChangeSink = async (executor, change: RowChange) => {
  const db = executor as { execute: (q: any) => Promise<any> };
  if (!(await requiresFieldLogging(db, change.table))) return;
  const cfg = (await getTableSyncConfig(db, change.table))!;
  if (!change.rowUuid) throw new Error(`fieldLogSink: ${change.table} change has no row uuid`);

  const entries = diffRow(change.table, change.oldRow, change.newRow, cfg.skipColumns);
  if (entries.length === 0) return;

  const instanceId = await getEffectiveInstanceId(db);
  // Only 'own' tables carry a trustworthy vessel column; crew / parent rows are
  // scoped by a join when the engine gathers them.
  const vesselKey = cfg.scopeMode === "own" ? cfg.vesselColumn : null;
  const vesselId = vesselKey
    ? serializeFieldValue(
        Object.entries(change.newRow).find(([k]) => columnNameOf(change.table, k) === vesselKey)?.[1],
      )
    : null;
  const op = change.oldRow === null ? "I" : "U";
  const changedBy = change.actorUuid || "system";

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const values = entries
      .slice(i, i + CHUNK_SIZE)
      .map(
        (e) =>
          sql`(${instanceId}, ${change.table}, ${change.rowUuid}, ${e.field}, ${op}, ${e.oldValue}, ${e.newValue}, ${vesselId}, ${changedBy})`,
      );
    await db.execute(sql`
      INSERT INTO sync_field_log
        (instance_id, table_name, row_uuid, field_name, op, old_value, new_value, vessel_id, changed_by_user_id)
      VALUES ${sql.join(values, sql`, `)}
    `);
  }
};
