import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTrainingNeedsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTrainingNeedV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprTrainingNeedsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprTrainingNeedV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprTrainingNeedsV2)
      .where(and(
        inArray(apprTrainingNeedsV2.appraisalUuid, appraisalUuids),
        eq(apprTrainingNeedsV2.isDeleted, false)
      ))
      .orderBy(apprTrainingNeedsV2.sortOrder);
    const map = new Map<string, ApprTrainingNeedV2[]>();
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
      .from(apprTrainingNeedsV2)
      .where(and(
        eq(apprTrainingNeedsV2.appraisalUuid, appraisalUuid),
        eq(apprTrainingNeedsV2.isDeleted, false)
      ))
      .orderBy(apprTrainingNeedsV2.sortOrder);

    const updates: Promise<any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < existing.length) {
        updates.push(
          db.update(apprTrainingNeedsV2)
            .set({
              training: row.training || null,
              correspondingInDb: row.correspondingInDB || row.correspondingInDb || null,
              identifiedByUuid: row.identifiedByUuid || null,
              comment: row.comment || null,
              source: row.addedFromDB === true ? "db" : "manual",
              sortOrder: i,
              updatedByUuid: auditUserUuid || existing[i].updatedByUuid,
              updatedAt: now,
            })
            .where(eq(apprTrainingNeedsV2.id, existing[i].id))
        );
      } else {
        updates.push(
          db.insert(apprTrainingNeedsV2).values({
            trainingNeedUuid: uuidv4(),
            appraisalUuid,
            training: row.training || null,
            correspondingInDb: row.correspondingInDB || row.correspondingInDb || null,
            identifiedByUuid: row.identifiedByUuid || null,
            comment: row.comment || null,
            source: row.addedFromDB === true ? "db" : "manual",
            sortOrder: i,
            createdByUuid: auditUserUuid || null,
            updatedByUuid: auditUserUuid || null,
          })
        );
      }
    }

    for (let i = rows.length; i < existing.length; i++) {
      updates.push(
        db.update(apprTrainingNeedsV2)
          .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || existing[i].updatedByUuid })
          .where(eq(apprTrainingNeedsV2.id, existing[i].id))
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }
}
