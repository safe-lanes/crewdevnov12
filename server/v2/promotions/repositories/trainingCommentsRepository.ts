import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoTrainingCommentsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoTrainingCommentV2, InsertPromoTrainingCommentV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class TrainingCommentsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoTrainingCommentV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoTrainingCommentsV2)
      .where(and(eq(promoTrainingCommentsV2.reviewUuid, reviewUuid), eq(promoTrainingCommentsV2.isDeleted, false)))
      .orderBy(promoTrainingCommentsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoTrainingCommentV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoTrainingCommentsV2)
      .where(and(inArray(promoTrainingCommentsV2.reviewUuid, reviewUuids), eq(promoTrainingCommentsV2.isDeleted, false)))
      .orderBy(promoTrainingCommentsV2.sortOrder);
  }

  async create(data: Omit<InsertPromoTrainingCommentV2, "tcUuid">): Promise<PromoTrainingCommentV2> {
    const db = getDb();
    const results = await db
      .insert(promoTrainingCommentsV2)
      .values({ ...data, tcUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async replaceForReview(reviewUuid: string, comments: Omit<InsertPromoTrainingCommentV2, "tcUuid" | "reviewUuid">[]): Promise<PromoTrainingCommentV2[]> {
    const db = getDb();
    await db
      .update(promoTrainingCommentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoTrainingCommentsV2.reviewUuid, reviewUuid), eq(promoTrainingCommentsV2.isDeleted, false)));
    if (comments.length === 0) return [];
    const results = await db
      .insert(promoTrainingCommentsV2)
      .values(comments.map((c, i) => ({ ...c, tcUuid: uuidv4(), reviewUuid, sortOrder: i })))
      .returning();
    return results;
  }
}
