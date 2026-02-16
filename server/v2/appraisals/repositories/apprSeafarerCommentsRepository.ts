import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprSeafarerCommentsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprSeafarerCommentV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprSeafarerCommentsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprSeafarerCommentV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprSeafarerCommentsV2)
      .where(and(
        inArray(apprSeafarerCommentsV2.appraisalUuid, appraisalUuids),
        eq(apprSeafarerCommentsV2.isDeleted, false)
      ))
      .orderBy(apprSeafarerCommentsV2.sortOrder);
    const map = new Map<string, ApprSeafarerCommentV2[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string): Promise<void> {
    const db = getDb();
    await db.update(apprSeafarerCommentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(apprSeafarerCommentsV2.appraisalUuid, appraisalUuid), eq(apprSeafarerCommentsV2.isDeleted, false)));
    if (rows.length > 0) {
      const values = rows.map((row, i) => ({
        seafarerCommentUuid: uuidv4(),
        appraisalUuid,
        name: row.name || null,
        rank: row.rank || null,
        comment: row.comment || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      }));
      await db.insert(apprSeafarerCommentsV2).values(values);
    }
  }
}
