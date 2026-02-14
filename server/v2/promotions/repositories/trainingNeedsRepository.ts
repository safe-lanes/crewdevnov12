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
    const existing = await db
      .select()
      .from(promoTrainingNeedsV2)
      .where(and(eq(promoTrainingNeedsV2.reviewUuid, reviewUuid), eq(promoTrainingNeedsV2.isDeleted, false)));

    if (needs.length === 0) {
      if (existing.length > 0) {
        await db
          .update(promoTrainingNeedsV2)
          .set({ isDeleted: true, updatedAt: new Date() })
          .where(and(eq(promoTrainingNeedsV2.reviewUuid, reviewUuid), eq(promoTrainingNeedsV2.isDeleted, false)));
      }
      return [];
    }

    const results: PromoTrainingNeedV2[] = [];
    const usedExistingIds: number[] = [];

    for (let i = 0; i < needs.length; i++) {
      const n = needs[i];
      const match = n.trainingRowId
        ? existing.find(e => e.trainingRowId === n.trainingRowId && !usedExistingIds.includes(e.id))
        : existing[i] && !usedExistingIds.includes(existing[i].id) ? existing[i] : undefined;

      if (match) {
        usedExistingIds.push(match.id);
        const updated = await db
          .update(promoTrainingNeedsV2)
          .set({
            training: n.training,
            correspondingInDb: n.correspondingInDb,
            category: n.category,
            status: n.status,
            completionDate: n.completionDate,
            sortOrder: i,
            updatedAt: new Date(),
          })
          .where(eq(promoTrainingNeedsV2.id, match.id))
          .returning();
        results.push(updated[0]);
      } else {
        const inserted = await db
          .insert(promoTrainingNeedsV2)
          .values({ ...n, tnUuid: uuidv4(), reviewUuid, sortOrder: i })
          .returning();
        results.push(inserted[0]);
      }
    }

    const unusedIds = existing.filter(e => !usedExistingIds.includes(e.id)).map(e => e.id);
    if (unusedIds.length > 0) {
      await db
        .update(promoTrainingNeedsV2)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(inArray(promoTrainingNeedsV2.id, unusedIds));
    }

    return results;
  }
}
