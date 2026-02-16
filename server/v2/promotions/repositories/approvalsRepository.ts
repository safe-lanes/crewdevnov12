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
    const existing = await db
      .select()
      .from(promoApprovalsV2)
      .where(and(eq(promoApprovalsV2.reviewUuid, reviewUuid), eq(promoApprovalsV2.isDeleted, false)));

    if (approvals.length === 0) {
      if (existing.length > 0) {
        await db
          .update(promoApprovalsV2)
          .set({ isDeleted: true, updatedAt: new Date() })
          .where(and(eq(promoApprovalsV2.reviewUuid, reviewUuid), eq(promoApprovalsV2.isDeleted, false)));
      }
      return [];
    }

    const results: PromoApprovalV2[] = [];
    const usedExistingIds: number[] = [];

    for (let i = 0; i < approvals.length; i++) {
      const a = approvals[i];
      const match = existing.find(e => {
        if (usedExistingIds.includes(e.id)) return false;
        if (a.isSelectedForSubmission && e.isSelectedForSubmission) {
          if (a.approverId && e.approverId) return e.approverId === a.approverId;
          return e.approver === a.approver;
        }
        if (!a.isSelectedForSubmission && !e.isSelectedForSubmission) {
          if (a.approverId && e.approverId) return e.approverId === a.approverId;
          if (a.approver && e.approver) return e.approver === a.approver;
        }
        return false;
      });

      if (match) {
        usedExistingIds.push(match.id);
        const updated = await db
          .update(promoApprovalsV2)
          .set({
            approverId: a.approverId ?? match.approverId,
            date: a.date ?? match.date,
            approver: a.approver ?? match.approver,
            status: a.status ?? match.status,
            approval: a.approval ?? match.approval,
            comments: a.comments ?? match.comments,
            isFromPartA: a.isFromPartA ?? match.isFromPartA,
            isSelectedForSubmission: a.isSelectedForSubmission ?? match.isSelectedForSubmission,
            sortOrder: i,
            updatedAt: new Date(),
          })
          .where(eq(promoApprovalsV2.id, match.id))
          .returning();
        results.push(updated[0]);
      } else {
        const inserted = await db
          .insert(promoApprovalsV2)
          .values({ ...a, apUuid: uuidv4(), reviewUuid, sortOrder: i })
          .returning();
        results.push(inserted[0]);
      }
    }

    const unusedIds = existing.filter(e => !usedExistingIds.includes(e.id)).map(e => e.id);
    if (unusedIds.length > 0) {
      await db
        .update(promoApprovalsV2)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(inArray(promoApprovalsV2.id, unusedIds));
    }

    return results;
  }
}
