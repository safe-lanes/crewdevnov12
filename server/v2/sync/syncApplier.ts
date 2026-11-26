// Applies changes received from the other side (SYN-07). Used by the office when
// the ship pushes, and by the ship when it pulls.
//
// What it guarantees:
// - It writes with raw SQL and never calls captureChange, so a received change is
//   not logged again and cannot bounce back (no echo loop). The caller sets
//   sync.bypass_trigger for the transaction (see enableTriggerBypass) so the
//   updated_at trigger keeps the sender's value.
// - Each row is applied in its own savepoint: one bad row fails alone.
// - Every write is checked. An update that matches no row is not "done".
// - Redelivery changes nothing: an identical row or an already-inserted log is a skip.
//
// Whole rows (ONE_WAY_SHORE_TO_SHIP, SHIP_ONLY): upsert by the identity column.
// Field logs (BOTH_EDITABLE): per field, with three guards:
//   insert-origin: an 'I' log for a row that exists is skipped and acknowledged;
//   stale-skip:    the receiver's own newer change to the same field wins, unless
//                  the sender owns the field (decisions D1 and P0-1); a tie goes
//                  to the incoming change; every rejection is written to
//                  sync_conflict_log, and the rejection stands even if that write fails;
//   self-heal:     a log for a row the receiver does not have is not acknowledged;
//                  the row is reported so the sender sends it whole.

import { sql, type SQL } from "drizzle-orm";
import { getTableSyncConfig, type TableSyncConfig } from "./syncConfig";
import { fieldOwner, roleOfInstance } from "./fieldOwnership";
import { insertConflict } from "./syncRepository";
import type {
  ApplyContext,
  FieldLogApplyResult,
  RowAlias,
  RowsApplyResult,
  TableApplyCounts,
  WireFieldLog,
  WireRow,
} from "./syncTypes";

type Tx = {
  execute: (q: any) => Promise<any>;
  transaction?: <T>(fn: (t: any) => Promise<T>) => Promise<T>;
};

const rowsOf = (res: any): any[] => res?.rows ?? res ?? [];

// Fields a log may never write, whatever the config says.
const PROTECTED_FIELDS = new Set(["id", "is_sync"]);

// ------------------------------------------------------------------ helpers

// SET LOCAL sync.bypass_trigger = 'true' for the current transaction.
export async function enableTriggerBypass(tx: Tx): Promise<void> {
  await tx.execute(sql`SELECT set_config('sync.bypass_trigger', 'true', true)`);
}

const columnCache = new Map<string, Set<string>>();

export function resetApplierCaches(): void {
  columnCache.clear();
}

