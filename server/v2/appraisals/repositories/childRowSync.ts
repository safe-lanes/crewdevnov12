import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { sameValue } from "../../../../shared/v2/appraisals/appraisalChanges";
import { captureChange } from "../../sync/changeCapture";
import {
  apprTrainingsV2,
  apprTargetsV2,
  apprCompetenceAssessmentsV2,
  apprBehaviouralAssessmentsV2,
  apprTrainingNeedsV2,
  apprRecommendationsV2,
  apprAppraiserCommentsV2,
  apprSeafarerCommentsV2,
  apprOfficeReviewsV2,
  apprTrainingFollowupsV2,
  apprReviewersV2,
} from "../../../../shared/v2/appraisals/schema";

// A transaction (tx) or the default connection.
type Executor = any;

// One stored column of a child row and how to read it from an incoming row.
export interface ChildFieldConfig {
  column: string;
  // Incoming keys that carry this column. The column is written only when one
  // of them is present on the row.
  from: readonly string[];
  // Returns the value to store. `undefined` means "leave the column as it is".
  normalize: (row: Record<string, any>) => unknown;
  // Once the column holds a value, a write may not change or clear it
  // (AppraisalRowFieldLockedError). An empty column can still be filled.
  setOnce?: boolean;
}

export interface ChildTableConfig {
  table: any;
  // Drizzle key of the row uuid column, e.g. "trainingUuid".
  uuidKey: string;
  fields: readonly ChildFieldConfig[];
  // Drizzle key of the parent uuid column. Default "appraisalUuid".
  parentKey?: string;
  // What the parent is called in error messages. Default "appraisal".
  parentLabel?: string;
  // When several configs share one table, the stored rows that belong to this
  // one. Rows outside it are neither matched, updated nor deleted.
  scope?: (row: Record<string, any>) => boolean;
  // Values written on insert and on revive, e.g. the flags `scope` checks.
  fixed?: Record<string, unknown>;
  // Keyed rows (one per key per parent, e.g. one per approver). A row that
  // carries these columns and whose uuid has no live row in scope updates the
  // live row with the same key, so a row stored under another uuid (an older
  // random one) is not added twice.
  matchKey?: readonly string[];
  // The uuid of a row sent without one. Default: a random uuid.
  uuidFor?: (row: Record<string, any>, parentUuid: string) => string;
  // A write that carries the `matchKey` columns (a re-add) to a deleted row
  // brings it back. Without it, or for a plain edit, the deletion stands.
  revive?: boolean;
}

// A text column stored as-is, with "" saved as null.
export function textField(name: string): ChildFieldConfig {
  return { column: name, from: [name], normalize: (row) => row[name] || null };
}

// A key column (see `matchKey`), stored trimmed, with "" saved as null. It is
// set once: a row never changes its key.
export function keyField(name: string): ChildFieldConfig {
  return {
    column: name,
    from: [name],
    normalize: (row) => {
      const value = row[name] === undefined || row[name] === null ? "" : String(row[name]).trim();
      return value === "" ? null : value;
    },
    setOnce: true,
  };
}

// A row uuid sent for this appraisal belongs to another appraisal.
export class AppraisalRowOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppraisalRowOwnershipError";
  }
}

// A write tries to change or clear a setOnce column of an existing row.
export class AppraisalRowFieldLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppraisalRowFieldLockedError";
  }
}

const isUuid = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function isSent(f: ChildFieldConfig, row: Record<string, any>): boolean {
  return f.from.some((k) => Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined);
}

function pickValues(fields: readonly ChildFieldConfig[], row: Record<string, any>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    if (!isSent(f, row)) continue;
    const value = f.normalize(row);
    if (value !== undefined) values[f.column] = value;
  }
  return values;
}

