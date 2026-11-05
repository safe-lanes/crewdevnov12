import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoTrainingNeedsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoTrainingNeedV2, InsertPromoTrainingNeedV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { syncChildRows, textField, type ChildTableConfig } from "../../appraisals/repositories/childRowSync";
import type { PromoSectionChanges } from "../../../../shared/v2/promotions/promotionChanges";

// A3 training needs: rows the user adds, each with a uuid made by the browser
// when the row is added (PRD-02).
export const TRAINING_NEED_ROWS: ChildTableConfig = {
  table: promoTrainingNeedsV2,
  uuidKey: "tnUuid",
  parentKey: "reviewUuid",
  parentLabel: "promotion review",
  fields: [
    textField("training"),
    { column: "correspondingInDb", from: ["correspondingInDB"], normalize: (row) => row.correspondingInDB || null },
    textField("identifiedByUuid"),
    textField("category"),
    textField("status"),
    textField("completionDate"),
  ],
};

export class TrainingNeedsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoTrainingNeedV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoTrainingNeedsV2)
      .where(and(eq(promoTrainingNeedsV2.reviewUuid, reviewUuid), eq(promoTrainingNeedsV2.isDeleted, false)))
      .orderBy(promoTrainingNeedsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoTrainingNeedV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoTrainingNeedsV2)
      .where(and(inArray(promoTrainingNeedsV2.reviewUuid, reviewUuids), eq(promoTrainingNeedsV2.isDeleted, false)))
      .orderBy(promoTrainingNeedsV2.sortOrder);
  }

  async create(data: Omit<InsertPromoTrainingNeedV2, "tnUuid">): Promise<PromoTrainingNeedV2> {
    const db = getDb();
    const results = await db
      .insert(promoTrainingNeedsV2)
      .values({ ...data, tnUuid: uuidv4() })
      .returning();
    return results[0];
  }

  // Saves the training rows of one change set: rows matched by uuid, only the
  // sent fields written, only the listed rows deleted.
  async applyChanges(reviewUuid: string, changes: PromoSectionChanges, auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    return syncChildRows(executor, TRAINING_NEED_ROWS, reviewUuid, changes, "patch", auditUserUuid);
  }
}
