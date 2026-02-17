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
    const now = new Date();

    const existing = await db
      .select()
      .from(apprSeafarerCommentsV2)
      .where(and(
        eq(apprSeafarerCommentsV2.appraisalUuid, appraisalUuid),
        eq(apprSeafarerCommentsV2.isDeleted, false)
      ))
      .orderBy(apprSeafarerCommentsV2.sortOrder);

    const updates: Promise<any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < existing.length) {
        updates.push(
          db.update(apprSeafarerCommentsV2)
            .set({
              name: row.name || null,
              rank: row.rank || null,
              comment: row.comment || null,
              sortOrder: i,
              updatedByUuid: auditUserUuid || existing[i].updatedByUuid,
              updatedAt: now,
            })
            .where(eq(apprSeafarerCommentsV2.id, existing[i].id))
        );
      } else {
        updates.push(
          db.insert(apprSeafarerCommentsV2).values({
            seafarerCommentUuid: uuidv4(),
            appraisalUuid,
            name: row.name || null,
            rank: row.rank || null,
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
        db.update(apprSeafarerCommentsV2)
          .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || existing[i].updatedByUuid })
          .where(eq(apprSeafarerCommentsV2.id, existing[i].id))
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }
}
