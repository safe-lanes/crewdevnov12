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
    await db.update(apprOfficeReviewsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(apprOfficeReviewsV2.appraisalUuid, appraisalUuid), eq(apprOfficeReviewsV2.isDeleted, false)));
    if (rows.length > 0) {
      const values = rows.map((row, i) => ({
        officeReviewUuid: uuidv4(),
        appraisalUuid,
        name: row.name || null,
        position: row.position || null,
        feedback: row.feedback || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      }));
      await db.insert(apprOfficeReviewsV2).values(values);
    }
  }
}
