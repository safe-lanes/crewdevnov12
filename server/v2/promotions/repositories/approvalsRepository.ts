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

  async replaceForReview(
    reviewUuid: string,
    approvals: Omit<InsertPromoApprovalV2, "apUuid" | "reviewUuid">[],
    scope: 'all' | 'approvals' | 'selected' = 'all',
  ): Promise<PromoApprovalV2[]> {
    const db = getDb();
    const allRows = await db
      .select()
      .from(promoApprovalsV2)
      .where(eq(promoApprovalsV2.reviewUuid, reviewUuid));

    const inScope = (r: PromoApprovalV2) => {
      if (scope === 'all') return true;
      if (scope === 'approvals') return !r.isSelectedForSubmission;
      return !!r.isSelectedForSubmission;
    };

    const existing = allRows.filter((e: PromoApprovalV2) => !e.isDeleted && inScope(e));
    const softDeleted = allRows.filter((e: PromoApprovalV2) => e.isDeleted && inScope(e));

    const softDeleteScoped = async (ids: number[]) => {
      if (ids.length === 0) return;
      await db
        .update(promoApprovalsV2)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(inArray(promoApprovalsV2.id, ids));
    };

    if (approvals.length === 0) {
      await softDeleteScoped(existing.map((e: PromoApprovalV2) => e.id));
      return [];
    }

    const matchRow = (a: any, candidates: PromoApprovalV2[], usedIds: number[]): PromoApprovalV2 | undefined => {
      return candidates.find((e: PromoApprovalV2) => {
        if (usedIds.includes(e.id)) return false;
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
    };

    const results: PromoApprovalV2[] = [];
    const usedExistingIds: number[] = [];

    for (let i = 0; i < approvals.length; i++) {
      const a = approvals[i];
      let match = matchRow(a, existing, usedExistingIds);

      if (!match) {
        match = softDeleted.find((e: PromoApprovalV2) => {
          if (usedExistingIds.includes(e.id)) return false;
          if (a.approverId && e.approverId) return e.approverId === a.approverId;
          if (a.approver && e.approver) return e.approver === a.approver;
          return false;
        });
      }

      if (match) {
        usedExistingIds.push(match.id);
        // Use `=== undefined` (not `??`) so explicit empty strings clear fields,
        // while truly omitted props fall back to the existing value.
        const pick = <T>(incoming: T | undefined, existing: T): T =>
          incoming === undefined ? existing : incoming;
        const updated = await db
          .update(promoApprovalsV2)
          .set({
            approverId: pick(a.approverId, match.approverId),
            date: pick(a.date, match.date),
            approver: pick(a.approver, match.approver),
            status: pick(a.status, match.status),
            approval: pick(a.approval, match.approval),
            comments: pick(a.comments, match.comments),
            isFromPartA: pick(a.isFromPartA, match.isFromPartA),
            isSelectedForSubmission: pick(a.isSelectedForSubmission, match.isSelectedForSubmission),
            sortOrder: i,
            isDeleted: false,
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

    const unusedActiveIds = existing
      .filter((e: PromoApprovalV2) => !usedExistingIds.includes(e.id))
      .map((e: PromoApprovalV2) => e.id);
    await softDeleteScoped(unusedActiveIds);

    return results;
  }
}
