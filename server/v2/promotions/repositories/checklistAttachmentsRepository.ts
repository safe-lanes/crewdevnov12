import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { promoChecklistAttachmentsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoChecklistAttachmentV2, InsertPromoChecklistAttachmentV2 } from "../../../../shared/v2/promotions/types";
import { captureChange } from "../../sync/changeCapture";

// Checklist attachment rows. The files themselves are written to disk by the
// service before the row (see PRD-08). Every written row is reported to the
// sync change capture on the same executor (PRD-07).
export class ChecklistAttachmentsRepository {
  // `executor` is a transaction (tx) or the default connection.
  async findLiveByProgressUuid(checklistProgressUuid: string, executor: any = getDb()): Promise<PromoChecklistAttachmentV2[]> {
    return executor
      .select()
      .from(promoChecklistAttachmentsV2)
      .where(and(
        eq(promoChecklistAttachmentsV2.checklistProgressUuid, checklistProgressUuid),
        eq(promoChecklistAttachmentsV2.isDeleted, false),
      ));
  }

  // Inserts the row unless its att_uuid is already stored (a retried save).
  // Returns the new row, or null when nothing was written.
  async insertIfAbsent(data: InsertPromoChecklistAttachmentV2, executor: any = getDb()): Promise<PromoChecklistAttachmentV2 | null> {
    const rows = await executor
      .insert(promoChecklistAttachmentsV2)
      .values(data)
      .onConflictDoNothing()
      .returning();
    const row = rows[0] ?? null;
    if (row) {
      await captureChange(executor, { table: promoChecklistAttachmentsV2, rowUuid: row.attUuid, oldRow: null, newRow: row, actorUuid: data.createdByUuid ?? null });
    }
    return row;
  }

  // Soft-deletes the given live rows one by one, so each deletion is captured
  // with its own row.
  async softDeleteRows(rows: PromoChecklistAttachmentV2[], auditUserUuid: string | null = null, executor: any = getDb()): Promise<void> {
    const now = new Date();
    for (const old of rows) {
      const [row] = await executor
        .update(promoChecklistAttachmentsV2)
        .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid })
        .where(eq(promoChecklistAttachmentsV2.id, old.id))
        .returning();
      await captureChange(executor, { table: promoChecklistAttachmentsV2, rowUuid: old.attUuid, oldRow: old, newRow: row, actorUuid: auditUserUuid });
    }
  }
}