// Writes the child rows of one parent (an appraisal, or a promotion review),
// matching them by row uuid.
//
// - "replace": `rows` is the whole section. Live rows missing from it are
//   soft-deleted (create and stage submits).
// - "patch": `rows` holds only new or changed rows and `deleted` the removed
//   uuids. Every other row is left alone (save draft).
//
// A row is updated only when a sent field differs from the stored value, and
// then only the changed columns are written. Unchanged rows get no UPDATE at
// all, so their updated_at and updated_by stay as they were.
//
// Every written row is reported to the sync change capture (PRD-07), on the
// same executor, with the row as it was and as the write returned it.
//
// Returns the number of rows inserted, updated or deleted.
export async function syncChildRows(
  executor: Executor,
  cfg: ChildTableConfig,
  appraisalUuid: string,
  input: { rows: Record<string, any>[]; deleted?: string[] },
  mode: "replace" | "patch",
  auditUserUuid?: string | null,
): Promise<number> {
  const table = cfg.table;
  const uuidColumn = table[cfg.uuidKey];
  const parentKey = cfg.parentKey ?? "appraisalUuid";
  const parentLabel = cfg.parentLabel ?? "appraisal";

  // This parent's rows, including soft-deleted ones. Rows of another config
  // on the same table count as "stored elsewhere" below.
  const stored: any[] = await executor
    .select()
    .from(table)
    .where(eq(table[parentKey], appraisalUuid));
  const existing = cfg.scope ? stored.filter(cfg.scope) : stored;
  const byUuid = new Map<string, any>(existing.map((r) => [r[cfg.uuidKey], r]));

  const deleted = (input.deleted ?? []).filter(isUuid);
  const unknown = [...input.rows.map((r) => r?.uuid).filter(isUuid), ...deleted]
    .filter((u) => !byUuid.has(u));
  if (unknown.length > 0) {
    const foreign = await executor
      .select({ uuid: uuidColumn })
      .from(table)
      .where(inArray(uuidColumn, unknown));
    if (foreign.length > 0) {
      throw new AppraisalRowOwnershipError(`Row ${foreign[0].uuid} does not belong to this list of ${parentLabel} ${appraisalUuid}.`);
    }
  }

  // Keyed rows: the live row for each key.
  const keyColumns = cfg.matchKey ?? [];
  const keyOf = (values: Record<string, unknown>): string | null => {
    if (keyColumns.length === 0) return null;
    const parts = keyColumns.map((c) => values[c]);
    if (parts.some((v) => v === null || v === undefined || v === "")) return null;
    return parts.map(String).join("\u0000");
  };
  const liveByKey = new Map<string, any>();
  for (const r of existing) {
    const key = keyOf(r);
    if (key !== null && !r.isDeleted && !liveByKey.has(key)) liveByKey.set(key, r);
  }

  // Checked before any write, so a refused request changes nothing.
  const setOnceFields = cfg.fields.filter((f) => f.setOnce);
  for (const row of input.rows) {
    const current = isUuid(row?.uuid) ? byUuid.get(row.uuid) : undefined;
    if (!current || current.isDeleted) continue;
    for (const f of setOnceFields) {
      if (!isSent(f, row) || sameValue(current[f.column], null)) continue;
      const value = f.normalize(row);
      if (value !== undefined && !sameValue(current[f.column], value)) {
        throw new AppraisalRowFieldLockedError(
          `Row ${row.uuid} of ${parentLabel} ${appraisalUuid}: ${f.column} is already set and can't be changed.`,
        );
      }
    }
  }

  const now = new Date();
  let nextSortOrder = stored.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), -1) + 1;
  const seen = new Set<string>();
  let written = 0;

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i] ?? {};
    const values = pickValues(cfg.fields, row);
    const key = keyOf(values);

    let uuid: string | undefined = isUuid(row.uuid) ? row.uuid : undefined;
    let current = uuid ? byUuid.get(uuid) : undefined;
    if (key !== null && (!current || current.isDeleted) && liveByKey.has(key)) {
      current = liveByKey.get(key);
      uuid = current[cfg.uuidKey];
    }
    if (!uuid) {
      uuid = cfg.uuidFor ? cfg.uuidFor(row, appraisalUuid) : uuidv4();
      current = byUuid.get(uuid);
    }
    if (seen.has(uuid)) continue;
    seen.add(uuid);

    if (mode === "replace") values.sortOrder = i;

    if (!current) {
      const inserted = {
        ...values,
        ...cfg.fixed,
        [cfg.uuidKey]: uuid,
        [parentKey]: appraisalUuid,
        sortOrder: mode === "replace" ? i : nextSortOrder++,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      };
      const [insertedRow] = await executor.insert(table).values(inserted).returning();
      await captureChange(executor, { table, rowUuid: uuid, oldRow: null, newRow: insertedRow, actorUuid: auditUserUuid });
      if (key !== null) liveByKey.set(key, { ...inserted, isDeleted: false });
      written++;
      continue;
    }

    if (current.isDeleted) {
      // Added again (a keyed row carrying its key): the same row comes back.
      if (cfg.revive && key !== null) {
        const [revived] = await executor
          .update(table)
          .set({ ...values, ...cfg.fixed, isDeleted: false, updatedByUuid: auditUserUuid || current.updatedByUuid, updatedAt: now })
          .where(eq(table.id, current.id))
          .returning();
        await captureChange(executor, { table, rowUuid: uuid, oldRow: current, newRow: revived, actorUuid: auditUserUuid });
        liveByKey.set(key, { ...current, ...values, isDeleted: false });
        written++;
        continue;
      }
      // Deleted elsewhere since the form was loaded: the deletion stands.
      console.warn(`[Child rows] Ignoring a write to deleted row ${uuid} of ${parentLabel} ${appraisalUuid}.`);
      continue;
    }

    const changed: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(values)) {
      if (!sameValue(current[column], value)) changed[column] = value;
    }
    if (Object.keys(changed).length === 0) continue;

    const [updated] = await executor
      .update(table)
      .set({ ...changed, updatedByUuid: auditUserUuid || current.updatedByUuid, updatedAt: now })
      .where(eq(table.id, current.id))
      .returning();
    await captureChange(executor, { table, rowUuid: uuid, oldRow: current, newRow: updated, actorUuid: auditUserUuid });
    written++;
  }

  const toDelete = mode === "patch"
    ? deleted.map((u) => byUuid.get(u)).filter((r) => r && !r.isDeleted)
    : existing.filter((r) => !r.isDeleted && !seen.has(r[cfg.uuidKey]));
  for (const r of toDelete) {
    const [deletedRow] = await executor
      .update(table)
      .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || r.updatedByUuid })
      .where(eq(table.id, r.id))
      .returning();
    await captureChange(executor, { table, rowUuid: r[cfg.uuidKey], oldRow: r, newRow: deletedRow, actorUuid: auditUserUuid });
    written++;
  }

  return written;
}

