import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoCriteriaStatusV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoCriteriaStatusV2, InsertPromoCriteriaStatusV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { captureChange } from "../../sync/changeCapture";

export class CriteriaStatusRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoCriteriaStatusV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoCriteriaStatusV2)
      .where(and(eq(promoCriteriaStatusV2.reviewUuid, reviewUuid), eq(promoCriteriaStatusV2.isDeleted, false)))
      .orderBy(promoCriteriaStatusV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoCriteriaStatusV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoCriteriaStatusV2)
      .where(and(inArray(promoCriteriaStatusV2.reviewUuid, reviewUuids), eq(promoCriteriaStatusV2.isDeleted, false)))
      .orderBy(promoCriteriaStatusV2.sortOrder);
  }

  // `executor` is a transaction (tx) or the default connection. The written
  // row is reported to the sync change capture on the same executor (PRD-07).
  async upsert(reviewUuid: string, criteriaCode: string, data: Partial<InsertPromoCriteriaStatusV2>, auditUserUuid: string | null = null, executor: any = getDb()): Promise<PromoCriteriaStatusV2> {
    const db = executor;
    const existing = await db
      .select()
      .from(promoCriteriaStatusV2)
      .where(and(
        eq(promoCriteriaStatusV2.reviewUuid, reviewUuid),
        eq(promoCriteriaStatusV2.criteriaCode, criteriaCode),
        eq(promoCriteriaStatusV2.isDeleted, false)
      ));
    const old = existing[0] ?? null;
    const results = old
      ? await db
        .update(promoCriteriaStatusV2)
        .set({ ...data, updatedAt: new Date(), updatedByUuid: auditUserUuid })
        .where(eq(promoCriteriaStatusV2.id, old.id))
        .returning()
      : await db
        .insert(promoCriteriaStatusV2)
        .values({ ...data, csUuid: uuidv4(), reviewUuid, criteriaCode, createdByUuid: auditUserUuid, updatedByUuid: auditUserUuid })
        .returning();
    const row = results[0];
    await captureChange(db, { table: promoCriteriaStatusV2, rowUuid: row?.csUuid, oldRow: old, newRow: row, actorUuid: auditUserUuid });
    return row;
  }
}
