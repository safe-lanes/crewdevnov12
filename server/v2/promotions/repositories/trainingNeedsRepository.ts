import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoTrainingNeedsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoTrainingNeedV2, InsertPromoTrainingNeedV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class TrainingNeedsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoTrainingNeedV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoTrainingNeedsV2)
      .where(and(eq(promoTrainingNeedsV2.reviewUuid, reviewUuid), eq(promoTrainingNeedsV2.isDeleted, false)))
      .orderBy(promoTrainingNeedsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoTrainingNeedV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoTrainingNeedsV2)
      .where(and(inArray(promoTrainingNeedsV2.reviewUuid, reviewUuids), eq(promoTrainingNeedsV2.isDeleted, false)))
      .orderBy(promoTrainingNeedsV2.sortOrder);
  }

  async create(data: Omit<InsertPromoTrainingNeedV2, "tnUuid">): Promise<PromoTrainingNeedV2> {
    const db = getDb();
    const results = await db
      .insert(promoTrainingNeedsV2)
      .values({ ...data, tnUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async replaceForReview(reviewUuid: string, needs: Omit<InsertPromoTrainingNeedV2, "tnUuid" | "reviewUuid">[]): Promise<PromoTrainingNeedV2[]> {
    const db = getDb();
    await db
      .update(promoTrainingNeedsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoTrainingNeedsV2.reviewUuid, reviewUuid), eq(promoTrainingNeedsV2.isDeleted, false)));
    if (needs.length === 0) return [];
    const results = await db
      .insert(promoTrainingNeedsV2)
      .values(needs.map((n, i) => ({ ...n, tnUuid: uuidv4(), reviewUuid, sortOrder: i })))
      .returning();
    return results;
  }
}
