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
 * Given a crew member's promotion ledger rows (effective date asc) plus their
 * current rank, return the rank that was valid on `isoDate`:
 *  - the `toRank` of the latest entry whose effectiveDate <= isoDate;
 *  - if isoDate precedes the earliest entry, that entry's `fromRank`;
 *  - if there are no usable entries, the current `presentRank`.
 */
function rankAsOf(
  entries: PromoExecutionLedgerV2[],
  isoDate: string,
  presentRank: string | null,
): string | null {
  const valid = entries
    .filter((e) => toIsoDate(e.effectiveDate) !== null)
    .sort((a, b) => {
      const da = toIsoDate(a.effectiveDate)!;
      const db = toIsoDate(b.effectiveDate)!;
      if (da < db) return -1;
      if (da > db) return 1;
      return 0;
    });

  if (valid.length === 0) return presentRank;

  let resolved: string | null = null;
  for (const entry of valid) {
    if (toIsoDate(entry.effectiveDate)! <= isoDate) {
      resolved = entry.toRank;
    } else {
      break;
    }
  }

  if (resolved !== null) return resolved;

  // isoDate is before the first promotion ⇒ the rank held before it.
  return valid[0].fromRank ?? presentRank;
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
