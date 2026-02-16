import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTrainingFollowupsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTrainingFollowupV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprTrainingFollowupsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprTrainingFollowupV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprTrainingFollowupsV2)
      .where(and(
        inArray(apprTrainingFollowupsV2.appraisalUuid, appraisalUuids),
        eq(apprTrainingFollowupsV2.isDeleted, false)
      ))
      .orderBy(apprTrainingFollowupsV2.sortOrder);
    const map = new Map<string, ApprTrainingFollowupV2[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    await db.update(apprTrainingFollowupsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(apprTrainingFollowupsV2.appraisalUuid, appraisalUuid), eq(apprTrainingFollowupsV2.isDeleted, false)));
    if (rows.length > 0) {
      const values = rows.map((row, i) => ({
        trainingFollowupUuid: uuidv4(),
        appraisalUuid,
        training: row.training || null,
        correspondingInDb: row.correspondingInDB || row.correspondingInDb || null,
        category: row.category || null,
        status: row.status || null,
        targetDate: row.targetDate || null,
        comment: row.comment || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      }));
      await db.insert(apprTrainingFollowupsV2).values(values);
    }
  }
}
