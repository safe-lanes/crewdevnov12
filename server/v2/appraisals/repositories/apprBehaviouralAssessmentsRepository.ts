import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprBehaviouralAssessmentsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprBehaviouralAssessmentV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

// A transaction (tx) or the default connection.
type Executor = any;

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

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string, executor: Executor = getDb()): Promise<void> {
    const db = executor;
    const now = new Date();

    const existing = await db
      .select()
      .from(apprBehaviouralAssessmentsV2)
      .where(and(
        eq(apprBehaviouralAssessmentsV2.appraisalUuid, appraisalUuid),
        eq(apprBehaviouralAssessmentsV2.isDeleted, false)
      ))
      .orderBy(apprBehaviouralAssessmentsV2.sortOrder);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < existing.length) {
        await db.update(apprBehaviouralAssessmentsV2)
          .set({
            assessmentCriteria: row.assessmentCriteria || null,
            weight: row.weight != null ? Number(row.weight) : null,
            effectiveness: row.effectiveness || null,
            comment: row.comment || null,
            sortOrder: i,
            updatedByUuid: auditUserUuid || existing[i].updatedByUuid,
            updatedAt: now,
          })
          .where(eq(apprBehaviouralAssessmentsV2.id, existing[i].id));
      } else {
        await db.insert(apprBehaviouralAssessmentsV2).values({
          behaviouralUuid: uuidv4(),
          appraisalUuid,
          assessmentCriteria: row.assessmentCriteria || null,
          weight: row.weight != null ? Number(row.weight) : null,
          effectiveness: row.effectiveness || null,
          comment: row.comment || null,
          sortOrder: i,
          createdByUuid: auditUserUuid || null,
          updatedByUuid: auditUserUuid || null,
        });
      }
    }

    for (let i = rows.length; i < existing.length; i++) {
      await db.update(apprBehaviouralAssessmentsV2)
        .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || existing[i].updatedByUuid })
        .where(eq(apprBehaviouralAssessmentsV2.id, existing[i].id));
    }
  }
}
