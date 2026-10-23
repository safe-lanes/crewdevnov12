import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTrainingNeedsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTrainingNeedV2 } from "../../../../shared/v2/appraisals/types";
import type { AppraisalSectionChanges } from "../../../../shared/v2/appraisals/appraisalChanges";
import { syncChildRows, textField, type ChildTableConfig } from "./childRowSync";

// A transaction (tx) or the default connection.
type Executor = any;

const ROWS: ChildTableConfig = {
  table: apprTrainingNeedsV2,
  uuidKey: "trainingNeedUuid",
  fields: [
    textField("training"),
    { column: "correspondingInDb", from: ["correspondingInDB", "correspondingInDb"], normalize: (r) => r.correspondingInDB || r.correspondingInDb || null },
    textField("identifiedByUuid"),
    textField("comment"),
    { column: "source", from: ["addedFromDB"], normalize: (r) => (r.addedFromDB === true ? "db" : "manual") },
  ],
};

export class ApprTrainingNeedsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprTrainingNeedV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprTrainingNeedsV2)
      .where(and(
        inArray(apprTrainingNeedsV2.appraisalUuid, appraisalUuids),
        eq(apprTrainingNeedsV2.isDeleted, false)
      ))
      .orderBy(apprTrainingNeedsV2.sortOrder);
    const map = new Map<string, ApprTrainingNeedV2[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  // The whole section (create, stage submits): rows matched by uuid, live rows
  // missing from `rows` are soft-deleted, unchanged rows are not written.
  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string, executor: Executor = getDb()): Promise<number> {
    return syncChildRows(executor, ROWS, appraisalUuid, { rows }, "replace", auditUserUuid);
  }

  // A save-draft change set: only the given rows and deletions are written.
  async applyChanges(appraisalUuid: string, changes: AppraisalSectionChanges, auditUserUuid?: string, executor: Executor = getDb()): Promise<number> {
    return syncChildRows(executor, ROWS, appraisalUuid, changes, "patch", auditUserUuid);
  }
}
