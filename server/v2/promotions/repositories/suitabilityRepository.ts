import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoSuitabilityV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoSuitabilityV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

function cleanNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v): v is string => v.length > 0);
}

export class SuitabilityRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoSuitabilityV2 | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(promoSuitabilityV2)
      .where(and(
        eq(promoSuitabilityV2.reviewUuid, reviewUuid),
        eq(promoSuitabilityV2.isDeleted, false),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoSuitabilityV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoSuitabilityV2)
      .where(and(
        inArray(promoSuitabilityV2.reviewUuid, reviewUuids),
        eq(promoSuitabilityV2.isDeleted, false),
      ));
  }

  async upsertForReview(
    reviewUuid: string,
    data: { vesselTypes?: string[]; fleetGroups?: string[] },
  ): Promise<void> {
    const db = getDb();
    const vesselTypes = cleanNames(data.vesselTypes);
    const fleetGroups = cleanNames(data.fleetGroups);

    await db
      .insert(promoSuitabilityV2)
      .values({
        psUuid: uuidv4(),
        reviewUuid,
        vesselTypes,
        fleetGroups,
      })
      .onConflictDoUpdate({
        target: promoSuitabilityV2.reviewUuid,
        set: {
          vesselTypes,
          fleetGroups,
          isDeleted: false,
          updatedAt: new Date(),
        },
      });
  }
}
