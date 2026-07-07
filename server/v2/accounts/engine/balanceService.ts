import { EngineReads } from "./engineReads";
import { toCents } from "./periodMath";
import type { AccWageLedgerV2 } from "../../../../shared/v2/accounts/types";

/**
 * Derived balances for one engagement, computed from the ledger — never
 * stored (spec: balances are derived, not persisted).
 *
 * - balance_cf(P) = sum of net payable on board over calculated periods <= P
 *   minus settlement payouts (status paid/locked) recorded in periods <= P.
 * - balance_bf(P) = balance_cf(P - 1).
 * - Leave mini-ledger: leave_bf = settlement-timed leave-category earnings
 *   accrued in periods < P, minus prior leave payouts; leave_cf = leave_bf +
 *   leave_this_month.
 */
export interface PriorBalances {
  /** Net on board carried in from periods < P, less settlements paid before P (cents). */
  balanceBfCents: number;
  /** Settlement payouts recorded in period P itself (cents; subtract from balance_cf). */
  settlementsAtPeriodCents: number;
  /** Settlement-timed leave earnings accrued before P, less prior leave payouts (cents). */
  leaveBfCents: number;
  /** Leave accrual payout recorded in period P itself (cents; subtract from leave_cf). */
  leaveSettledAtPeriodCents: number;
}

/**
 * Leave portion of a settlement's accrual payout, read from the settlement
 * statement snapshot (leave itemization stored at compute time).
 */
function leavePaidCents(settlement: {
  statementSnapshot?: unknown;
}): number {
  const snap = settlement.statementSnapshot as {
    accruals?: { leaveTotal?: string | number };
  } | null;
  const leaveTotal = snap?.accruals?.leaveTotal;
  if (leaveTotal == null) return 0;
  return toCents(String(leaveTotal));
}

const SETTLED_STATUSES = new Set(["paid", "locked"]);

export class BalanceService {
  private reads = new EngineReads();

  async priorBalances(
    engagementUuid: string,
    period: string,
  ): Promise<PriorBalances> {
    const [lines, settlement] = await Promise.all([
      this.reads.findLedgerLinesBefore(engagementUuid, period),
      this.reads.findSettlementForEngagement(engagementUuid),
    ]);
    const categories = await this.reads.findElementCategories(
      Array.from(new Set(lines.map((l) => l.payElementUuid))),
    );

    // Group by period; a period calculated into a portage bill supersedes
    // any leftover preview lines of the same period.
    const byPeriod = new Map<string, AccWageLedgerV2[]>();
    for (const l of lines) {
      const list = byPeriod.get(l.period);
      if (list) list.push(l);
      else byPeriod.set(l.period, [l]);
    }

    let priorNetCents = 0;
    let leaveBfCents = 0;
    for (const periodLines of byPeriod.values()) {
      const hasPortage = periodLines.some((l) => l.portageUuid != null);
      const effective = hasPortage
        ? periodLines.filter((l) => l.portageUuid != null)
        : periodLines;
      for (const l of effective) {
        const cents = toCents(l.amount);
        const isLeave = categories.get(l.payElementUuid) === "leave";
        if (l.sourceType === "settlement") {
          // Settlement-posted payout lines reduce the leave accrual.
          if (isLeave) leaveBfCents -= cents;
          continue;
        }
        if (l.paymentTiming === "remitted_to_fund") continue;
        if (
          (l.elementType === "earning" ||
            l.elementType === "employer_contribution") &&
          l.paymentTiming === "paid_on_board"
        ) {
          priorNetCents += cents;
        } else if (l.elementType === "deduction") {
          priorNetCents -= cents;
        }
        if (
          isLeave &&
          l.elementType === "earning" &&
          l.paymentTiming === "payable_at_settlement"
        ) {
          leaveBfCents += cents;
        }
      }
    }

    // Settlement payouts consume the balances componentwise:
    // - balance_paid consumes the on-board balance (balance_bf / balance_cf);
    // - the leave portion of accruals_paid (from the statement snapshot)
    //   consumes the leave mini-ledger.
    // Never subtract net_payable: accruals never entered the on-board
    // balance, so subtracting the whole net would double-count them.
    let settledBeforeCents = 0;
    let settledAtPeriodCents = 0;
    let leaveSettledAtPeriodCents = 0;
    if (
      settlement &&
      SETTLED_STATUSES.has(settlement.status) &&
      settlement.period != null
    ) {
      const balancePaidCents =
        settlement.balancePaid != null ? toCents(settlement.balancePaid) : 0;
      const leaveCents = leavePaidCents(settlement);
      if (settlement.period < period) {
        settledBeforeCents += balancePaidCents;
        leaveBfCents -= leaveCents;
      } else if (settlement.period === period) {
        settledAtPeriodCents += balancePaidCents;
        leaveSettledAtPeriodCents += leaveCents;
      }
    }

    return {
      balanceBfCents: priorNetCents - settledBeforeCents,
      settlementsAtPeriodCents: settledAtPeriodCents,
      leaveBfCents,
      leaveSettledAtPeriodCents,
    };
  }
}
