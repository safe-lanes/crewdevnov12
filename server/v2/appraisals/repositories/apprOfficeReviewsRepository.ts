import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprOfficeReviewsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprOfficeReviewV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

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

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    const now = new Date();

    const existing = await db
      .select()
      .from(apprOfficeReviewsV2)
      .where(and(
        eq(apprOfficeReviewsV2.appraisalUuid, appraisalUuid),
        eq(apprOfficeReviewsV2.isDeleted, false)
      ))
      .orderBy(apprOfficeReviewsV2.sortOrder);

    const updates: Promise<any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < existing.length) {
        updates.push(
          db.update(apprOfficeReviewsV2)
            .set({
              name: row.name || null,
              position: row.position || null,
              feedback: row.feedback || null,
              userUuid: row.userUuid || null,
              isAssigned: row.isAssigned ?? false,
              sortOrder: i,
              updatedByUuid: auditUserUuid || existing[i].updatedByUuid,
              updatedAt: now,
            })
            .where(eq(apprOfficeReviewsV2.id, existing[i].id))
        );
      } else {
        updates.push(
          db.insert(apprOfficeReviewsV2).values({
            officeReviewUuid: uuidv4(),
            appraisalUuid,
            name: row.name || null,
            position: row.position || null,
            feedback: row.feedback || null,
            userUuid: row.userUuid || null,
            isAssigned: row.isAssigned ?? false,
            sortOrder: i,
            createdByUuid: auditUserUuid || null,
            updatedByUuid: auditUserUuid || null,
          })
        );
      }
    }

    for (let i = rows.length; i < existing.length; i++) {
      updates.push(
        db.update(apprOfficeReviewsV2)
          .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || existing[i].updatedByUuid })
          .where(eq(apprOfficeReviewsV2.id, existing[i].id))
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }
}
