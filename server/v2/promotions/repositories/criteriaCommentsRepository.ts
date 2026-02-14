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

  async replaceForReview(reviewUuid: string, comments: Omit<InsertPromoCriteriaCommentV2, "ccUuid" | "reviewUuid">[]): Promise<PromoCriteriaCommentV2[]> {
    const db = getDb();
    await db
      .update(promoCriteriaCommentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoCriteriaCommentsV2.reviewUuid, reviewUuid), eq(promoCriteriaCommentsV2.isDeleted, false)));
    if (comments.length === 0) return [];
    const results = await db
      .insert(promoCriteriaCommentsV2)
      .values(comments.map((c, i) => ({ ...c, ccUuid: uuidv4(), reviewUuid, sortOrder: i })))
      .returning();
    return results;
  }
}
