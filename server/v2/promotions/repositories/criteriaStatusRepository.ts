import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoCriteriaStatusV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoCriteriaStatusV2, InsertPromoCriteriaStatusV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

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

  async upsert(reviewUuid: string, criteriaCode: string, data: Partial<InsertPromoCriteriaStatusV2>): Promise<PromoCriteriaStatusV2> {
    const db = getDb();
    const existing = await db
      .select()
      .from(promoCriteriaStatusV2)
      .where(and(
        eq(promoCriteriaStatusV2.reviewUuid, reviewUuid),
        eq(promoCriteriaStatusV2.criteriaCode, criteriaCode),
        eq(promoCriteriaStatusV2.isDeleted, false)
      ));
    if (existing.length > 0) {
      const results = await db
        .update(promoCriteriaStatusV2)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(promoCriteriaStatusV2.id, existing[0].id))
        .returning();
      return results[0];
    }
    const results = await db
      .insert(promoCriteriaStatusV2)
      .values({ ...data, csUuid: uuidv4(), reviewUuid, criteriaCode })
      .returning();
    return results[0];
  }

  async deleteByReviewUuid(reviewUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(promoCriteriaStatusV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoCriteriaStatusV2.reviewUuid, reviewUuid), eq(promoCriteriaStatusV2.isDeleted, false)));
  }
}
