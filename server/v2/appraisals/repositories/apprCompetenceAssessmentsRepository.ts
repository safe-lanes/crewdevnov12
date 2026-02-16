import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprCompetenceAssessmentsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprCompetenceAssessmentV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprCompetenceAssessmentsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprCompetenceAssessmentV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
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

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    await db.update(apprCompetenceAssessmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(apprCompetenceAssessmentsV2.appraisalUuid, appraisalUuid), eq(apprCompetenceAssessmentsV2.isDeleted, false)));
    if (rows.length > 0) {
      const values = rows.map((row, i) => ({
        competenceUuid: uuidv4(),
        appraisalUuid,
        assessmentCriteria: row.assessmentCriteria || null,
        weight: row.weight != null ? Number(row.weight) : null,
        effectiveness: row.effectiveness || null,
        comment: row.comment || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      }));
      await db.insert(apprCompetenceAssessmentsV2).values(values);
    }
  }
}
