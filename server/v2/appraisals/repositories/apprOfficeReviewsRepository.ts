import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprOfficeReviewsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprOfficeReviewV2 } from "../../../../shared/v2/appraisals/types";
import type { AppraisalSectionChanges } from "../../../../shared/v2/appraisals/appraisalChanges";
import { syncChildRows, textField, type ChildTableConfig } from "./childRowSync";

// A transaction (tx) or the default connection.
type Executor = any;

const ROWS: ChildTableConfig = {
  table: apprOfficeReviewsV2,
  uuidKey: "officeReviewUuid",
  fields: [
    textField("name"),
    textField("position"),
    textField("feedback"),
    textField("userUuid"),
    { column: "isAssigned", from: ["isAssigned"], normalize: (r) => r.isAssigned ?? false },
  ],
};

export class ApprOfficeReviewsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprOfficeReviewV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprOfficeReviewsV2)
      .where(and(
        inArray(apprOfficeReviewsV2.appraisalUuid, appraisalUuids),
        eq(apprOfficeReviewsV2.isDeleted, false)
      ))
      .orderBy(apprOfficeReviewsV2.sortOrder);
    const map = new Map<string, ApprOfficeReviewV2[]>();
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
