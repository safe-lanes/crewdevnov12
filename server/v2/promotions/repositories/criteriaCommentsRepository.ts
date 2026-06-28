import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoCriteriaCommentsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoCriteriaCommentV2, InsertPromoCriteriaCommentV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class CriteriaCommentsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoCriteriaCommentV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoCriteriaCommentsV2)
      .where(and(eq(promoCriteriaCommentsV2.reviewUuid, reviewUuid), eq(promoCriteriaCommentsV2.isDeleted, false)))
      .orderBy(promoCriteriaCommentsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoCriteriaCommentV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoCriteriaCommentsV2)
      .where(and(inArray(promoCriteriaCommentsV2.reviewUuid, reviewUuids), eq(promoCriteriaCommentsV2.isDeleted, false)))
      .orderBy(promoCriteriaCommentsV2.sortOrder);
  }

  async create(data: Omit<InsertPromoCriteriaCommentV2, "ccUuid">): Promise<PromoCriteriaCommentV2> {
    const db = getDb();
    const results = await db
      .insert(promoCriteriaCommentsV2)
      .values({ ...data, ccUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async replaceForReview(reviewUuid: string, comments: Omit<InsertPromoCriteriaCommentV2, "ccUuid" | "reviewUuid">[], auditUserUuid: string | null = null): Promise<PromoCriteriaCommentV2[]> {
    const db = getDb();
    const existing = await db
      .select()
      .from(promoCriteriaCommentsV2)
      .where(and(eq(promoCriteriaCommentsV2.reviewUuid, reviewUuid), eq(promoCriteriaCommentsV2.isDeleted, false)));

    if (comments.length === 0) {
      if (existing.length > 0) {
        await db
          .update(promoCriteriaCommentsV2)
          .set({ isDeleted: true, updatedAt: new Date(), updatedByUuid: auditUserUuid })
          .where(and(eq(promoCriteriaCommentsV2.reviewUuid, reviewUuid), eq(promoCriteriaCommentsV2.isDeleted, false)));
      }
      return [];
    }

    const results: PromoCriteriaCommentV2[] = [];
    const usedExistingIds: number[] = [];

    for (let i = 0; i < comments.length; i++) {
      const c = comments[i];
      const match = existing.find(e =>
        e.criteriaCode === c.criteriaCode &&
        e.commentId === c.commentId &&
        !usedExistingIds.includes(e.id)
      );

      if (match) {
        usedExistingIds.push(match.id);
        const updated = await db
          .update(promoCriteriaCommentsV2)
          .set({ commentUser: c.commentUser, commentText: c.commentText, sortOrder: i, updatedAt: new Date(), updatedByUuid: auditUserUuid })
          .where(eq(promoCriteriaCommentsV2.id, match.id))
          .returning();
        results.push(updated[0]);
      } else {
        const inserted = await db
          .insert(promoCriteriaCommentsV2)
          .values({ ...c, ccUuid: uuidv4(), reviewUuid, sortOrder: i, createdByUuid: auditUserUuid, updatedByUuid: auditUserUuid })
          .returning();
        results.push(inserted[0]);
      }
    }

    const unusedIds = existing.filter(e => !usedExistingIds.includes(e.id)).map(e => e.id);
    if (unusedIds.length > 0) {
      await db
        .update(promoCriteriaCommentsV2)
        .set({ isDeleted: true, updatedAt: new Date(), updatedByUuid: auditUserUuid })
        .where(inArray(promoCriteriaCommentsV2.id, unusedIds));
    }

    return results;
  }
}
