import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprSeafarerCommentsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprSeafarerCommentV2 } from "../../../../shared/v2/appraisals/types";
import type { AppraisalSectionChanges } from "../../../../shared/v2/appraisals/appraisalChanges";
import { syncChildRows, textField, type ChildTableConfig } from "./childRowSync";

// A transaction (tx) or the default connection.
type Executor = any;

const ROWS: ChildTableConfig = {
  table: apprSeafarerCommentsV2,
  uuidKey: "seafarerCommentUuid",
  fields: [
    textField("name"),
    textField("rank"),
    textField("comment"),
  ],
};

export class ApprSeafarerCommentsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprSeafarerCommentV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprSeafarerCommentsV2)
      .where(and(
        inArray(apprSeafarerCommentsV2.appraisalUuid, appraisalUuids),
        eq(apprSeafarerCommentsV2.isDeleted, false)
      ))
      .orderBy(apprSeafarerCommentsV2.sortOrder);
    const map = new Map<string, ApprSeafarerCommentV2[]>();
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
