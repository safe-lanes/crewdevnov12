import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoChecklistCommentsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoChecklistCommentV2 } from "../../../../shared/v2/promotions/types";
import { syncChildRows, type ChildTableConfig } from "../../appraisals/repositories/childRowSync";
import type { PromoSectionChanges } from "../../../../shared/v2/promotions/promotionChanges";

// Comments of a checklist point (PRD-14). A verification leaves an empty-text
// comment linked to it by verification_uuid, which never changes.
export const CHECKLIST_COMMENT_ROWS: ChildTableConfig = {
  table: promoChecklistCommentsV2,
  uuidKey: "cmUuid",
  parentKey: "checklistProgressUuid",
  parentLabel: "checklist point",
  fields: [
    { column: "verificationUuid", from: ["verificationId"], normalize: (row) => row.verificationId || null, setOnce: true },
    { column: "commentUser", from: ["userName"], normalize: (row) => row.userName || null },
    { column: "commentRank", from: ["rank"], normalize: (row) => row.rank || null },
    { column: "commentText", from: ["text"], normalize: (row) => row.text || null },
    { column: "date", from: ["date"], normalize: (row) => row.date || null },
  ],
};

export class ChecklistCommentsRepository {
  async findByProgressUuids(progressUuids: string[], executor: any = getDb()): Promise<PromoChecklistCommentV2[]> {
    if (progressUuids.length === 0) return [];
    return executor
      .select()
      .from(promoChecklistCommentsV2)
      .where(and(
        inArray(promoChecklistCommentsV2.checklistProgressUuid, progressUuids),
        eq(promoChecklistCommentsV2.isDeleted, false),
      ))
      .orderBy(promoChecklistCommentsV2.sortOrder, promoChecklistCommentsV2.id);
  }

  // Saves the comments of one point: rows matched by uuid, only the sent fields
  // written, only the listed rows deleted.
  async applyChanges(progressUuid: string, changes: PromoSectionChanges, auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    return syncChildRows(executor, CHECKLIST_COMMENT_ROWS, progressUuid, changes, "patch", auditUserUuid);
  }
}
