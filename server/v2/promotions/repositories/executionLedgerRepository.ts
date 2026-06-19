import { eq, and } from "drizzle-orm";
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

  async create(data: Omit<InsertPromoExecutionLedgerV2, "ledgerUuid">): Promise<PromoExecutionLedgerV2> {
    const db = getDb();
    const rows = await db
      .insert(promoExecutionLedgerV2)
      .values({ ...data, ledgerUuid: uuidv4() })
      .returning();
    return rows[0];
  }
}
