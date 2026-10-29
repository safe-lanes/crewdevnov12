import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprCompetenceAssessmentsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprCompetenceAssessmentV2 } from "../../../../shared/v2/appraisals/types";
import type { AppraisalSectionChanges } from "../../../../shared/v2/appraisals/appraisalChanges";
import { syncChildRows, textField, type ChildTableConfig } from "./childRowSync";

// A transaction (tx) or the default connection.
type Executor = any;

const ROWS: ChildTableConfig = {
  table: apprCompetenceAssessmentsV2,
  uuidKey: "competenceUuid",
  fields: [
    textField("assessmentCriteria"),
    { column: "weight", from: ["weight"], normalize: (r) => (r.weight != null ? Number(r.weight) : null) },
    textField("effectiveness"),
    textField("comment"),
  ],
};

export class ApprCompetenceAssessmentsRepository {
  async findByAppraisalUuids(appraisalUuids: string[], executor: Executor = getDb()): Promise<Map<string, ApprCompetenceAssessmentV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const rows: ApprCompetenceAssessmentV2[] = await executor
      .select()
      .from(apprCompetenceAssessmentsV2)
      .where(and(
        inArray(apprCompetenceAssessmentsV2.appraisalUuid, appraisalUuids),
        eq(apprCompetenceAssessmentsV2.isDeleted, false)
      ))
      .orderBy(apprCompetenceAssessmentsV2.sortOrder);
    const map = new Map<string, ApprCompetenceAssessmentV2[]>();
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
