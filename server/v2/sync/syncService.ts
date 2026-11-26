// The office side of the sync protocol (SYN-08). The ship starts every exchange:
//
//   initiate  -> a batch is opened for this ship
//   push      -> the ship's rows (SHIP_ONLY) and field logs (BOTH_EDITABLE) are applied
//   pull      -> the office's rows (ONE_WAY) and field logs for this ship's vessel
//   complete  -> checkpoints and log acknowledgements move forward, only for what
//                the ship says it applied
//
// Every call is bound to the ship that authenticated (ShipIdentity). A request
// body never chooses the vessel: rows and logs outside the ship's vessel are
// rejected, and the ship can write only SHIP_ONLY and BOTH_EDITABLE tables, never
// an office-owned one (VS-04).

import { sql } from "drizzle-orm";
import { applyFieldLogs, applyWholeRows, enableTriggerBypass } from "./syncApplier";
import { RH_MONTH_COLUMN } from "./fieldOwnership";
import { getTableSyncConfig, tablesByCategory, type TableSyncConfig } from "./syncConfig";
import { checkClock, type ClockReport } from "./syncClock";
import { generateApiKey, hashApiKey } from "./syncAuth";
import {
  advanceCheckpoint,
  countUnsyncedFieldLogs,
  createBatch,
  finishBatch,
  getCheckpoint,
  getSyncSettings,
  getUnsyncedFieldLogs,
  insertShip,
  listShips,
  markFailedByUuid,
  markSyncedByUuid,
  setShipActive,
  setShipKeyHash,
  type FieldLogRow,
  type Queryable,
  type ShipRow,
} from "./syncRepository";
import type {
  ApplyContext,
  RowAlias,
  ShipIdentity,
  TableApplyCounts,
  WireFieldLog,
  WireRow,
  WireRows,
} from "./syncTypes";

export type Db = Queryable & { transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T> };

export class SyncRequestError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "SyncRequestError";
  }
}

export interface ChangedMonth {
  table: string;
  vesselId: string;
  month: string;
}
export interface PostApplyResult {
  recomputed: number;
  recomputeFailed: Array<{ vesselId: string; month: string; error: string }>;
  reopened: number;
}
// Runs after the push transaction has committed (Rest Hours recompute and the D3 reopen).
export type PostApply = (months: ChangedMonth[]) => Promise<PostApplyResult>;

const MAX_ITEMS_PER_CALL = 20000;
const MAX_ERRORS_RETURNED = 50;

// ------------------------------------------------------------------ initiate

export async function initiate(db: Db, ship: ShipIdentity, shoreInstanceId: string) {
  const batchId = await createBatch(db, { instanceId: ship.instanceId, vesselId: ship.vesselUuid });
  return { batchId, shoreInstanceId, serverTime: new Date().toISOString() };
}

// A batch must belong to the ship that uses it.
async function assertOwnBatch(tx: Queryable, ship: ShipIdentity, batchId: string): Promise<void> {
  const res = await tx.execute(
    sql`SELECT 1 FROM sync_batches WHERE batch_id = ${batchId} AND instance_id = ${ship.instanceId}`,
  );
  if (((res as any)?.rows ?? res).length === 0) throw new SyncRequestError(404, "Unknown batch.");
}

// ---------------------------------------------------------------------- push

