import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { promoExecutionLedgerV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoExecutionLedgerV2, InsertPromoExecutionLedgerV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class ExecutionLedgerRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoExecutionLedgerV2 | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(promoExecutionLedgerV2)
      .where(and(
        eq(promoExecutionLedgerV2.reviewUuid, reviewUuid),
        eq(promoExecutionLedgerV2.isDeleted, false),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * All applied-promotion ledger rows for the given crew member ids (empNos),
   * ordered by effective date ascending so callers can reconstruct the rank
   * timeline. Returns an empty array when no ids are supplied.
   */
  async findByCrewMemberIds(crewMemberIds: string[]): Promise<PromoExecutionLedgerV2[]> {
    const ids = Array.from(new Set(crewMemberIds.filter(Boolean)));
    if (ids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoExecutionLedgerV2)
      .where(and(
        inArray(promoExecutionLedgerV2.crewMemberId, ids),
        eq(promoExecutionLedgerV2.isDeleted, false),
      ))
      .orderBy(asc(promoExecutionLedgerV2.effectiveDate));
  }

  async create(data: Omit<InsertPromoExecutionLedgerV2, "ledgerUuid">): Promise<PromoExecutionLedgerV2> {
    const db = getDb();
    const rows = await db
      .insert(promoExecutionLedgerV2)
      .values({ ...data, ledgerUuid: uuidv4() })
      .returning();
    return rows[0];
  }
}
