import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoChecklistVerificationsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoChecklistVerificationV2 } from "../../../../shared/v2/promotions/types";
import { syncChildRows, type ChildTableConfig } from "../../appraisals/repositories/childRowSync";
import type { PromoSectionChanges } from "../../../../shared/v2/promotions/promotionChanges";

// Verifications of a checklist point (PRD-14): rows the user adds, each with a
// uuid made by the browser. The parent is the point's row, not the review.
export const CHECKLIST_VERIFICATION_ROWS: ChildTableConfig = {
  table: promoChecklistVerificationsV2,
  uuidKey: "cvUuid",
  parentKey: "checklistProgressUuid",
  parentLabel: "checklist point",
  fields: [
    { column: "verifierName", from: ["verifierName"], normalize: (row) => row.verifierName || null },
    { column: "verifierRank", from: ["rank"], normalize: (row) => row.rank || null },
    { column: "date", from: ["date"], normalize: (row) => row.date || null },
  ],
};

export class ChecklistVerificationsRepository {
  async findByProgressUuids(progressUuids: string[], executor: any = getDb()): Promise<PromoChecklistVerificationV2[]> {
    if (progressUuids.length === 0) return [];
    return executor
      .select()
      .from(promoChecklistVerificationsV2)
      .where(and(
        inArray(promoChecklistVerificationsV2.checklistProgressUuid, progressUuids),
        eq(promoChecklistVerificationsV2.isDeleted, false),
      ))
      .orderBy(promoChecklistVerificationsV2.sortOrder, promoChecklistVerificationsV2.id);
  }

  // Saves the verifications of one point: rows matched by uuid, only the sent
  // fields written, only the listed rows deleted.
  async applyChanges(progressUuid: string, changes: PromoSectionChanges, auditUserUuid: string | null = null, executor: any = getDb()): Promise<number> {
    return syncChildRows(executor, CHECKLIST_VERIFICATION_ROWS, progressUuid, changes, "patch", auditUserUuid);
  }
}
