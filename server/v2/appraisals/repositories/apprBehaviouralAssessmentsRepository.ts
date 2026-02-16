import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprBehaviouralAssessmentsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprBehaviouralAssessmentV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprBehaviouralAssessmentsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprBehaviouralAssessmentV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprBehaviouralAssessmentsV2)
      .where(and(
        inArray(apprBehaviouralAssessmentsV2.appraisalUuid, appraisalUuids),
        eq(apprBehaviouralAssessmentsV2.isDeleted, false)
      ))
      .orderBy(apprBehaviouralAssessmentsV2.sortOrder);
    const map = new Map<string, ApprBehaviouralAssessmentV2[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    await db.update(apprBehaviouralAssessmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(apprBehaviouralAssessmentsV2.appraisalUuid, appraisalUuid), eq(apprBehaviouralAssessmentsV2.isDeleted, false)));
    if (rows.length > 0) {
      const values = rows.map((row, i) => ({
        behaviouralUuid: uuidv4(),
        appraisalUuid,
        assessmentCriteria: row.assessmentCriteria || null,
        weight: row.weight != null ? Number(row.weight) : null,
        effectiveness: row.effectiveness || null,
        comment: row.comment || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      }));
      await db.insert(apprBehaviouralAssessmentsV2).values(values);
    }
  }
}
