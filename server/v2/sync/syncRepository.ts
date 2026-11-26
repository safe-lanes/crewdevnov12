// All SQL for the sync engine (SYN-03). Every function takes an executor
// (the base db or a transaction) so the caller decides what commits together.
//
// Rules that hold for every function here:
// - There is no give-up path. A log that fails is retried on a growing delay
//   forever; it is never marked synced unless the other side accepted it.
// - Checkpoints only move forward.

import { sql, type SQL } from "drizzle-orm";

export type Queryable = { execute: (q: any) => Promise<any> };

const rowsOf = (res: any): any[] => res?.rows ?? res ?? [];

const IN_CHUNK = 1000;

// ---------------------------------------------------------------- settings

export interface SyncSettings {
  instanceId: string;
  shoreUrl: string;
  apiKey: string;
  autoSyncEnabled: boolean;
  intervalMinutes: number;
  chunkSize: number;
  requestTimeoutMs: number;
}

export async function getSetting(db: Queryable, key: string): Promise<string | null> {
  const rows = rowsOf(await db.execute(sql`SELECT value FROM sync_settings WHERE key = ${key}`));
  return rows.length ? String(rows[0].value) : null;
}

export async function setSetting(db: Queryable, key: string, value: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO sync_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `);
}

const toInt = (v: string | undefined, fallback: number, min = 0): number => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
};

// Defaults match migration 0280. An unreadable value falls back to the default
// instead of failing a cycle. Interval 0 means manual only. The request
// timeout floor is applied by the engine, not here.
export async function getSyncSettings(db: Queryable): Promise<SyncSettings> {
  const rows = rowsOf(await db.execute(sql`SELECT key, value FROM sync_settings`));
  const m = new Map<string, string>(rows.map((r) => [r.key, String(r.value)]));
  return {
    instanceId: (m.get("instance_id") ?? "").trim(),
    shoreUrl: (m.get("shore_url") ?? "").trim().replace(/\/+$/, ""),
    apiKey: (m.get("sync_api_key") ?? "").trim(),
    autoSyncEnabled: (m.get("auto_sync_enabled") ?? "false").toLowerCase() === "true",
    intervalMinutes: toInt(m.get("sync_interval_minutes"), 360),
    chunkSize: toInt(m.get("chunk_size"), 200, 1),
    requestTimeoutMs: toInt(m.get("sync_request_timeout_ms"), 60000),
  };
}

// -------------------------------------------------------------- field logs

export interface FieldLogRow {
  id: string;
  logUuid: string;
  instanceId: string;
  tableName: string;
  rowUuid: string;
  fieldName: string;
  op: "I" | "U" | "D";
  oldValue: string | null;
  newValue: string | null;
  vesselId: string | null;
  changedAt: string; // ISO, ms precision
  changedBy: string | null;
  syncAttempts: number;
}

// Seconds to wait before a log is offered again, by number of failed attempts:
// 1h, 6h, 24h, 3d, then 7d for every attempt after that, with no end.
export const RETRY_LADDER_SECONDS = [3600, 6 * 3600, 24 * 3600, 3 * 24 * 3600, 7 * 24 * 3600] as const;

export function retryDelaySeconds(attempts: number): number {
  if (attempts <= 0) return 0;
  return RETRY_LADDER_SECONDS[Math.min(attempts, RETRY_LADDER_SECONDS.length) - 1];
}

// The same ladder as SQL, built from the constant so the two cannot drift.
function retryEligibleSql(): SQL {
  const whens = RETRY_LADDER_SECONDS.slice(0, -1).map(
    (secs, i) => sql`WHEN ${i + 1} THEN ${secs}`,
  );
  const last = RETRY_LADDER_SECONDS[RETRY_LADDER_SECONDS.length - 1];
  return sql`(
    l.sync_attempts = 0
    OR l.last_attempt_at IS NULL
    OR l.last_attempt_at <= now() - make_interval(
         secs => (CASE l.sync_attempts ${sql.join(whens, sql` `)} ELSE ${last} END)::double precision)
  )`;
}

// Vessel filter for log reads. The ship (default) also sends logs that carry no
// vessel, because it holds only its own vessel's data. The office must NOT: a log
// with no vessel would go to every ship, so it passes includeUnscoped: false.
function vesselScope(vesselId: string | null | undefined, includeUnscoped = true): SQL {
  if (!vesselId) return sql``;
  return includeUnscoped
    ? sql`AND (l.vessel_id = ${vesselId} OR l.vessel_id IS NULL)`
    : sql`AND l.vessel_id = ${vesselId}`;
}

function mapLog(r: any): FieldLogRow {
  return {
    id: String(r.id),
    logUuid: r.log_uuid,
    instanceId: r.instance_id,
    tableName: r.table_name,
    rowUuid: r.row_uuid,
    fieldName: r.field_name,
    op: r.op,
    oldValue: r.old_value ?? null,
    newValue: r.new_value ?? null,
    vesselId: r.vessel_id ?? null,
    changedAt: r.changed_at instanceof Date ? r.changed_at.toISOString() : String(r.changed_at),
    changedBy: r.changed_by_user_id ?? null,
    syncAttempts: Number(r.sync_attempts ?? 0),
  };
}

// Pending logs this instance wrote, oldest first.
// - Own instance only: a log received from the other side is never sent back.
// - Vessel scope: a log of this vessel, or one with no vessel (tables scoped by
//   a join). A ship holds only its own vessel's data, so an unscoped log is its
//   own; dropping it would lose the change silently.
// - A log inside its retry delay is skipped.
// - All pending fields of a row travel together: after taking `limit` logs, the
//   other pending logs of the same rows are added, so a batch may hold a few
//   more than `limit`. Receivers then never see half a row.
export async function getUnsyncedFieldLogs(
  db: Queryable,
  opts: { instanceId: string; vesselId?: string | null; limit: number; includeUnscoped?: boolean },
): Promise<FieldLogRow[]> {
  const vesselClause = vesselScope(opts.vesselId, opts.includeUnscoped);
  const eligible = retryEligibleSql();
  const rows = rowsOf(
    await db.execute(sql`
      WITH first AS (
        SELECT l.id, l.table_name, l.row_uuid
        FROM sync_field_log l
        WHERE l.instance_id = ${opts.instanceId} AND l.is_synced = false
          ${vesselClause} AND ${eligible}
        ORDER BY l.id
        LIMIT ${opts.limit}
      )
      SELECT l.*
      FROM sync_field_log l
      WHERE l.instance_id = ${opts.instanceId} AND l.is_synced = false
        ${vesselClause} AND ${eligible}
        AND (l.table_name, l.row_uuid) IN (SELECT table_name, row_uuid FROM first)
      ORDER BY l.id
    `),
  );
  return rows.map(mapLog);
}

// Backlog size. By default only logs that can be sent now are counted, so the
// "Sync Now" drain stops when what is left is waiting out a retry delay.
export async function countUnsyncedFieldLogs(
  db: Queryable,
  opts: { instanceId: string; vesselId?: string | null; includeDelayed?: boolean; includeUnscoped?: boolean },
): Promise<number> {
  const vesselClause = vesselScope(opts.vesselId, opts.includeUnscoped);
  const eligible = opts.includeDelayed ? sql`` : sql`AND ${retryEligibleSql()}`;
  const rows = rowsOf(
    await db.execute(sql`
      SELECT count(*)::int AS n FROM sync_field_log l
      WHERE l.instance_id = ${opts.instanceId} AND l.is_synced = false ${vesselClause} ${eligible}
    `),
  );
  return Number(rows[0]?.n ?? 0);
}

async function inChunks(ids: Array<string | number>, run: (list: SQL) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const list = sql.join(ids.slice(i, i + IN_CHUNK).map((id) => sql`${id}`), sql`, `);
    await run(list);
  }
}

// Only for logs the other side accepted (or knowingly skipped as already applied).
export async function markSynced(db: Queryable, ids: Array<string | number>, batchId: string): Promise<void> {
  await inChunks(ids, (list) =>
    db.execute(sql`
      UPDATE sync_field_log
      SET is_synced = true, sync_batch_id = ${batchId}, last_attempt_at = now()
      WHERE id IN (${list})
    `),
  );
}

// A failed or unanswered log stays pending, with one more attempt on the ladder.
export async function markFailed(db: Queryable, ids: Array<string | number>, batchId: string): Promise<void> {
  await inChunks(ids, (list) =>
    db.execute(sql`
      UPDATE sync_field_log
      SET sync_attempts = sync_attempts + 1, last_attempt_at = now(), sync_batch_id = ${batchId}
      WHERE id IN (${list}) AND is_synced = false
    `),
  );
}

// Same two marks, by log_uuid: the other side acknowledges logs by uuid.
// `scope` limits the update to one instance's logs of one vessel: the office
// passes it so a ship can only acknowledge its own logs, never another ship's.
export interface UuidMarkScope {
  instanceId?: string;
  vesselId?: string;
}

const scopeClause = (scope?: UuidMarkScope): SQL => {
  const parts: SQL[] = [];
  if (scope?.instanceId) parts.push(sql` AND instance_id = ${scope.instanceId}`);
  if (scope?.vesselId) parts.push(sql` AND vessel_id = ${scope.vesselId}`);
  return sql.join(parts, sql``);
};

export async function markSyncedByUuid(
  db: Queryable, logUuids: string[], batchId: string, scope?: UuidMarkScope,
): Promise<void> {
  await inChunks(logUuids, (list) =>
    db.execute(sql`
      UPDATE sync_field_log
      SET is_synced = true, sync_batch_id = ${batchId}, last_attempt_at = now()
      WHERE log_uuid IN (${list})${scopeClause(scope)}
    `),
  );
}

export async function markFailedByUuid(
  db: Queryable, logUuids: string[], batchId: string, scope?: UuidMarkScope,
): Promise<void> {
  await inChunks(logUuids, (list) =>
    db.execute(sql`
      UPDATE sync_field_log
      SET sync_attempts = sync_attempts + 1, last_attempt_at = now(), sync_batch_id = ${batchId}
      WHERE log_uuid IN (${list}) AND is_synced = false${scopeClause(scope)}
    `),
  );
}

// ------------------------------------------------------------- checkpoints

export interface Checkpoint {
  lastSyncedAt: string | null;
  lastLogId: string | null;
  // updated_at::text of the last delivered row, exactly as Postgres wrote it.
  // Gather with this, never with lastSyncedAt (a Date loses microseconds).
  watermark: string | null;
}

export async function getCheckpoint(db: Queryable, instanceId: string, table: string): Promise<Checkpoint> {
  const rows = rowsOf(
    await db.execute(sql`
      SELECT last_synced_at, last_log_id, last_watermark FROM sync_table_checkpoints
      WHERE instance_id = ${instanceId} AND table_name = ${table}
    `),
  );
  const r = rows[0];
  return {
    lastSyncedAt: r?.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
    lastLogId: r?.last_log_id != null ? String(r.last_log_id) : null,
    watermark: r?.last_watermark != null ? String(r.last_watermark) : null,
  };
}

// Moves a checkpoint forward. GREATEST ignores NULL, so a first value is taken
// and an older value can never pull it back. Call only for a table whose whole
// cycle succeeded.
export async function advanceCheckpoint(
  db: Queryable,
  instanceId: string,
  table: string,
  to: { syncedAt?: string | null; logId?: string | number | null; watermark?: string | null },
): Promise<void> {
  const at = to.syncedAt ?? null;
  const logId = to.logId ?? null;
  const wm = to.watermark ?? null;
  if (at === null && logId === null && wm === null) return;
  // The watermark is text. It moves forward when the new one is later, compared as
  // timestamps with the zone ignored (the same way a timestamp column reads it).
  await db.execute(sql`
    INSERT INTO sync_table_checkpoints (instance_id, table_name, last_synced_at, last_log_id, last_watermark)
    VALUES (${instanceId}, ${table}, ${at}::timestamptz, ${logId}::bigint, ${wm}::text)
    ON CONFLICT (instance_id, table_name) DO UPDATE SET
      last_synced_at = GREATEST(sync_table_checkpoints.last_synced_at, EXCLUDED.last_synced_at),
      last_log_id    = GREATEST(sync_table_checkpoints.last_log_id, EXCLUDED.last_log_id),
      last_watermark = CASE
        WHEN EXCLUDED.last_watermark IS NULL THEN sync_table_checkpoints.last_watermark
        WHEN sync_table_checkpoints.last_watermark IS NULL THEN EXCLUDED.last_watermark
        WHEN EXCLUDED.last_watermark::timestamp > sync_table_checkpoints.last_watermark::timestamp
          THEN EXCLUDED.last_watermark
        ELSE sync_table_checkpoints.last_watermark END,
      updated_at     = now()
  `);
}

// ----------------------------------------------------------------- batches

export type BatchStatus = "started" | "completed" | "partial" | "failed";

export async function createBatch(
  db: Queryable,
  opts: { instanceId: string; vesselId?: string | null },
): Promise<string> {
  const rows = rowsOf(
    await db.execute(sql`
      INSERT INTO sync_batches (instance_id, vessel_id)
      VALUES (${opts.instanceId}, ${opts.vesselId ?? null})
      RETURNING batch_id
    `),
  );
  return String(rows[0].batch_id);
}

export async function finishBatch(
  db: Queryable,
  batchId: string,
  result: { status: Exclude<BatchStatus, "started">; pushed?: number; pulled?: number; skipped?: number; error?: string | null },
): Promise<void> {
  await db.execute(sql`
    UPDATE sync_batches
    SET status = ${result.status},
        records_pushed = ${result.pushed ?? 0},
        records_pulled = ${result.pulled ?? 0},
        records_skipped = ${result.skipped ?? 0},
        error_message = ${result.error ?? null},
        completed_at = now()
    WHERE batch_id = ${batchId}
  `);
}

// -------------------------------------------------------------- conflicts

export interface ConflictEntry {
  receiverInstanceId: string;
  senderInstanceId?: string | null;
  batchId?: string | null;
  tableName: string;
  rowUuid: string;
  fieldName?: string | null;
  localValue?: string | null;
  incomingValue?: string | null;
  localChangedAt?: string | null;
  incomingChangedAt?: string | null;
  resolution: "local_kept" | "incoming_applied" | "unique_key" | "merged";
}

export async function insertConflict(db: Queryable, c: ConflictEntry): Promise<void> {
  await db.execute(sql`
    INSERT INTO sync_conflict_log
      (receiver_instance_id, sender_instance_id, batch_id, table_name, row_uuid, field_name,
       local_value, incoming_value, local_changed_at, incoming_changed_at, resolution)
    VALUES
      (${c.receiverInstanceId}, ${c.senderInstanceId ?? null}, ${c.batchId ?? null}, ${c.tableName},
       ${c.rowUuid}, ${c.fieldName ?? null}, ${c.localValue ?? null}, ${c.incomingValue ?? null},
       ${c.localChangedAt ?? null}::timestamptz, ${c.incomingChangedAt ?? null}::timestamptz, ${c.resolution})
  `);
}

// ------------------------------------------------------------ ship registry
// The ships the office accepts (migration 0283). api_key_hash never leaves here.

export interface ShipRow {
  instanceId: string;
  vesselUuid: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

const mapShip = (r: any): ShipRow => ({
  instanceId: r.instance_id,
  vesselUuid: r.vessel_uuid,
  isActive: !!r.is_active,
  lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
  createdAt: new Date(r.created_at).toISOString(),
});

// The stored hash is read only to check a key; callers get it from here and
// nowhere else.
export async function findShipWithHash(
  db: Queryable,
  instanceId: string,
): Promise<(ShipRow & { apiKeyHash: string }) | null> {
  const rows = rowsOf(await db.execute(sql`SELECT * FROM sync_ships WHERE instance_id = ${instanceId}`));
  return rows.length ? { ...mapShip(rows[0]), apiKeyHash: String(rows[0].api_key_hash) } : null;
}

export async function listShips(db: Queryable): Promise<ShipRow[]> {
  return rowsOf(await db.execute(sql`SELECT * FROM sync_ships ORDER BY instance_id`)).map(mapShip);
}

// Throws a unique violation (23505) if the instance or the vessel is already registered.
export async function insertShip(
  db: Queryable,
  ship: { instanceId: string; vesselUuid: string; apiKeyHash: string },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO sync_ships (instance_id, vessel_uuid, api_key_hash)
    VALUES (${ship.instanceId}, ${ship.vesselUuid}, ${ship.apiKeyHash})
  `);
}

export async function setShipKeyHash(db: Queryable, instanceId: string, apiKeyHash: string): Promise<boolean> {
  const rows = rowsOf(await db.execute(sql`
    UPDATE sync_ships SET api_key_hash = ${apiKeyHash}, updated_at = now()
    WHERE instance_id = ${instanceId} RETURNING instance_id
  `));
  return rows.length > 0;
}

export async function setShipActive(db: Queryable, instanceId: string, active: boolean): Promise<boolean> {
  const rows = rowsOf(await db.execute(sql`
    UPDATE sync_ships SET is_active = ${active}, updated_at = now()
    WHERE instance_id = ${instanceId} RETURNING instance_id
  `));
  return rows.length > 0;
}

export async function touchShip(db: Queryable, instanceId: string): Promise<void> {
  await db.execute(sql`UPDATE sync_ships SET last_seen_at = now() WHERE instance_id = ${instanceId}`);
}
