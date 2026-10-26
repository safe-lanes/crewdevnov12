import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTrainingsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTrainingV2 } from "../../../../shared/v2/appraisals/types";
import type { AppraisalSectionChanges } from "../../../../shared/v2/appraisals/appraisalChanges";
import { syncChildRows, textField, type ChildTableConfig } from "./childRowSync";

// A transaction (tx) or the default connection.
type Executor = any;

const ROWS: ChildTableConfig = {
  table: apprTrainingsV2,
  uuidKey: "trainingUuid",
  fields: [
    textField("training"),
    textField("evaluation"),
    textField("comment"),
    // An empty source keeps the stored one; a new row then gets the column default ("manual").
    { column: "source", from: ["source"], normalize: (r) => r.source || undefined },
  ],
};

// An auto row's uuid comes from its course (APD-20), so when a course leaves the
// B1 window and later comes back, the form sends it under the uuid of the row
// deleted when it left. That row is brought back here; otherwise "the deletion
// stands" would drop it on every save. Returns the number of rows restored.
async function restoreReturningAutoRows(
  executor: Executor,
  appraisalUuid: string,
  rows: Record<string, any>[],
  auditUserUuid?: string | null,
): Promise<number> {
  const uuids = rows
    .filter((r) => r?.source === "auto" && typeof r.uuid === "string" && r.uuid.length > 0)
    .map((r) => r.uuid as string);
  if (uuids.length === 0) return 0;

  const restored: unknown[] = await executor
    .update(apprTrainingsV2)
    .set({ isDeleted: false, updatedAt: new Date(), ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}) })
    .where(and(
      eq(apprTrainingsV2.appraisalUuid, appraisalUuid),
      inArray(apprTrainingsV2.trainingUuid, uuids),
      eq(apprTrainingsV2.isDeleted, true),
      eq(apprTrainingsV2.source, "auto"),
    ))
    .returning({ id: apprTrainingsV2.id });
  return restored.length;
}

export class ApprTrainingsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprTrainingV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprTrainingsV2)
      .where(and(
        inArray(apprTrainingsV2.appraisalUuid, appraisalUuids),
        eq(apprTrainingsV2.isDeleted, false)
      ))
      .orderBy(apprTrainingsV2.sortOrder);
    const map = new Map<string, ApprTrainingV2[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  // The whole section (create, stage submits): rows matched by uuid, live rows
  // missing from `rows` are soft-deleted, unchanged rows are not written.
  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string, executor: Executor = getDb()): Promise<number> {
    const restored = await restoreReturningAutoRows(executor, appraisalUuid, rows, auditUserUuid);
    return restored + await syncChildRows(executor, ROWS, appraisalUuid, { rows }, "replace", auditUserUuid);
  }

  // A save-draft change set: only the given rows and deletions are written.
  async applyChanges(appraisalUuid: string, changes: AppraisalSectionChanges, auditUserUuid?: string, executor: Executor = getDb()): Promise<number> {
    const restored = await restoreReturningAutoRows(executor, appraisalUuid, changes.rows, auditUserUuid);
    return restored + await syncChildRows(executor, ROWS, appraisalUuid, changes, "patch", auditUserUuid);
  }
}
