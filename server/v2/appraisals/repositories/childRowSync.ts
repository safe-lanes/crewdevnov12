import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { sameValue } from "../../../../shared/v2/appraisals/appraisalChanges";
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
}

// A text column stored as-is, with "" saved as null.
export function textField(name: string): ChildFieldConfig {
  return { column: name, from: [name], normalize: (row) => row[name] || null };
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

// Writes an appraisal's child rows, matching them by row uuid.
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

  // This appraisal's rows, including soft-deleted ones.
  const existing: any[] = await executor
    .select()
    .from(table)
    .where(eq(table.appraisalUuid, appraisalUuid));
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
      throw new AppraisalRowOwnershipError(`Row ${foreign[0].uuid} does not belong to appraisal ${appraisalUuid}.`);
    }
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
          `Row ${row.uuid} of appraisal ${appraisalUuid}: ${f.column} is already set and can't be changed.`,
        );
      }
    }
  }

  const now = new Date();
  let nextSortOrder = existing.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), -1) + 1;
  const seen = new Set<string>();
  let written = 0;

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i] ?? {};
    const uuid = isUuid(row.uuid) ? row.uuid : uuidv4();
    if (seen.has(uuid)) continue;
    seen.add(uuid);

    const values = pickValues(cfg.fields, row);
    if (mode === "replace") values.sortOrder = i;
    const current = byUuid.get(uuid);

    if (!current) {
      await executor.insert(table).values({
        ...values,
        [cfg.uuidKey]: uuid,
        appraisalUuid,
        sortOrder: mode === "replace" ? i : nextSortOrder++,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      });
      written++;
      continue;
    }

    // Deleted elsewhere since the form was loaded: the deletion stands.
    if (current.isDeleted) {
      console.warn(`[Appraisals V2] Ignoring a write to deleted row ${uuid} of appraisal ${appraisalUuid}.`);
      continue;
    }

    const changed: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(values)) {
      if (!sameValue(current[column], value)) changed[column] = value;
    }
    if (Object.keys(changed).length === 0) continue;

    await executor
      .update(table)
      .set({ ...changed, updatedByUuid: auditUserUuid || current.updatedByUuid, updatedAt: now })
      .where(eq(table.id, current.id));
    written++;
  }

  const toDelete = mode === "patch"
    ? deleted.map((u) => byUuid.get(u)).filter((r) => r && !r.isDeleted)
    : existing.filter((r) => !r.isDeleted && !seen.has(r[cfg.uuidKey]));
  for (const r of toDelete) {
    await executor
      .update(table)
      .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || r.updatedByUuid })
      .where(eq(table.id, r.id));
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
