import { eq, and, inArray, notInArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoCesTestsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoCesTestV2 } from "../../../../shared/v2/promotions/types";
import { keyField, syncChildRows, textField, type ChildTableConfig } from "../../appraisals/repositories/childRowSync";
import { promoRowUuid, type PromoSectionChanges } from "../../../../shared/v2/promotions/promotionChanges";

// A2.7 CES tests: one row per test position (testId) per review. The uuid is
// worked out from the review and the position, so ship and office save the
// same row (PRD-02).
export const CES_TEST_ROWS: ChildTableConfig = {
  table: promoCesTestsV2,
  uuidKey: "ctUuid",
  parentKey: "reviewUuid",
  parentLabel: "promotion review",
  fields: [
    keyField("testId"),
    textField("description"),
    textField("date"),
    textField("minScore"),
    textField("score"),
    textField("result"),
  ],
  matchKey: ["testId"],
  uuidFor: (row, reviewUuid) => promoRowUuid(reviewUuid, "cesTests", String(row.testId)),
  revive: true,
};

export class CesTestsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoCesTestV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoCesTestsV2)
      .where(and(eq(promoCesTestsV2.reviewUuid, reviewUuid), eq(promoCesTestsV2.isDeleted, false)))
      .orderBy(promoCesTestsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoCesTestV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoCesTestsV2)
      .where(and(inArray(promoCesTestsV2.reviewUuid, reviewUuids), eq(promoCesTestsV2.isDeleted, false)))
      .orderBy(promoCesTestsV2.sortOrder);
  }

  // Saves the CES rows of one change set: rows matched by uuid (or test
  // position), only the sent fields written, only the listed rows deleted.
  async applyChanges(reviewUuid: string, changes: PromoSectionChanges, auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    return syncChildRows(executor, CES_TEST_ROWS, reviewUuid, changes, "patch", auditUserUuid);
  }
}
