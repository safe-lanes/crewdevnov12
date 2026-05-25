import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprTrainingsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprTrainingV2 } from "../../../../shared/v2/appraisals/types";
import { v4 as uuidv4 } from "uuid";

export class ApprTrainingsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprTrainingV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprTrainingsV2)
      .where(and(
        inArray(apprTrainingsV2.appraisalUuid, appraisalUuids),
        eq(apprTrainingsV2.isDeleted, false)
      ))
      .orderBy(apprTrainingsV2.sortOrder);
    const map = new Map<string, ApprTrainingV2[]>();
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
      .from(apprTrainingsV2)
      .where(and(
        eq(apprTrainingsV2.appraisalUuid, appraisalUuid),
        eq(apprTrainingsV2.isDeleted, false)
      ))
      .orderBy(apprTrainingsV2.sortOrder);

    const updates: Promise<any>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < existing.length) {
        updates.push(
          db.update(apprTrainingsV2)
            .set({
              training: row.training || null,
              evaluation: row.evaluation || null,
              comment: row.comment || null,
              // Preserve existing source unless the client explicitly sets it.
              source: row.source || existing[i].source || "manual",
              sortOrder: i,
              updatedByUuid: auditUserUuid || existing[i].updatedByUuid,
              updatedAt: now,
            })
            .where(eq(apprTrainingsV2.id, existing[i].id))
        );
      } else {
        updates.push(
          db.insert(apprTrainingsV2).values({
            trainingUuid: uuidv4(),
            appraisalUuid,
            training: row.training || null,
            evaluation: row.evaluation || null,
            comment: row.comment || null,
            source: row.source || "manual",
            sortOrder: i,
            createdByUuid: auditUserUuid || null,
            updatedByUuid: auditUserUuid || null,
          })
        );
      }
    }

    for (let i = rows.length; i < existing.length; i++) {
      updates.push(
        db.update(apprTrainingsV2)
          .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || existing[i].updatedByUuid })
          .where(eq(apprTrainingsV2.id, existing[i].id))
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }
}
