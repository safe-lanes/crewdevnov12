import { inArray, eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { ExecutionLedgerRepository } from "../../promotions/repositories/executionLedgerRepository";
import type { PromoExecutionLedgerV2 } from "../../../../shared/v2/promotions/types";

const executionLedgerRepository = new ExecutionLedgerRepository();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalise an arbitrary date input to an ISO "YYYY-MM-DD" string for
 * comparison against the promotion ledger's effective dates. Accepts a full
 * ISO timestamp ("2026-05-14T12:00:00") or a bare ISO date; returns null when
 * the value cannot be interpreted.
 */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const head = value.slice(0, 10);
  return ISO_DATE.test(head) ? head : null;
}

/**
 * Recorded-at ordinal for a ledger row, used to decide which applied promotion
 * is authoritative. A missing/unparseable `createdAt` is treated as the oldest
 * possible so it can never spuriously win against a row with a real timestamp.
 */
function recordedAt(entry: PromoExecutionLedgerV2): number {
  const t = entry.createdAt ? new Date(entry.createdAt as unknown as string).getTime() : NaN;
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * True when `a` was recorded more recently than `b`. Ties on the recorded
 * timestamp (e.g. rows written in the same transaction) break deterministically
 * by the serial `id` so ordering is stable.
 */
function recordedAfter(a: PromoExecutionLedgerV2, b: PromoExecutionLedgerV2): boolean {
  const ra = recordedAt(a);
  const rb = recordedAt(b);
  if (ra !== rb) return ra > rb;
  return (a.id ?? 0) > (b.id ?? 0);
}

/**
 * Given a crew member's promotion ledger rows plus their current rank, return
 * the rank that was valid on `isoDate`:
 *  - among entries whose effectiveDate <= isoDate, the `toRank` of the one that
 *    was recorded most recently (id as a stable tiebreaker). The most recently
 *    applied promotion is authoritative, so ledger rows whose effective dates
 *    are out of order relative to the rank progression still resolve correctly;
 *  - if isoDate precedes every entry, the earliest-by-effective-date entry's
 *    `fromRank` (the rank held before any promotion);
 *  - if there are no usable entries, the current `presentRank`.
 */
function rankAsOf(
  entries: PromoExecutionLedgerV2[],
  isoDate: string,
  presentRank: string | null,
): string | null {
  const valid = entries.filter((e) => toIsoDate(e.effectiveDate) !== null);

  if (valid.length === 0) return presentRank;

  // The most recently recorded promotion already in force on isoDate wins.
  let inForce: PromoExecutionLedgerV2 | null = null;
  for (const entry of valid) {
    if (toIsoDate(entry.effectiveDate)! <= isoDate) {
      if (inForce === null || recordedAfter(entry, inForce)) {
        inForce = entry;
      }
    }
  }

  if (inForce !== null) return inForce.toRank;

  // isoDate is before every promotion ⇒ the rank held before the earliest one.
  let earliest = valid[0];
  for (const entry of valid) {
    if (toIsoDate(entry.effectiveDate)! < toIsoDate(earliest.effectiveDate)!) {
      earliest = entry;
    }
  }
  return earliest.fromRank ?? presentRank;
}

export const rankResolutionService = {
  /**
   * Resolve the rank each crew member (keyed by empNo / crew_member_id) held on
   * a given date, using the durable promotion execution ledger and falling back
   * to the crew member's current `present_rank` when no promotion applies.
   *
   * Returns a map of crewMemberId -> rank. Members with no resolvable rank are
   * omitted so callers can preserve whatever rank they already had.
   */
  async resolveRanksAsOfDate(
    crewMemberIds: string[],
    date: string,
  ): Promise<Record<string, string>> {
    const isoDate = toIsoDate(date);
    const ids = Array.from(new Set(crewMemberIds.filter(Boolean)));
    if (!isoDate || ids.length === 0) return {};

    const ledgerRows = await executionLedgerRepository.findByCrewMemberIds(ids);
    const ledgerByCrew = new Map<string, PromoExecutionLedgerV2[]>();
    for (const row of ledgerRows) {
      const list = ledgerByCrew.get(row.crewMemberId) ?? [];
      list.push(row);
      ledgerByCrew.set(row.crewMemberId, list);
    }

    const db = getDb();
    const crewRows = await db
      .select({ empNo: crewMembersV2.empNo, presentRank: crewMembersV2.presentRank })
      .from(crewMembersV2)
      .where(and(inArray(crewMembersV2.empNo, ids), eq(crewMembersV2.isDeleted, false)));
    const presentRankByCrew = new Map<string, string | null>();
    for (const row of crewRows) {
      presentRankByCrew.set(row.empNo, row.presentRank ?? null);
    }

    const result: Record<string, string> = {};
    for (const id of ids) {
      const entries = ledgerByCrew.get(id) ?? [];
      const presentRank = presentRankByCrew.get(id) ?? null;
      const rank = rankAsOf(entries, isoDate, presentRank);
      if (rank) result[id] = rank;
    }
    return result;
  },
};
