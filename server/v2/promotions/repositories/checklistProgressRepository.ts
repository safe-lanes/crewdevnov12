import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoChecklistProgressV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoChecklistProgressV2, InsertPromoChecklistProgressV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class ChecklistProgressRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoChecklistProgressV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoChecklistProgressV2)
      .where(and(eq(promoChecklistProgressV2.reviewUuid, reviewUuid), eq(promoChecklistProgressV2.isDeleted, false)))
      .orderBy(promoChecklistProgressV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoChecklistProgressV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoChecklistProgressV2)
      .where(and(inArray(promoChecklistProgressV2.reviewUuid, reviewUuids), eq(promoChecklistProgressV2.isDeleted, false)))
      .orderBy(promoChecklistProgressV2.sortOrder);
  }

  async upsert(reviewUuid: string, sectionId: string, assessmentPointId: string, data: Partial<InsertPromoChecklistProgressV2>): Promise<PromoChecklistProgressV2> {
    const db = getDb();
    const existing = await db
      .select()
      .from(promoChecklistProgressV2)
      .where(and(
        eq(promoChecklistProgressV2.reviewUuid, reviewUuid),
        eq(promoChecklistProgressV2.sectionId, sectionId),
        eq(promoChecklistProgressV2.assessmentPointId, assessmentPointId),
        eq(promoChecklistProgressV2.isDeleted, false)
      ));
    if (existing.length > 0) {
      const results = await db
        .update(promoChecklistProgressV2)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(promoChecklistProgressV2.id, existing[0].id))
        .returning();
      return results[0];
    }
    const results = await db
      .insert(promoChecklistProgressV2)
      .values({ ...data, cpUuid: uuidv4(), reviewUuid, sectionId, assessmentPointId })
      .returning();
    return results[0];
  }

  async replaceForReview(reviewUuid: string, items: Omit<InsertPromoChecklistProgressV2, "cpUuid" | "reviewUuid">[]): Promise<PromoChecklistProgressV2[]> {
    const db = getDb();
    await db
      .update(promoChecklistProgressV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoChecklistProgressV2.reviewUuid, reviewUuid), eq(promoChecklistProgressV2.isDeleted, false)));
    if (items.length === 0) return [];
    const results = await db
      .insert(promoChecklistProgressV2)
      .values(items.map((item, i) => ({ ...item, cpUuid: uuidv4(), reviewUuid, sortOrder: i })))
      .returning();
    return results;
  }
}
