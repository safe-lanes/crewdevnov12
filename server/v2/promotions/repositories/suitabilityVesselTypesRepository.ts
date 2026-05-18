import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoSuitabilityVesselTypesV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoSuitabilityVesselTypeV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class SuitabilityVesselTypesRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoSuitabilityVesselTypeV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoSuitabilityVesselTypesV2)
      .where(and(
        eq(promoSuitabilityVesselTypesV2.reviewUuid, reviewUuid),
        eq(promoSuitabilityVesselTypesV2.isDeleted, false),
      ))
      .orderBy(promoSuitabilityVesselTypesV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoSuitabilityVesselTypeV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoSuitabilityVesselTypesV2)
      .where(and(
        inArray(promoSuitabilityVesselTypesV2.reviewUuid, reviewUuids),
        eq(promoSuitabilityVesselTypesV2.isDeleted, false),
      ))
      .orderBy(promoSuitabilityVesselTypesV2.sortOrder);
  }

  async replaceForReview(reviewUuid: string, names: string[]): Promise<void> {
    const db = getDb();
    await db
      .update(promoSuitabilityVesselTypesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(
        eq(promoSuitabilityVesselTypesV2.reviewUuid, reviewUuid),
        eq(promoSuitabilityVesselTypesV2.isDeleted, false),
      ));

    const cleaned = (names || [])
      .map(n => (typeof n === 'string' ? n.trim() : ''))
      .filter(n => !!n);

    if (cleaned.length === 0) return;

    await db.insert(promoSuitabilityVesselTypesV2).values(
      cleaned.map((vesselTypeName, idx) => ({
        svtUuid: uuidv4(),
        reviewUuid,
        vesselTypeName,
        sortOrder: idx,
      }))
    );
  }
}
