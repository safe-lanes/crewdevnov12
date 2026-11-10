import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { promoExecutionLedgerV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoExecutionLedgerV2, InsertPromoExecutionLedgerV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { captureChange } from "../../sync/changeCapture";

export class ExecutionLedgerRepository {
  // `executor` is a transaction (tx) or the default connection.
  async findByReviewUuid(reviewUuid: string, executor: any = getDb()): Promise<PromoExecutionLedgerV2 | null> {
    const rows = await executor
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

  // Records an executed promotion, at most once per review: when a ledger row
  // for the review exists (unique review_uuid), nothing is written and null is
  // returned. A new row is reported to the sync change capture on the same
  // executor (PRD-07); the actor is applied_by.
  async insertIfAbsent(data: Omit<InsertPromoExecutionLedgerV2, "ledgerUuid">, executor: any = getDb()): Promise<PromoExecutionLedgerV2 | null> {
    const rows = await executor
      .insert(promoExecutionLedgerV2)
      .values({ ...data, ledgerUuid: uuidv4() })
      .onConflictDoNothing({ target: promoExecutionLedgerV2.reviewUuid })
      .returning();
    const row = rows[0] ?? null;
    if (row) {
      await captureChange(executor, { table: promoExecutionLedgerV2, rowUuid: row.ledgerUuid, oldRow: null, newRow: row, actorUuid: data.appliedByUuid ?? null });
    }
    return row;
  }
}
