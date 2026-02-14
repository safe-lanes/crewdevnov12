import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { promotionReviewsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromotionReviewV2, InsertPromotionReviewV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class PromotionReviewsRepository {
  async findAll(): Promise<PromotionReviewV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promotionReviewsV2)
      .where(eq(promotionReviewsV2.isDeleted, false))
      .orderBy(desc(promotionReviewsV2.createdAt));
  }

  async findByUuid(reviewUuid: string): Promise<PromotionReviewV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(promotionReviewsV2)
      .where(and(eq(promotionReviewsV2.reviewUuid, reviewUuid), eq(promotionReviewsV2.isDeleted, false)));
    return results[0];
  }

  async findById(id: number): Promise<PromotionReviewV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(promotionReviewsV2)
      .where(and(eq(promotionReviewsV2.id, id), eq(promotionReviewsV2.isDeleted, false)));
    return results[0];
  }

  async findByCrewMemberId(crewMemberId: string): Promise<PromotionReviewV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promotionReviewsV2)
      .where(and(eq(promotionReviewsV2.crewMemberId, crewMemberId), eq(promotionReviewsV2.isDeleted, false)))
      .orderBy(desc(promotionReviewsV2.createdAt));
  }

  async findByCrewAndRank(crewMemberId: string, promotionToRank: string): Promise<PromotionReviewV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(promotionReviewsV2)
      .where(and(
        eq(promotionReviewsV2.crewMemberId, crewMemberId),
        eq(promotionReviewsV2.promotionToRank, promotionToRank),
        eq(promotionReviewsV2.isDeleted, false)
      ));
    return results[0];
  }

  async findByUuids(reviewUuids: string[]): Promise<PromotionReviewV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promotionReviewsV2)
      .where(and(inArray(promotionReviewsV2.reviewUuid, reviewUuids), eq(promotionReviewsV2.isDeleted, false)));
  }

  async create(data: Omit<InsertPromotionReviewV2, "reviewUuid">): Promise<PromotionReviewV2> {
    const db = getDb();
    const results = await db
      .insert(promotionReviewsV2)
      .values({ ...data, reviewUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(reviewUuid: string, data: Partial<InsertPromotionReviewV2>): Promise<PromotionReviewV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(promotionReviewsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(promotionReviewsV2.reviewUuid, reviewUuid), eq(promotionReviewsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDelete(reviewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(promotionReviewsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promotionReviewsV2.reviewUuid, reviewUuid), eq(promotionReviewsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
