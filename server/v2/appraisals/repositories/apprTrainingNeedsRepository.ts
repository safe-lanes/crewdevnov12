import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTrainingNeedsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTrainingNeedV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

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

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    await db.update(apprTrainingNeedsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(apprTrainingNeedsV2.appraisalUuid, appraisalUuid), eq(apprTrainingNeedsV2.isDeleted, false)));
    if (rows.length > 0) {
      const values = rows.map((row, i) => ({
        trainingNeedUuid: uuidv4(),
        appraisalUuid,
        training: row.training || null,
        comment: row.comment || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      }));
      await db.insert(apprTrainingNeedsV2).values(values);
    }
  }
}