// The real column names of a table. Every column named in a received row or log
// is checked against this before it is used as an identifier.
export async function tableColumns(db: Tx, table: string): Promise<Set<string>> {
  const hit = columnCache.get(table);
  if (hit) return hit;
  const rows = rowsOf(
    await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `),
  );
  if (rows.length === 0) throw new Error(`Sync: table '${table}' does not exist here.`);
  const cols = new Set<string>(rows.map((r) => String(r.column_name)));
  columnCache.set(table, cols);
  return cols;
}

// A nested transaction is a savepoint: a failure rolls back that row only.
async function savepoint<T>(tx: Tx, fn: (t: Tx) => Promise<T>): Promise<T> {
  return tx.transaction ? tx.transaction(fn) : fn(tx);
}

function pgError(err: any): { code?: string; detail?: string } {
  const e = err?.cause ?? err;
  return { code: e?.code ?? err?.code, detail: e?.detail ?? err?.detail };
}

const errMessage = (err: any) => String(err?.cause?.message ?? err?.message ?? err);

const emptyCounts = (): TableApplyCounts => ({ applied: 0, skipped: 0, rejected: 0, failed: 0 });

// The side that owns a whole-row table: the ship for SHIP_ONLY, the office for ONE_WAY.
function senderOwnsTable(cfg: TableSyncConfig, senderInstanceId: string): boolean {
  const role = roleOfInstance(senderInstanceId);
  return (
    (cfg.category === "SHIP_ONLY" && role === "ship") ||
    (cfg.category === "ONE_WAY_SHORE_TO_SHIP" && role === "office")
  );
}

async function logConflict(tx: Tx, entry: Parameters<typeof insertConflict>[1]): Promise<void> {
  // The decision does not depend on this write: if it fails, the caller still
  // rejects (or applies) as decided. It must not poison the transaction either,
  // so it runs in its own savepoint.
  try {
    await savepoint(tx, (t) => insertConflict(t, entry));
  } catch (err) {
    console.error("[Sync] could not write sync_conflict_log:", errMessage(err));
  }
}

// ------------------------------------------------------------- whole rows

type UpsertOutcome = "applied" | "skipped";

async function upsertRow(
  tx: Tx,
  cfg: TableSyncConfig,
  row: WireRow,
  keys: string[],
  insertOnly: boolean,
): Promise<UpsertOutcome> {
  // An existing row never changes vessel. This also stops a sender from
  // overwriting another vessel's row by naming its uuid.
  const vesselGuard =
    cfg.scopeMode === "own" && cfg.vesselColumn && keys.includes(cfg.vesselColumn)
      ? sql`${sql.identifier(cfg.tableName)}.${sql.identifier(cfg.vesselColumn)} = EXCLUDED.${sql.identifier(cfg.vesselColumn)} AND `
      : sql``;
  const tbl = sql.identifier(cfg.tableName);
  const idCol = sql.identifier(cfg.identityColumn);
  const colList = sql.join(keys.map((k) => sql.identifier(k)), sql`, `);
  const payload: Record<string, unknown> = {};
  for (const k of keys) payload[k] = row[k];
  const json = JSON.stringify(payload);

  const updatable = keys.filter((k) => k !== cfg.identityColumn);
  let conflictClause: SQL;
  if (insertOnly || updatable.length === 0) {
    conflictClause = sql`ON CONFLICT (${idCol}) DO NOTHING`;
  } else {
    const sets = sql.join(
      updatable.map((k) => sql`${sql.identifier(k)} = EXCLUDED.${sql.identifier(k)}`),
      sql`, `,
    );
    // Apply only if the incoming row is not older than ours, and only if
    // something differs: an identical redelivery changes nothing.
    const notOlder = keys.includes("updated_at")
      ? sql`(${tbl}.updated_at IS NULL OR EXCLUDED.updated_at IS NULL OR ${tbl}.updated_at <= EXCLUDED.updated_at) AND `
      : sql``;
    const mine = sql.join(updatable.map((k) => sql`${tbl}.${sql.identifier(k)}`), sql`, `);
    const theirs = sql.join(updatable.map((k) => sql`EXCLUDED.${sql.identifier(k)}`), sql`, `);
    conflictClause = sql`ON CONFLICT (${idCol}) DO UPDATE SET ${sets}
      WHERE ${vesselGuard}${notOlder}ROW(${mine}) IS DISTINCT FROM ROW(${theirs})`;
  }

  // jsonb_populate_record reads every value with the column's own type, so
  // timestamps, numbers and booleans need no conversion on this side.
  const res = await tx.execute(sql`
    INSERT INTO ${tbl} (${colList})
    SELECT ${colList} FROM jsonb_populate_record(NULL::${tbl}, ${json}::jsonb)
    ${conflictClause}
    RETURNING ${idCol} AS identity
  `);
  return rowsOf(res).length > 0 ? "applied" : "skipped";
}

// Soft deletes the receiver's own row(s) that hold the same natural key as the
// incoming row (P0-8: the owner's row replaces it). Returns the replaced uuids.
async function replaceKeyHolder(
  tx: Tx,
  cfg: TableSyncConfig,
  row: WireRow,
  keyColumns: string[],
  cols: Set<string>,
): Promise<string[]> {
  if (!cols.has("is_deleted")) return [];
  const tbl = sql.identifier(cfg.tableName);
  const idCol = sql.identifier(cfg.identityColumn);
  const same = sql.join(
    keyColumns.map((c) => sql`${sql.identifier(c)} = ${row[c] as any}`),
    sql` AND `,
  );
  const res = await tx.execute(sql`
    UPDATE ${tbl} SET is_deleted = true, updated_at = now()
    WHERE ${same} AND is_deleted = false AND ${idCol} <> ${String(row[cfg.identityColumn])}
    RETURNING ${idCol} AS identity
  `);
  return rowsOf(res).map((r) => String(r.identity));
}

// ------------------------------------------------- aliases and the key merge

// Which of these uuids are aliases of a row kept here (sync_row_aliases).
async function loadAliases(tx: Tx, table: string, uuids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (uuids.length === 0) return out;
  const list = sql.join(uuids.map((u) => sql`${u}`), sql`, `);
  const res = await tx.execute(sql`
    SELECT alias_uuid, canonical_uuid FROM sync_row_aliases
    WHERE table_name = ${table} AND alias_uuid IN (${list})
  `);
  for (const r of rowsOf(res)) out.set(String(r.alias_uuid), String(r.canonical_uuid));
  return out;
}

// Two rows of a both-edit table hold the same natural key under different uuids.
// Replacing one would drop the other side's fields, so merge (decision of 26 Nov):
//  - the row kept here stays, with its uuid;
//  - for each field the SENDER owns, the sender's value is taken;
//  - every other field keeps the local value (local data, or derived counters);
//  - the sender's uuid is recorded as an alias, so its later logs find this row.
// Returns null when no local row holds the key (a real failure for the caller).
async function mergeIntoKeyHolder(
  tx: Tx,
  cfg: TableSyncConfig,
  cols: Set<string>,
  incoming: WireRow,
  keyColumns: string[],
  ctx: ApplyContext,
): Promise<{ holder: string; patched: string[] } | null> {
  const tbl = sql.identifier(cfg.tableName);
  const idCol = sql.identifier(cfg.identityColumn);
  const incomingUuid = String(incoming[cfg.identityColumn]);
  const same = sql.join(keyColumns.map((c) => sql`${sql.identifier(c)} = ${incoming[c] as any}`), sql` AND `);
  const live = cols.has("is_deleted") ? sql` AND is_deleted = false` : sql``;
  const found = await tx.execute(sql`
    SELECT to_jsonb(t) AS j FROM ${tbl} t
    WHERE ${same}${live} AND ${idCol} <> ${incomingUuid} FOR UPDATE
  `);
  const j = rowsOf(found)[0]?.j;
  if (!j) return null;
  const local: WireRow = typeof j === "string" ? JSON.parse(j) : j;
  const holder = String(local[cfg.identityColumn]);

  const senderRole = roleOfInstance(ctx.senderInstanceId);
  const skip = new Set(cfg.skipColumns);
  const patch: Array<[string, unknown]> = [];
  for (const [field, value] of Object.entries(incoming)) {
    if (!cols.has(field) || PROTECTED_FIELDS.has(field) || skip.has(field)) continue;
    if (field === cfg.identityColumn || keyColumns.includes(field) || field === "updated_at") continue;
    if (fieldOwner(cfg.tableName, field) !== senderRole) continue; // not the sender's field
    if (String(value ?? null) === String(local[field] ?? null)) continue;
    patch.push([field, value]);
  }
  if (patch.length > 0) {
    const sets = sql.join(patch.map(([f, v]) => sql`${sql.identifier(f)} = ${v as any}`), sql`, `);
    const upd = await tx.execute(sql`
      UPDATE ${tbl} SET ${sets}, updated_at = now() WHERE ${idCol} = ${holder} RETURNING ${idCol} AS identity
    `);
    if (rowsOf(upd).length === 0) return null;
  }
  await tx.execute(sql`
    INSERT INTO sync_row_aliases (table_name, alias_uuid, canonical_uuid)
    VALUES (${cfg.tableName}, ${incomingUuid}, ${holder}) ON CONFLICT (table_name, alias_uuid) DO NOTHING
  `);
  await logConflict(tx, {
    receiverInstanceId: ctx.receiverInstanceId, senderInstanceId: ctx.senderInstanceId, batchId: ctx.batchId,
    tableName: cfg.tableName, rowUuid: holder, fieldName: patch.map(([f]) => f).join(",") || null,
    localValue: holder, incomingValue: incomingUuid, resolution: "merged",
  });
  return { holder, patched: patch.map(([f]) => f) };
}

const keyColumnsOf = (err: unknown, cols: Set<string>): string[] | undefined => {
  const { code, detail } = pgError(err);
  const names = code === "23505" ? /^Key \((.+?)\)=\(/.exec(detail ?? "")?.[1]?.split(/,\s*/) : undefined;
  return names && names.every((c) => cols.has(c)) ? names : undefined;
};

// Applies whole rows of one table. `insertOnly` is for self-heal rows of a
// BOTH_EDITABLE table: they fill a gap and never overwrite what is there.
export async function applyWholeRows(
  tx: Tx,
  table: string,
  rows: WireRow[],
  ctx: ApplyContext,
  opts: { insertOnly?: boolean } = {},
): Promise<RowsApplyResult> {
  const cfg = await getTableSyncConfig(tx, table);
  if (!cfg) throw new Error(`Sync: '${table}' is not a synced table.`);
  const cols = await tableColumns(tx, table);
  const ownerIsSender = senderOwnsTable(cfg, ctx.senderInstanceId);
  const result: RowsApplyResult = { counts: emptyCounts(), aliases: [], changed: [], errors: [] };
  const bothEditable = cfg.category === "BOTH_EDITABLE";
  // Rows of a both-edit table that were merged earlier arrive under the sender's
  // uuid: they are already in the row we kept.
  const aliasOf = bothEditable
    ? await loadAliases(tx, table, rows.map((r) => r?.[cfg.identityColumn]).filter((u): u is string => typeof u === "string"))
    : new Map<string, string>();

  for (const row of rows) {
    const rowUuid = row?.[cfg.identityColumn];
    if (typeof rowUuid !== "string" || !rowUuid) {
      result.counts.rejected++;
      result.errors.push({ rowUuid: String(rowUuid ?? ""), error: `missing ${cfg.identityColumn}` });
      continue;
    }
    if (aliasOf.has(rowUuid)) {
      result.counts.skipped++;
      continue;
    }
    // Only columns this database has; never the serial id.
    const keys = Object.keys(row).filter((k) => cols.has(k) && k !== "id");
    try {
      let outcome: UpsertOutcome;
      try {
        outcome = await savepoint(tx, (t) => upsertRow(t, cfg, row, keys, !!opts.insertOnly));
      } catch (err) {
        // 23505 here is a natural-key index, not the identity (that conflict is
        // handled in the statement). The key columns come from the detail text.
        const keyCols = keyColumnsOf(err, cols);
        if (!keyCols) throw err;

        if (bothEditable) {
          // Both sides edit this table: merge by field owner, keep the local row.
          const merged = await savepoint(tx, (t) => mergeIntoKeyHolder(t, cfg, cols, row, keyCols, ctx));
          if (!merged) throw err;
          result.aliases.push({ table, aliasUuid: rowUuid, canonicalUuid: merged.holder });
          if (merged.patched.length > 0) {
            result.counts.applied++;
            result.changed.push({ table, rowUuid: merged.holder });
          } else {
            result.counts.skipped++;
          }
          continue;
        }
        if (!ownerIsSender) {
          // Not our call to replace the other side's row. Record it and move on.
          await logConflict(tx, {
            receiverInstanceId: ctx.receiverInstanceId, senderInstanceId: ctx.senderInstanceId,
            batchId: ctx.batchId, tableName: table, rowUuid, resolution: "unique_key",
            incomingValue: rowUuid,
          });
          result.counts.skipped++;
          continue;
        }
        const replaced = await savepoint(tx, async (t) => {
          const old = await replaceKeyHolder(t, cfg, row, keyCols, cols);
          if (old.length === 0) throw err; // nothing to replace: a real failure
          return old;
        });
        for (const oldUuid of replaced) {
          await logConflict(tx, {
            receiverInstanceId: ctx.receiverInstanceId, senderInstanceId: ctx.senderInstanceId,
            batchId: ctx.batchId, tableName: table, rowUuid: oldUuid, resolution: "unique_key",
            localValue: oldUuid, incomingValue: rowUuid,
          });
        }
        outcome = await savepoint(tx, (t) => upsertRow(t, cfg, row, keys, !!opts.insertOnly));
      }
      if (outcome === "applied") {
        result.counts.applied++;
        result.changed.push({ table, rowUuid });
      } else {
        result.counts.skipped++;
      }
    } catch (err) {
      result.counts.failed++;
      result.errors.push({ rowUuid, error: errMessage(err) });
    }
  }
  return result;
}

// -------------------------------------------------------------- field logs

const keyOf = (l: WireFieldLog) => `${l.tableName}\u0000${l.rowUuid}`;

async function readRowState(tx: Tx, cfg: TableSyncConfig, rowUuid: string): Promise<WireRow | null> {
  const tbl = sql.identifier(cfg.tableName);
  const res = await tx.execute(sql`
    SELECT to_jsonb(t) AS j FROM ${tbl} t WHERE ${sql.identifier(cfg.identityColumn)} = ${rowUuid} FOR UPDATE
  `);
  const j = rowsOf(res)[0]?.j;
  return j ? (typeof j === "string" ? JSON.parse(j) : j) : null;
}

// The receiver's own newest change to this field that is NEWER than the incoming
// one. Equal times are not newer: a tie goes to the incoming change.
async function newerOwnLog(tx: Tx, ctx: ApplyContext, log: WireFieldLog) {
  const res = await tx.execute(sql`
    SELECT changed_at, new_value FROM sync_field_log
    WHERE table_name = ${log.tableName} AND row_uuid = ${log.rowUuid} AND field_name = ${log.fieldName}
      AND instance_id = ${ctx.receiverInstanceId} AND changed_at > ${log.changedAt}::timestamptz
    ORDER BY changed_at DESC LIMIT 1
  `);
  const r = rowsOf(res)[0];
  return r
    ? { changedAt: new Date(r.changed_at).toISOString(), newValue: r.new_value as string | null }
    : null;
}

async function applyOneField(tx: Tx, cfg: TableSyncConfig, log: WireFieldLog): Promise<boolean> {
  const tbl = sql.identifier(cfg.tableName);
  const res = await tx.execute(sql`
    UPDATE ${tbl}
    SET ${sql.identifier(log.fieldName)} = ${log.newValue}, updated_at = ${log.changedAt}
    WHERE ${sql.identifier(cfg.identityColumn)} = ${log.rowUuid}
    RETURNING ${sql.identifier(cfg.identityColumn)} AS identity
  `);
  return rowsOf(res).length > 0; // false: the row is gone, not a silent success
}

export async function applyFieldLogs(
  tx: Tx,
  logs: WireFieldLog[],
  ctx: ApplyContext,
): Promise<FieldLogApplyResult> {
  const result: FieldLogApplyResult = {
    acceptedLogUuids: [], rejected: [], failed: [], missingRows: [], conflicts: 0, applied: 0, changed: [],
    aliases: [],
  };

  // A row that was merged earlier arrives under the sender's uuid: send its logs
  // to the row we kept. One lookup per table.
  const byTable = new Map<string, string[]>();
  for (const l of logs) (byTable.get(l.tableName) ?? byTable.set(l.tableName, []).get(l.tableName)!).push(l.rowUuid);
  const aliasMaps = new Map<string, Map<string, string>>();
  for (const [table, uuids] of byTable) {
    const cfgT = await getTableSyncConfig(tx, table);
    if (cfgT?.category === "BOTH_EDITABLE") aliasMaps.set(table, await loadAliases(tx, table, [...new Set(uuids)]));
  }
  logs = logs.map((l) => {
    const canonical = aliasMaps.get(l.tableName)?.get(l.rowUuid);
    return canonical ? { ...l, rowUuid: canonical } : l;
  });

  // One row's logs together, oldest first (stable for equal times).
  const groups = new Map<string, WireFieldLog[]>();
  logs.forEach((l, i) => {
    (groups.get(keyOf(l)) ?? groups.set(keyOf(l), []).get(keyOf(l))!).push({ ...l, _i: i } as any);
  });

  const senderRole = roleOfInstance(ctx.senderInstanceId);

  for (const group of groups.values()) {
    group.sort((a: any, b: any) => Date.parse(a.changedAt) - Date.parse(b.changedAt) || a._i - b._i);
    const { tableName } = group[0];
    let rowUuid = group[0].rowUuid; // becomes the kept row's uuid after a merge
    const aliasesOut: RowAlias[] = [];
    const accepted: string[] = [];
    const rejected: Array<{ logUuid: string; reason: string }> = [];
    const missing: boolean[] = [];
    let applied = 0;
    let conflicts = 0;

    try {
      await savepoint(tx, async (t) => {
        const cfg = await getTableSyncConfig(t, tableName);
        if (!cfg || cfg.category !== "BOTH_EDITABLE") {
          for (const l of group) rejected.push({ logUuid: l.logUuid, reason: "table_not_both_editable" });
          return;
        }
        const cols = await tableColumns(t, tableName);
        const skip = new Set(cfg.skipColumns);
        let state = await readRowState(t, cfg, rowUuid); // a read error throws: retried
        if (
          state && ctx.vesselScope && cfg.scopeMode === "own" && cfg.vesselColumn &&
          state[cfg.vesselColumn] !== ctx.vesselScope
        ) {
          for (const l of group) rejected.push({ logUuid: l.logUuid, reason: "out_of_scope" });
          return;
        }

        if (!state) {
          // Row missing here. Insert logs carry every non-null field of the row:
          // build it from them. Anything else cannot be applied: ask for the row.
          const inserts = group.filter((l) => l.op === "I");
          if (inserts.length > 0) {
            const built: WireRow = { [cfg.identityColumn]: rowUuid };
            for (const l of group) {
              if (cols.has(l.fieldName) && !PROTECTED_FIELDS.has(l.fieldName)) built[l.fieldName] = l.newValue;
            }
            // The row these logs describe must be in the sender's vessel. The vessel on
            // the log is only a label: the field inside it decides where the row lands.
            if (
              ctx.vesselScope && cfg.scopeMode === "own" && cfg.vesselColumn &&
              built[cfg.vesselColumn] !== ctx.vesselScope
            ) {
              for (const l of group) rejected.push({ logUuid: l.logUuid, reason: "out_of_scope" });
              return;
            }
            const keys = Object.keys(built);
            try {
              const out = await savepoint(t, (s) => upsertRow(s, cfg, built, keys, true));
              if (out === "applied") applied++;
              for (const l of group) accepted.push(l.logUuid);
              return;
            } catch (err) {
              const { code } = pgError(err);
              const keyCols = keyColumnsOf(err, cols);
              if (keyCols) {
                // Same vessel and month held by another uuid: merge into the kept row
                // (fields the sender owns come across), remember the alias, and let
                // the rest of this row's logs apply to the kept row.
                const merged = await savepoint(t, (s) => mergeIntoKeyHolder(s, cfg, cols, built, keyCols, ctx));
                if (!merged) throw err;
                aliasesOut.push({ table: tableName, aliasUuid: rowUuid, canonicalUuid: merged.holder });
                if (merged.patched.length > 0) applied++;
                conflicts++;
                for (const l of group) l.rowUuid = merged.holder;
                rowUuid = merged.holder;
                state = await readRowState(t, cfg, rowUuid);
                if (!state) throw err;
              } else {
                if (code !== "23502") throw err; // 23502: a required field is missing
                missing.push(true);
                return;
              }
            }
          } else {
            missing.push(true);
            return;
          }
        }

        for (const l of group) {
          if (l.op === "I") {
            // Insert-origin guard: the row exists, so this insert is already applied.
            accepted.push(l.logUuid);
            continue;
          }
          if (
            !cols.has(l.fieldName) || PROTECTED_FIELDS.has(l.fieldName) ||
            l.fieldName === cfg.identityColumn || skip.has(l.fieldName)
          ) {
            rejected.push({ logUuid: l.logUuid, reason: "field_not_syncable" });
            continue;
          }
          const newer = await newerOwnLog(t, ctx, l);
          if (newer) {
            conflicts++;
            const senderWins = fieldOwner(tableName, l.fieldName) === senderRole;
            await logConflict(t, {
              receiverInstanceId: ctx.receiverInstanceId, senderInstanceId: ctx.senderInstanceId,
              batchId: ctx.batchId, tableName, rowUuid, fieldName: l.fieldName,
              localValue: newer.newValue, incomingValue: l.newValue,
              localChangedAt: newer.changedAt, incomingChangedAt: l.changedAt,
              resolution: senderWins ? "incoming_applied" : "local_kept",
            });
            if (!senderWins) {
              rejected.push({ logUuid: l.logUuid, reason: "receiver_newer" });
              continue;
            }
          }
          if (!(await applyOneField(t, cfg, l))) {
            missing.push(true); // the row vanished under us
            return;
          }
          applied++;
          accepted.push(l.logUuid);
        }
      });
    } catch (err) {
      for (const l of group) result.failed.push({ logUuid: l.logUuid, error: errMessage(err) });
      continue;
    }

    if (missing.length > 0) {
      // Nothing from this row is acknowledged until it is sent whole.
      result.missingRows.push({ table: tableName, rowUuid });
      continue;
    }
    result.acceptedLogUuids.push(...accepted, ...rejected.map((r) => r.logUuid));
    result.aliases.push(...aliasesOut);
    result.rejected.push(...rejected);
    result.applied += applied;
    result.conflicts += conflicts;
    if (applied > 0) result.changed.push({ table: tableName, rowUuid });
  }
  return result;
}
