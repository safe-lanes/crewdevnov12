import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTrainingsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTrainingV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

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

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    await db.update(apprTrainingsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(apprTrainingsV2.appraisalUuid, appraisalUuid), eq(apprTrainingsV2.isDeleted, false)));
    if (rows.length > 0) {
      const values = rows.map((row, i) => ({
        trainingUuid: uuidv4(),
        appraisalUuid,
        training: row.training || null,
        evaluation: row.evaluation || null,
        comment: row.comment || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      }));
      await db.insert(apprTrainingsV2).values(values);
    }
  }
}