export interface PushBody {
  batchId: string;
  rows: WireRows;
  fieldLogs: WireFieldLog[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function parsePushBody(body: unknown): PushBody {
  if (!isObj(body)) throw new SyncRequestError(400, "Body must be an object.");
  const batchId = body.batchId;
  if (typeof batchId !== "string" || !batchId) throw new SyncRequestError(400, "batchId is required.");

  const rows: WireRows = {};
  if (body.rows !== undefined) {
    if (!isObj(body.rows)) throw new SyncRequestError(400, "rows must be an object of arrays.");
    for (const [table, list] of Object.entries(body.rows)) {
      if (!Array.isArray(list) || !list.every(isObj)) throw new SyncRequestError(400, `rows.${table} must be an array of objects.`);
      rows[table] = list as WireRow[];
    }
  }

  const fieldLogs: WireFieldLog[] = [];
  if (body.fieldLogs !== undefined) {
    if (!Array.isArray(body.fieldLogs)) throw new SyncRequestError(400, "fieldLogs must be an array.");
    for (const l of body.fieldLogs) {
      const ok =
        isObj(l) &&
        ["logUuid", "instanceId", "tableName", "rowUuid", "fieldName", "changedAt"].every(
          (k) => typeof l[k] === "string" && (l[k] as string).length > 0,
        ) &&
        ["I", "U", "D"].includes(l.op as string) &&
        !Number.isNaN(Date.parse(l.changedAt as string)) &&
        (l.newValue === null || typeof l.newValue === "string") &&
        (l.oldValue === null || l.oldValue === undefined || typeof l.oldValue === "string");
      if (!ok) throw new SyncRequestError(400, "A field log is malformed.");
      fieldLogs.push({
        logUuid: l.logUuid as string, instanceId: l.instanceId as string, tableName: l.tableName as string,
        rowUuid: l.rowUuid as string, fieldName: l.fieldName as string, op: l.op as "I" | "U" | "D",
        oldValue: (l.oldValue as string | null | undefined) ?? null, newValue: l.newValue as string | null,
        vesselId: (l.vesselId as string | null | undefined) ?? null, changedAt: l.changedAt as string,
        changedBy: (l.changedBy as string | null | undefined) ?? null,
      });
    }
  }

  const total = Object.values(rows).reduce((n, r) => n + r.length, 0) + fieldLogs.length;
  if (total > MAX_ITEMS_PER_CALL) throw new SyncRequestError(400, `Too many items in one push (limit ${MAX_ITEMS_PER_CALL}).`);
  return { batchId, rows, fieldLogs };
}

// Only own-scoped tables are accepted from a ship: the row names its vessel, and it
// must be this ship's. Join-scoped tables are not accepted in a push.
function rowInScope(cfg: TableSyncConfig, row: WireRow, ship: ShipIdentity): boolean {
  return cfg.scopeMode === "own" && !!cfg.vesselColumn && row[cfg.vesselColumn] === ship.vesselUuid;
}

// Vessel and month of each changed Rest Hours row, read after it was applied.
async function collectMonths(
  tx: Queryable,
  changed: Array<{ table: string; rowUuid: string }>,
): Promise<ChangedMonth[]> {
  const byTable = new Map<string, string[]>();
  for (const c of changed) {
    if (RH_MONTH_COLUMN[c.table]) (byTable.get(c.table) ?? byTable.set(c.table, []).get(c.table)!).push(c.rowUuid);
  }
  const out: ChangedMonth[] = [];
  for (const [table, uuids] of byTable) {
    const cfg = await getTableSyncConfig(tx, table);
    if (!cfg?.vesselColumn) continue;
    const list = sql.join(uuids.map((u) => sql`${u}`), sql`, `);
    const res = await tx.execute(sql`
      SELECT ${sql.identifier(cfg.vesselColumn)} AS vessel_id, ${sql.identifier(RH_MONTH_COLUMN[table])} AS month
      FROM ${sql.identifier(table)} WHERE ${sql.identifier(cfg.identityColumn)} IN (${list})
    `);
    for (const r of ((res as any)?.rows ?? res) as any[]) {
      if (r.vessel_id && r.month) out.push({ table, vesselId: String(r.vessel_id), month: String(r.month) });
    }
  }
  return out;
}

export async function receivePush(
  db: Db,
  ship: ShipIdentity,
  shoreInstanceId: string,
  rawBody: unknown,
  postApply?: PostApply,
) {
  const body = parsePushBody(rawBody);
  const ctx: ApplyContext = {
    receiverInstanceId: shoreInstanceId,
    senderInstanceId: ship.instanceId,
    batchId: body.batchId,
    vesselScope: ship.vesselUuid,
  };

  const outcome = await db.transaction(async (tx) => {
    await assertOwnBatch(tx, ship, body.batchId);
    await enableTriggerBypass(tx); // keep the ship's updated_at

    const tables: Record<string, TableApplyCounts & { reason?: string }> = {};
    const rowErrors: Array<{ table: string; rowUuid: string; error: string }> = [];
    const changed: Array<{ table: string; rowUuid: string }> = [];
    const aliases: RowAlias[] = [];

    for (const [table, rows] of Object.entries(body.rows)) {
      const cfg = await getTableSyncConfig(tx, table);
      // The ship writes its own data and the shared BOTH_EDITABLE rows. An
      // office-owned (ONE_WAY) table is never accepted from a ship.
      if (!cfg || (cfg.category !== "SHIP_ONLY" && cfg.category !== "BOTH_EDITABLE")) {
        tables[table] = { applied: 0, skipped: 0, rejected: rows.length, failed: 0, reason: "table_not_accepted" };
        continue;
      }
      const inScope = rows.filter((r) => rowInScope(cfg, r, ship));
      const res = await applyWholeRows(tx, table, inScope, ctx, { insertOnly: cfg.category === "BOTH_EDITABLE" });
      res.counts.rejected += rows.length - inScope.length;
      tables[table] = res.counts;
      changed.push(...res.changed);
      aliases.push(...res.aliases);
      for (const e of res.errors) rowErrors.push({ table, ...e });
    }

    // Field logs: this ship's, for this ship's vessel.
    const outOfScope: Array<{ logUuid: string; reason: string }> = [];
    const logs = body.fieldLogs.filter((l) => {
      const ok = l.instanceId === ship.instanceId && l.vesselId === ship.vesselUuid;
      if (!ok) outOfScope.push({ logUuid: l.logUuid, reason: "out_of_scope" });
      return ok;
    });
    const fieldRes = await applyFieldLogs(tx, logs, ctx);
    changed.push(...fieldRes.changed);
    aliases.push(...fieldRes.aliases);

    return {
      tables,
      rowErrors,
      aliases,
      fieldRes,
      outOfScope,
      months: await collectMonths(tx, changed),
    };
  });

  // After commit: derived totals and the D3 reopen. A failure here never undoes the
  // data that was applied; it is reported.
  let post: PostApplyResult = { recomputed: 0, recomputeFailed: [], reopened: 0 };
  if (postApply && outcome.months.length > 0) {
    try {
      post = await postApply(outcome.months);
    } catch (err: any) {
      console.error("[Sync] post-apply failed:", err?.message ?? err);
      post.recomputeFailed.push({ vesselId: ship.vesselUuid, month: "*", error: String(err?.message ?? err) });
    }
  }

  const f = outcome.fieldRes;
  return {
    batchId: body.batchId,
    tables: outcome.tables,
    rowErrors: outcome.rowErrors.slice(0, MAX_ERRORS_RETURNED),
    // Logs the ship may mark synced (applied, already applied, or rejected for good).
    acceptedLogUuids: [...f.acceptedLogUuids, ...outcome.outOfScope.map((o) => o.logUuid)],
    rejectedLogs: [...f.rejected, ...outcome.outOfScope],
    failedLogs: f.failed,
    // Rows the office needs sent whole before it can apply their logs (self-heal).
    missingRows: f.missingRows,
    // Rows the office merged into one of its own: the ship's uuid and the office's.
    // The ship records office-uuid -> ship-uuid so the office's logs find its row.
    rowAliases: outcome.aliases.map((a) => ({ table: a.table, senderUuid: a.aliasUuid, receiverUuid: a.canonicalUuid })),
    conflicts: f.conflicts,
    postApply: post,
  };
}

// ---------------------------------------------------------------------- pull

const FILTER_FORBIDDEN = /;|--|\/\*/;

interface GatheredRows {
  rows: WireRow[];
  watermark: string | null;
}

// One ONE_WAY table's rows for one vessel, after the checkpoint, oldest first.
async function gatherOneWayRows(
  tx: Queryable,
  cfg: TableSyncConfig,
  vesselUuid: string,
  watermark: string | null,
  limit: number,
): Promise<GatheredRows> {
  const tbl = sql.identifier(cfg.tableName);

  let scope = sql`TRUE`;
  if (cfg.scopeMode === "own" && cfg.vesselColumn) {
    scope = sql`t.${sql.identifier(cfg.vesselColumn)} = ${vesselUuid}`;
  } else if (cfg.scopeMode === "parent" && cfg.parent) {
    const parentCfg = await getTableSyncConfig(tx, cfg.parent.table);
    if (!parentCfg?.vesselColumn || parentCfg.scopeMode !== "own") {
      throw new Error(`Sync: parent '${cfg.parent.table}' of '${cfg.tableName}' has no vessel column.`);
    }
    scope = sql`EXISTS (
      SELECT 1 FROM ${sql.identifier(cfg.parent.table)} p
      WHERE p.${sql.identifier(cfg.parent.identityColumn)} = t.${sql.identifier(cfg.parent.fkColumn)}
        AND p.${sql.identifier(parentCfg.vesselColumn)} = ${vesselUuid})`;
  } else if (cfg.scopeMode !== "none") {
    throw new Error(`Sync: '${cfg.tableName}' has scope '${cfg.scopeMode}', which cannot be sent to a ship.`);
  }

  // row_filter is written by migrations only. Refuse anything that is not one predicate.
  if (cfg.rowFilter && FILTER_FORBIDDEN.test(cfg.rowFilter)) {
    throw new Error(`Sync: row_filter of '${cfg.tableName}' is not a single predicate.`);
  }
  const filter = cfg.rowFilter ? sql`AND (${sql.raw(cfg.rowFilter)})` : sql``;
  const after = watermark ? sql`AND t.updated_at > ${watermark}` : sql``;
  const idCol = sql.identifier(cfg.identityColumn);

  const first = await tx.execute(sql`
    SELECT to_jsonb(t) AS j, t.updated_at::text AS wm, t.${idCol} AS identity
    FROM ${tbl} t WHERE ${scope} ${filter} ${after}
    ORDER BY t.updated_at ASC, t.${idCol} ASC LIMIT ${limit}
  `);
  const got = ((first as any)?.rows ?? first) as any[];
  if (got.length === 0) return { rows: [], watermark: null };

  // A cut-off in the middle of rows that share one updated_at would leave the rest
  // of them behind the new checkpoint for ever. Take every row of that instant.
  const lastWm = String(got[got.length - 1].wm);
  if (got.length === limit) {
    const have = got.map((g) => String(g.identity));
    const tail = await tx.execute(sql`
      SELECT to_jsonb(t) AS j, t.updated_at::text AS wm, t.${idCol} AS identity
      FROM ${tbl} t WHERE ${scope} ${filter} AND t.updated_at = ${lastWm}
        AND t.${idCol} NOT IN (${sql.join(have.map((h) => sql`${h}`), sql`, `)})
      ORDER BY t.${idCol} ASC
    `);
    got.push(...(((tail as any)?.rows ?? tail) as any[]));
  }
  const parse = (j: unknown): WireRow => (typeof j === "string" ? JSON.parse(j) : (j as WireRow));
  return { rows: got.map((g) => parse(g.j)), watermark: lastWm };
}

const toWireLog = (l: FieldLogRow): WireFieldLog => ({
  logUuid: l.logUuid, instanceId: l.instanceId, tableName: l.tableName, rowUuid: l.rowUuid,
  fieldName: l.fieldName, op: l.op, oldValue: l.oldValue, newValue: l.newValue,
  vesselId: l.vesselId, changedAt: l.changedAt, changedBy: l.changedBy,
});

export async function preparePull(
  db: Db,
  ship: ShipIdentity,
  shoreInstanceId: string,
  body: { batchId?: string; limit?: number } = {},
) {
  if (body.batchId) await assertOwnBatch(db, ship, body.batchId);
  const settings = await getSyncSettings(db);
  const limit = Math.min(Math.max(Math.trunc(Number(body.limit) || settings.chunkSize), 1), 1000);

  const rows: WireRows = {};
  const watermarks: Record<string, string> = {};
  let hasMore = false;

  for (const cfg of await tablesByCategory(db, "ONE_WAY_SHORE_TO_SHIP")) {
    const cp = await getCheckpoint(db, ship.instanceId, cfg.tableName);
    const got = await gatherOneWayRows(db, cfg, ship.vesselUuid, cp.watermark, limit);
    if (got.rows.length === 0) continue;
    rows[cfg.tableName] = got.rows;
    if (got.watermark) watermarks[cfg.tableName] = got.watermark;
    if (got.rows.length >= limit) hasMore = true;
  }

  // The office's own edits to shared rows, for this vessel only. A log with no
  // vessel is NOT sent: it would go to every ship.
  const logs = await getUnsyncedFieldLogs(db, {
    instanceId: shoreInstanceId, vesselId: ship.vesselUuid, limit, includeUnscoped: false,
  });
  if (logs.length >= limit) hasMore = true;

  return { batchId: body.batchId ?? null, rows, watermarks, fieldLogs: logs.map(toWireLog), hasMore };
}

// ------------------------------------------------------------------ complete

export interface CompleteBody {
  batchId: string;
  // table -> the watermark of the last row the ship APPLIED from that table.
  tableWatermarks?: Record<string, string>;
  appliedLogUuids?: string[];
  failedLogUuids?: string[];
  pushed?: number;
  pulled?: number;
  skipped?: number;
  error?: string | null;
}

const strList = (v: unknown, name: string): string[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw new SyncRequestError(400, `${name} must be a list of strings.`);
  return v as string[];
};

export async function complete(db: Db, ship: ShipIdentity, shoreInstanceId: string, raw: unknown) {
  if (!isObj(raw) || typeof raw.batchId !== "string" || !raw.batchId) throw new SyncRequestError(400, "batchId is required.");
  const body = raw as unknown as CompleteBody;
  const applied = strList(body.appliedLogUuids, "appliedLogUuids");
  const failed = strList(body.failedLogUuids, "failedLogUuids");
  const marks = body.tableWatermarks ?? {};
  if (!isObj(marks) || !Object.values(marks).every((v) => typeof v === "string")) {
    throw new SyncRequestError(400, "tableWatermarks must map table to text.");
  }
  const count = (n: unknown) => (Number.isFinite(Number(n)) ? Math.max(0, Math.trunc(Number(n))) : 0);

  return db.transaction(async (tx) => {
    await assertOwnBatch(tx, ship, body.batchId);

    // Checkpoints: only for ONE_WAY tables, only forward.
    const advanced: string[] = [];
    for (const [table, wm] of Object.entries(marks)) {
      const cfg = await getTableSyncConfig(tx, table);
      if (!cfg || cfg.category !== "ONE_WAY_SHORE_TO_SHIP") continue;
      await advanceCheckpoint(tx, ship.instanceId, table, { watermark: wm });
      advanced.push(table);
    }

    // Acknowledge only this office's logs of this ship's vessel.
    const scope = { instanceId: shoreInstanceId, vesselId: ship.vesselUuid };
    await markSyncedByUuid(tx, applied, body.batchId, scope);
    await markFailedByUuid(tx, failed, body.batchId, scope);

    const status = body.error ? "failed" : failed.length > 0 ? "partial" : "completed";
    await finishBatch(tx, body.batchId, {
      status, pushed: count(body.pushed), pulled: count(body.pulled), skipped: count(body.skipped),
      error: body.error ?? null,
    });
    return { batchId: body.batchId, status, checkpointsAdvanced: advanced };
  });
}

// -------------------------------------------------------------- admin: status

export interface StatusResult {
  instanceId: string;
  role: "ship" | "shore";
  settings: { shoreUrl: string; autoSyncEnabled: boolean; intervalMinutes: number; chunkSize: number; requestTimeoutMs: number; apiKeyConfigured: boolean };
  clock: ClockReport | { ok: false; problems: string[] };
  pendingLogs: number;
  ships: ShipRow[];
  recentBatches: unknown[];
}

export async function getStatus(db: Db, instanceId: string, role: "ship" | "shore"): Promise<StatusResult> {
  const settings = await getSyncSettings(db);
  let clock: StatusResult["clock"];
  try {
    clock = await checkClock(db);
  } catch (err: any) {
    clock = { ok: false, problems: [`Clock check failed: ${err?.message ?? err}`] };
  }
  const batches = await db.execute(sql`
    SELECT batch_id, instance_id, vessel_id, status, records_pushed, records_pulled, records_skipped,
           error_message, started_at, completed_at
    FROM sync_batches ORDER BY started_at DESC LIMIT 10
  `);
  return {
    instanceId,
    role,
    // The API key is never returned, only whether one is set.
    settings: {
      shoreUrl: settings.shoreUrl, autoSyncEnabled: settings.autoSyncEnabled,
      intervalMinutes: settings.intervalMinutes, chunkSize: settings.chunkSize,
      requestTimeoutMs: settings.requestTimeoutMs, apiKeyConfigured: settings.apiKey.length > 0,
    },
    clock,
    pendingLogs: await countUnsyncedFieldLogs(db, { instanceId, includeDelayed: true }),
    ships: role === "shore" ? await listShips(db) : [],
    recentBatches: ((batches as any)?.rows ?? batches) as unknown[],
  };
}

// ----------------------------------------------------- admin: ship registry

const SHIP_ID = /^SHIP-[A-Z0-9_-]{1,40}$/;

// Registers a ship for one vessel. The clear API key is returned ONCE.
export async function registerShip(db: Db, input: { instanceId: unknown; vesselUuid: unknown }) {
  const instanceId = String(input.instanceId ?? "").trim().toUpperCase();
  const vesselUuid = String(input.vesselUuid ?? "").trim();
  if (!SHIP_ID.test(instanceId)) throw new SyncRequestError(400, "instanceId must look like SHIP-NAME (letters, digits, - and _).");
  if (!vesselUuid) throw new SyncRequestError(400, "vesselUuid is required.");
  const found = await db.execute(sql`SELECT 1 FROM master_vessels WHERE vessel_uuid = ${vesselUuid} LIMIT 1`);
  if ((((found as any)?.rows ?? found) as unknown[]).length === 0) throw new SyncRequestError(400, "That vessel does not exist.");
  const apiKey = generateApiKey();
  try {
    await insertShip(db, { instanceId, vesselUuid, apiKeyHash: hashApiKey(apiKey) });
  } catch (err: any) {
    if ((err?.cause?.code ?? err?.code) === "23505") {
      throw new SyncRequestError(409, "That ship or vessel is already registered.");
    }
    throw err;
  }
  return { instanceId, vesselUuid, apiKey };
}

export async function rotateShipKey(db: Db, instanceIdRaw: string) {
  const instanceId = instanceIdRaw.trim().toUpperCase();
  const apiKey = generateApiKey();
  if (!(await setShipKeyHash(db, instanceId, hashApiKey(apiKey)))) throw new SyncRequestError(404, "Unknown ship.");
  return { instanceId, apiKey };
}

export async function setShipActiveState(db: Db, instanceIdRaw: string, active: boolean) {
  const instanceId = instanceIdRaw.trim().toUpperCase();
  if (!(await setShipActive(db, instanceId, active))) throw new SyncRequestError(404, "Unknown ship.");
  return { instanceId, isActive: active };
}
