// What Rest Hours needs after rows from the other side are applied (P3-3, D3).
// Kept apart from the service so the service has no dependency on Rest Hours code
// and unit tests need no database.
//
// 1. Recompute. Totals and conflict counters are derived on each side and never
//    synced (derivedTables.ts), so after the ship's hours land on the office the
//    office recomputes that vessel and month.
// 2. Reopen (decision D3, 26 Nov 2026). If the ship's late hours change a month the
//    office has locked, the hours are kept and the month is reopened for review:
//    is_locked = false and office_review_status = 'Due'. This is a new office-side
//    change, so it goes through the repository and IS captured: it syncs back to
//    the ship as the office's own edit.

import { getDb } from "../db";
import { VesselRecordsRepository } from "../rest-hours/repositories/vesselRecordsRepository";
import { dailyRecordsService } from "../rest-hours/services/dailyRecordsService";
import { RH_HOURS_TABLES, RH_RECOMPUTE_TABLES } from "./fieldOwnership";
import type { ChangedMonth, PostApplyResult } from "./syncService";

const vesselRecords = new VesselRecordsRepository();

// Locked month -> open again. Returns true only when it was locked.
export async function reopenLockedMonth(vesselId: string, monthValue: string): Promise<boolean> {
  return getDb().transaction(async (tx: any) => {
    const [record] = await vesselRecords.findAll({ vesselId, monthValue }, tx);
    if (!record || !record.isLocked) return false;
    await vesselRecords.update(
      record.rhVesselUuid,
      { isLocked: false, officeReviewStatus: "Due", officeReviewSubmittedDate: null, updatedByUuid: null } as any,
      tx,
    );
    return true;
  });
}

export async function rhPostApply(months: ChangedMonth[]): Promise<PostApplyResult> {
  const result: PostApplyResult = { recomputed: 0, recomputeFailed: [], reopened: 0 };
  const unique = (filter: (t: string) => boolean) =>
    [...new Map(months.filter((m) => filter(m.table)).map((m) => [`${m.vesselId}|${m.month}`, m])).values()];

  for (const m of unique((t) => RH_RECOMPUTE_TABLES.has(t))) {
    try {
      await dailyRecordsService.resyncVesselMonth(m.vesselId, m.month, null);
      result.recomputed++;
    } catch (err: any) {
      // Totals stay stale until the next change of that month; the data is safe.
      result.recomputeFailed.push({ vesselId: m.vesselId, month: m.month, error: String(err?.message ?? err) });
      console.error(`[Sync] recompute failed for ${m.vesselId} ${m.month}:`, err?.message ?? err);
    }
  }
  for (const m of unique((t) => RH_HOURS_TABLES.has(t))) {
    if (await reopenLockedMonth(m.vesselId, m.month)) result.reopened++;
  }
  return result;
}
