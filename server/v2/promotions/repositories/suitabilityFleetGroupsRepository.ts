import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoSuitabilityFleetGroupsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoSuitabilityFleetGroupV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class SuitabilityFleetGroupsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoSuitabilityFleetGroupV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoSuitabilityFleetGroupsV2)
      .where(and(
        eq(promoSuitabilityFleetGroupsV2.reviewUuid, reviewUuid),
        eq(promoSuitabilityFleetGroupsV2.isDeleted, false),
      ))
      .orderBy(promoSuitabilityFleetGroupsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoSuitabilityFleetGroupV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoSuitabilityFleetGroupsV2)
      .where(and(
        inArray(promoSuitabilityFleetGroupsV2.reviewUuid, reviewUuids),
        eq(promoSuitabilityFleetGroupsV2.isDeleted, false),
      ))
      .orderBy(promoSuitabilityFleetGroupsV2.sortOrder);
  }

  async replaceForReview(reviewUuid: string, names: string[]): Promise<void> {
    const db = getDb();
    await db
      .update(promoSuitabilityFleetGroupsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(
        eq(promoSuitabilityFleetGroupsV2.reviewUuid, reviewUuid),
        eq(promoSuitabilityFleetGroupsV2.isDeleted, false),
      ));

    const cleaned = (names || [])
      .map(n => (typeof n === 'string' ? n.trim() : ''))
      .filter(n => !!n);

    if (cleaned.length === 0) return;

    await db.insert(promoSuitabilityFleetGroupsV2).values(
      cleaned.map((fleetGroupName, idx) => ({
        sfgUuid: uuidv4(),
        reviewUuid,
        fleetGroupName,
        sortOrder: idx,
      }))
    );
  }
}
