import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprRecommendationsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprRecommendationV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprRecommendationsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprRecommendationV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprRecommendationsV2)
      .where(and(
        inArray(apprRecommendationsV2.appraisalUuid, appraisalUuids),
        eq(apprRecommendationsV2.isDeleted, false)
      ))
      .orderBy(apprRecommendationsV2.sortOrder);
    const map = new Map<string, ApprRecommendationV2[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    const now = new Date();

    const existing = await db
      .select()
      .from(apprRecommendationsV2)
      .where(and(
        eq(apprRecommendationsV2.appraisalUuid, appraisalUuid),
        eq(apprRecommendationsV2.isDeleted, false)
      ))
      .orderBy(apprRecommendationsV2.sortOrder);

    const updates: Promise<any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < existing.length) {
        updates.push(
          db.update(apprRecommendationsV2)
            .set({
              question: row.question || null,
              answer: row.answer || null,
              comment: row.comment || null,
              sortOrder: i,
              updatedByUuid: auditUserUuid || existing[i].updatedByUuid,
              updatedAt: now,
            })
            .where(eq(apprRecommendationsV2.id, existing[i].id))
        );
      } else {
        updates.push(
          db.insert(apprRecommendationsV2).values({
            recommendationUuid: uuidv4(),
            appraisalUuid,
            question: row.question || null,
            answer: row.answer || null,
            comment: row.comment || null,
            sortOrder: i,
            createdByUuid: auditUserUuid || null,
            updatedByUuid: auditUserUuid || null,
          })
        );
      }
    }

    for (let i = rows.length; i < existing.length; i++) {
      updates.push(
        db.update(apprRecommendationsV2)
          .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || existing[i].updatedByUuid })
          .where(eq(apprRecommendationsV2.id, existing[i].id))
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }
}
