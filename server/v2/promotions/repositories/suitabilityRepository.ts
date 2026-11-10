import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoSuitabilityV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoSuitabilityV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { captureChange } from "../../sync/changeCapture";

function cleanNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v): v is string => v.length > 0);
}

export class SuitabilityRepository {
  // `executor` is a transaction (tx) or the default connection.
  async findByReviewUuid(reviewUuid: string, executor: any = getDb()): Promise<PromoSuitabilityV2 | null> {
    const rows = await executor
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

  // One row per review (unique review_uuid), deleted or not: the insert
  // updates it when it exists. The row is reported to the sync change capture
  // on the same executor (PRD-07).
  async upsertForReview(
    reviewUuid: string,
    data: { vesselTypes?: string[]; fleetGroups?: string[] },
    auditUserUuid: string | null = null,
    executor: any = getDb(),
  ): Promise<void> {
    const vesselTypes = cleanNames(data.vesselTypes);
    const fleetGroups = cleanNames(data.fleetGroups);

    const [old] = await executor
      .select()
      .from(promoSuitabilityV2)
      .where(eq(promoSuitabilityV2.reviewUuid, reviewUuid))
      .limit(1);
    const [row] = await executor
      .insert(promoSuitabilityV2)
      .values({
        psUuid: uuidv4(),
        reviewUuid,
        vesselTypes,
        fleetGroups,
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      })
      .onConflictDoUpdate({
        target: promoSuitabilityV2.reviewUuid,
        set: {
          vesselTypes,
          fleetGroups,
          isDeleted: false,
          updatedAt: new Date(),
          updatedByUuid: auditUserUuid,
        },
      })
      .returning();
    await captureChange(executor, { table: promoSuitabilityV2, rowUuid: row?.psUuid, oldRow: old ?? null, newRow: row, actorUuid: auditUserUuid });
  }
}
