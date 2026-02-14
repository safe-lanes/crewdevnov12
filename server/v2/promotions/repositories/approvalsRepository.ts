import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoApprovalsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoApprovalV2, InsertPromoApprovalV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class ApprovalsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoApprovalV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoApprovalsV2)
      .where(and(eq(promoApprovalsV2.reviewUuid, reviewUuid), eq(promoApprovalsV2.isDeleted, false)))
      .orderBy(promoApprovalsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoApprovalV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoApprovalsV2)
      .where(and(inArray(promoApprovalsV2.reviewUuid, reviewUuids), eq(promoApprovalsV2.isDeleted, false)))
      .orderBy(promoApprovalsV2.sortOrder);
  }

  async create(data: Omit<InsertPromoApprovalV2, "apUuid">): Promise<PromoApprovalV2> {
    const db = getDb();
    const results = await db
      .insert(promoApprovalsV2)
      .values({ ...data, apUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async replaceForReview(reviewUuid: string, approvals: Omit<InsertPromoApprovalV2, "apUuid" | "reviewUuid">[]): Promise<PromoApprovalV2[]> {
    const db = getDb();
    await db
      .update(promoApprovalsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoApprovalsV2.reviewUuid, reviewUuid), eq(promoApprovalsV2.isDeleted, false)));
    if (approvals.length === 0) return [];
    const results = await db
      .insert(promoApprovalsV2)
      .values(approvals.map((a, i) => ({ ...a, apUuid: uuidv4(), reviewUuid, sortOrder: i })))
      .returning();
    return results;
  }
}
