import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoTrainingNeedsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoTrainingNeedV2, InsertPromoTrainingNeedV2 } from "../../../../shared/v2/promotions/types";
import { captureChange } from "../../sync/changeCapture";
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

  // Saves the training rows of one change set: rows matched by uuid, only the
  // sent fields written, only the listed rows deleted.
  async applyChanges(reviewUuid: string, changes: PromoSectionChanges, auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    return syncChildRows(executor, TRAINING_NEED_ROWS, reviewUuid, changes, "patch", auditUserUuid);
  }

  // The Training Needs page's edit of one live row (status, completion date,
  // "corresponding in DB"). Returns the row, or null when it is missing or
  // deleted. Nothing is written when no field was sent, so updated_at stays.
  // The written row is reported to the sync change capture (PRD-07).
  async patchLive(
    tnUuid: string,
    sets: Pick<Partial<InsertPromoTrainingNeedV2>, "status" | "completionDate" | "correspondingInDb">,
    auditUserUuid: string | null = null,
    executor: any = getDb(),
  ): Promise<PromoTrainingNeedV2 | null> {
    const [old] = await executor
      .select()
      .from(promoTrainingNeedsV2)
      .where(and(eq(promoTrainingNeedsV2.tnUuid, tnUuid), eq(promoTrainingNeedsV2.isDeleted, false)))
      .limit(1);
    if (!old) return null;
    if (Object.keys(sets).length === 0) return old;
    const [row] = await executor
      .update(promoTrainingNeedsV2)
      .set({ ...sets, updatedAt: new Date(), ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}) })
      .where(eq(promoTrainingNeedsV2.id, old.id))
      .returning();
    await captureChange(executor, { table: promoTrainingNeedsV2, rowUuid: tnUuid, oldRow: old, newRow: row, actorUuid: auditUserUuid });
    return row ?? null;
  }
}
