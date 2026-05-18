import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../../db";
import { promoSuitabilityFleetGroupsV2 } from "../../../../shared/v2/promotions/schema";
import { masterFleetGroups } from "../../../../shared/schema";
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

  private async resolveNameToUuid(names: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (names.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({ fgUuid: masterFleetGroups.fgUuid, name: masterFleetGroups.name })
      .from(masterFleetGroups)
      .where(and(
        isNotNull(masterFleetGroups.fgUuid),
        isNotNull(masterFleetGroups.name),
      ));
    const byLowerName = new Map<string, string>();
    for (const r of rows) {
      if (r.name && r.fgUuid) {
        byLowerName.set(r.name.trim().toLowerCase(), r.fgUuid);
      }
    }
    for (const n of names) {
      const key = n.trim().toLowerCase();
      const uuid = byLowerName.get(key);
      if (uuid) map.set(n, uuid);
    }
    return map;
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

    const uuidByName = await this.resolveNameToUuid(cleaned);

    await db.insert(promoSuitabilityFleetGroupsV2).values(
      cleaned.map((fleetGroupName, idx) => ({
        sfgUuid: uuidv4(),
        reviewUuid,
        fleetGroupUuid: uuidByName.get(fleetGroupName) ?? null,
        fleetGroupName,
        sortOrder: idx,
      }))
    );
  }
}
