import { DailyRecordsRepository, FixedTasksRepository } from "../repositories";
import { dailyRecordsService } from "./dailyRecordsService";

const dailyRecordsRepository = new DailyRecordsRepository();
const fixedTasksRepository = new FixedTasksRepository();

export type RhSplitStatus =
  | "split"
  | "skipped-invalid-input"
  | "skipped-no-rank-change"
  | "skipped-first-of-month"
  | "skipped-no-vessel"
  | "skipped-already-split"
  | "skipped-no-record";

export interface RhSplitParams {
  /** Crew UUID — used to resolve the crew's current vessel assignment. */
  crewUuid: string;
  /** Employee number — the crew identifier RH records key on (crew_member_id). */
  empNo: string;
  newRank: string;
  oldRank: string;
  /** Effective date of the promotion, "YYYY-MM-DD". */
  splitDate: string;
  auditUserUuid?: string | null;
}

export interface RhSplitResult {
  status: RhSplitStatus;
  /** UUID of the newly created new-rank daily record, when a split occurred. */
  newDailyUuid?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dayOf(dateStr: string | null | undefined, fallback: number): number {
  if (!dateStr || !ISO_DATE.test(dateStr)) return fallback;
  return parseInt(dateStr.split("-")[2], 10);
}

/**
 * Rest Hours counterpart to the sea-service promotion split.
 *
 * When a crew member is promoted mid-month, the month's recorded rest hours
 * belong partly to the old rank and partly to the new rank. This closes the
 * existing record's applicability window at split-date−1 and opens a new
 * new-rank record from the split date to month-end (copying the recorded data
 * so nothing is lost — out-of-window days simply render as N/A per record).
 *
 * Design guarantees (mirroring crewSeaServiceService.splitForPromotion):
 *  - Idempotent: a new-rank record already covering the split is a safe no-op.
 *  - Forward-only: if nothing was recorded yet there is no record to split, so
 *    later recording is created directly under the (already flipped) new rank.
 *  - Multi-promotion: closes whichever record currently covers the split date,
 *    so several promotions in one month chain contiguously without gaps.
 *  - Non-fatal at the call site: the caller wraps this in try/catch; the rank
 *    flip + ledger row are the atomic core and are never rolled back here.
 */
export const rhPromotionService = {
  async splitForPromotion(params: RhSplitParams): Promise<RhSplitResult> {
    const { crewUuid, empNo, newRank, oldRank, splitDate, auditUserUuid } = params;

    if (!empNo || !crewUuid || !ISO_DATE.test(splitDate || "")) {
      return { status: "skipped-invalid-input" };
    }
    if (!newRank || !oldRank || newRank === oldRank) {
      return { status: "skipped-no-rank-change" };
    }

    const monthYear = splitDate.slice(0, 7);
    const [year, month] = monthYear.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const effDay = parseInt(splitDate.split("-")[2], 10);

    // Promotion on the 1st ⇒ the whole month is the new rank; nothing to split.
    if (effDay <= 1) {
      return { status: "skipped-first-of-month" };
    }

    const monthStart = `${monthYear}-01`;
    const monthEnd = `${monthYear}-${pad(daysInMonth)}`;
    const dayBeforeSplit = `${monthYear}-${pad(effDay - 1)}`;

    // Resolve the crew's current vessel (RH records key on vessel uuid).
    const { crewAssignmentsService } = await import(
      "../../crew-pool/services/crewAssignmentsService"
    );
    const current = await crewAssignmentsService.getCurrent(crewUuid);
    const vesselId = current?.vesselUuid;
    if (!vesselId) {
      return { status: "skipped-no-vessel" };
    }

    const dailyRecords = await dailyRecordsRepository.findAllByKey(empNo, vesselId, monthYear);

    // True when a record's applicability window covers the split day.
    const covers = (r: { applicableFrom?: string | null; applicableTo?: string | null }) => {
      const from = dayOf(r.applicableFrom, 1);
      const to = dayOf(r.applicableTo, daysInMonth);
      return effDay >= from && effDay <= to;
    };

    // Idempotency: only skip when a new-rank record already covers the split
    // date. A new-rank record that exists but does NOT cover splitDate (e.g. a
    // stale/partial window, or a later promotion of the same rank chain) must
    // still be split, so checking rank alone here would wrongly skip it.
    if (dailyRecords.some((r) => r.rank === newRank && covers(r))) {
      return { status: "skipped-already-split" };
    }

    // Find the record currently covering the split date (prefer the old rank).
    const previous =
      dailyRecords.find((r) => r.rank === oldRank && covers(r)) ||
      dailyRecords.find((r) => covers(r)) ||
      dailyRecords[dailyRecords.length - 1];

    // Nothing recorded yet ⇒ no record to split. Later recording is created
    // directly under the already-flipped new rank, so this is correct.
    if (!previous) {
      return { status: "skipped-no-record" };
    }

    const prevTo = previous.applicableTo || monthEnd;
    const prevFrom = previous.applicableFrom || monthStart;

    // 1. Close the previous record's window at split-date−1.
    await dailyRecordsRepository.update(previous.rhDailyUuid, {
      applicableFrom: prevFrom,
      applicableTo: dayBeforeSplit,
      updatedByUuid: auditUserUuid ?? null,
    });

    // 2. Open a new new-rank record from the split date to the previous end,
    //    copying the recorded data (out-of-window days render as N/A).
    const created = await dailyRecordsRepository.create({
      crewMemberId: empNo,
      vesselId,
      rank: newRank,
      name: previous.name,
      monthYear,
      dailyRecords: previous.dailyRecords,
      showPlanning: previous.showPlanning ?? false,
      opaMode: previous.opaMode ?? false,
      watchkeeper: previous.watchkeeper ?? false,
      applicableFrom: splitDate,
      applicableTo: prevTo,
      createdByUuid: auditUserUuid ?? null,
      updatedByUuid: auditUserUuid ?? null,
    });

    // 3. Split fixed tasks too: lock the old-rank row at split-date−1 and open a
    //    blank new-rank template for the new period. Only act when an old-rank
    //    fixed-task row exists (otherwise recording creates it lazily).
    try {
      const fixedTasks = await fixedTasksRepository.findAllByKey(empNo, vesselId, monthYear);
      const alreadySplitFixed = fixedTasks.some((t) => t.rank === newRank && covers(t));
      if (!alreadySplitFixed) {
        const prevFixed =
          fixedTasks.find((t) => t.rank === oldRank && covers(t)) ||
          fixedTasks.find((t) => covers(t)) ||
          fixedTasks[fixedTasks.length - 1];
        if (prevFixed) {
          const blankTemplate = JSON.stringify(Array(48).fill(""));
          await fixedTasksRepository.update(prevFixed.fixedTaskUuid, {
            applicableFrom: prevFixed.applicableFrom || monthStart,
            applicableTo: dayBeforeSplit,
            isLocked: true,
            updatedByUuid: auditUserUuid ?? null,
          });
          await fixedTasksRepository.create({
            crewMemberId: empNo,
            vesselId,
            rank: newRank,
            name: prevFixed.name,
            monthYear,
            seaHours: blankTemplate,
            portHours: blankTemplate,
            applicableFrom: splitDate,
            applicableTo: prevFixed.applicableTo || monthEnd,
            isLocked: false,
            createdByUuid: auditUserUuid ?? null,
            updatedByUuid: auditUserUuid ?? null,
          });
        }
      }
    } catch (err) {
      // Fixed-task split is best-effort; the daily-record split is the core.
      console.error(
        `[rh-promotion] Fixed-task split failed for ${empNo} ${monthYear} (non-fatal):`,
        err,
      );
    }

    // 4. Refresh crew/vessel summaries so both rank periods surface as rows.
    try {
      await dailyRecordsService.resyncSummaries(empNo, vesselId, monthYear, auditUserUuid ?? null);
    } catch (err) {
      console.error(
        `[rh-promotion] Summary resync failed for ${empNo} ${monthYear} (non-fatal):`,
        err,
      );
    }

    return { status: "split", newDailyUuid: created.rhDailyUuid };
  },
};
