import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTargetsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTargetV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprTargetsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprTargetV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprTargetsV2)
      .where(and(
        inArray(apprTargetsV2.appraisalUuid, appraisalUuids),
        eq(apprTargetsV2.isDeleted, false)
      ))
      .orderBy(apprTargetsV2.sortOrder);
    const map = new Map<string, ApprTargetV2[]>();
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
      .from(apprTargetsV2)
      .where(and(
        eq(apprTargetsV2.appraisalUuid, appraisalUuid),
        eq(apprTargetsV2.isDeleted, false)
      ))
      .orderBy(apprTargetsV2.sortOrder);

    const updates: Promise<any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < existing.length) {
        updates.push(
          db.update(apprTargetsV2)
            .set({
              targetSetting: row.targetSetting || null,
              evaluation: row.evaluation || null,
              comment: row.comment || null,
              sortOrder: i,
              updatedByUuid: auditUserUuid || existing[i].updatedByUuid,
              updatedAt: now,
            })
            .where(eq(apprTargetsV2.id, existing[i].id))
        );
      } else {
        updates.push(
          db.insert(apprTargetsV2).values({
            targetUuid: uuidv4(),
            appraisalUuid,
            targetSetting: row.targetSetting || null,
            evaluation: row.evaluation || null,
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
        db.update(apprTargetsV2)
          .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || existing[i].updatedByUuid })
          .where(eq(apprTargetsV2.id, existing[i].id))
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }
}
