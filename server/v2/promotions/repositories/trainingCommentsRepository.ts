import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoTrainingCommentsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoTrainingCommentV2 } from "../../../../shared/v2/promotions/types";
import { captureChange } from "../../sync/changeCapture";
import { syncChildRows, textField, type ChildTableConfig } from "../../appraisals/repositories/childRowSync";
import type { PromoSectionChanges } from "../../../../shared/v2/promotions/promotionChanges";

// Comments on an A3 training row: rows the user adds, each with a uuid made by
// the browser (PRD-02). training_row_id holds the training's tn_uuid
// (migration 0275); a comment never moves to another training.
export const TRAINING_COMMENT_ROWS: ChildTableConfig = {
  table: promoTrainingCommentsV2,
  uuidKey: "tcUuid",
  parentKey: "reviewUuid",
  parentLabel: "promotion review",
  fields: [
    { column: "trainingRowId", from: ["trainingUuid"], normalize: (row) => row.trainingUuid || null, setOnce: true },
    { column: "commentUser", from: ["user"], normalize: (row) => row.user || null },
    { column: "commentText", from: ["text"], normalize: (row) => row.text || null },
  ],
};

export class TrainingCommentsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoTrainingCommentV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoTrainingCommentsV2)
      .where(and(eq(promoTrainingCommentsV2.reviewUuid, reviewUuid), eq(promoTrainingCommentsV2.isDeleted, false)))
      .orderBy(promoTrainingCommentsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoTrainingCommentV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoTrainingCommentsV2)
      .where(and(inArray(promoTrainingCommentsV2.reviewUuid, reviewUuids), eq(promoTrainingCommentsV2.isDeleted, false)))
      .orderBy(promoTrainingCommentsV2.sortOrder);
  }

  // Saves the training comments of one change set: rows matched by uuid, only
  // the sent fields written, only the listed rows deleted.
  async applyChanges(reviewUuid: string, changes: PromoSectionChanges, auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    return syncChildRows(executor, TRAINING_COMMENT_ROWS, reviewUuid, changes, "patch", auditUserUuid);
  }

  // Soft-deletes the live comments of training rows that were deleted, so no
  // comment is left without its training (also ones another session added).
  // Each deleted row is reported to the sync change capture (PRD-07).
  async softDeleteForTrainings(reviewUuid: string, trainingUuids: string[], auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    if (trainingUuids.length === 0) return 0;
    const live: PromoTrainingCommentV2[] = await executor
      .select()
      .from(promoTrainingCommentsV2)
      .where(and(
        eq(promoTrainingCommentsV2.reviewUuid, reviewUuid),
        inArray(promoTrainingCommentsV2.trainingRowId, trainingUuids),
        eq(promoTrainingCommentsV2.isDeleted, false),
      ));
    const now = new Date();
    for (const old of live) {
      const [row] = await executor
        .update(promoTrainingCommentsV2)
        .set({ isDeleted: true, updatedAt: now, ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}) })
        .where(eq(promoTrainingCommentsV2.id, old.id))
        .returning();
      await captureChange(executor, { table: promoTrainingCommentsV2, rowUuid: old.tcUuid, oldRow: old, newRow: row, actorUuid: auditUserUuid });
    }
    return live.length;
  }
}
