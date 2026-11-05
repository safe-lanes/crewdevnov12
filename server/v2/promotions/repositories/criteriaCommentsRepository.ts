import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoCriteriaCommentsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoCriteriaCommentV2, InsertPromoCriteriaCommentV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { syncChildRows, textField, type ChildTableConfig } from "../../appraisals/repositories/childRowSync";
import type { PromoSectionChanges } from "../../../../shared/v2/promotions/promotionChanges";

// Comments per criteria code (A4, A2.x, A2.7 CES tests): rows the user adds,
// each with a uuid made by the browser (PRD-02). A comment never moves to
// another criteria code.
export const CRITERIA_COMMENT_ROWS: ChildTableConfig = {
  table: promoCriteriaCommentsV2,
  uuidKey: "ccUuid",
  parentKey: "reviewUuid",
  parentLabel: "promotion review",
  fields: [
    { ...textField("criteriaCode"), setOnce: true },
    { column: "commentUser", from: ["user"], normalize: (row) => row.user || null },
    { column: "commentText", from: ["text"], normalize: (row) => row.text || null },
  ],
};

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

  // Saves the criteria comments of one change set: rows matched by uuid, only
  // the sent fields written, only the listed rows deleted.
  async applyChanges(reviewUuid: string, changes: PromoSectionChanges, auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    return syncChildRows(executor, CRITERIA_COMMENT_ROWS, reviewUuid, changes, "patch", auditUserUuid);
  }
}