// Every table that holds an appraisal's child rows (APD-33). Deleting an
// appraisal deletes its live rows in all of them.
export const APPRAISAL_CHILD_TABLES = [
  apprTrainingsV2,
  apprTargetsV2,
  apprCompetenceAssessmentsV2,
  apprBehaviouralAssessmentsV2,
  apprTrainingNeedsV2,
  apprRecommendationsV2,
  apprAppraiserCommentsV2,
  apprSeafarerCommentsV2,
  apprOfficeReviewsV2,
  apprTrainingFollowupsV2,
  apprReviewersV2,
] as const;

// Soft-deletes the live child rows of an appraisal in every child table, so
// the sync never sends live rows of a deleted appraisal. Rows deleted earlier
// are not written, so they keep their own updated_at and updated_by.
//
// Returns the number of rows deleted.
export async function softDeleteAppraisalChildRows(
  executor: Executor,
  appraisalUuid: string,
  auditUserUuid?: string | null,
): Promise<number> {
  const now = new Date();
  let deleted = 0;
  // Sequential: one transaction runs on one connection.
  for (const table of APPRAISAL_CHILD_TABLES) {
    const rows: unknown[] = await executor
      .update(table)
      .set({ isDeleted: true, updatedAt: now, ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}) })
      .where(and(eq(table.appraisalUuid, appraisalUuid), eq(table.isDeleted, false)))
      .returning({ id: table.id });
    deleted += rows.length;
  }
  return deleted;
}
