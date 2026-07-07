import { SettlementsRepository, EngagementsRepository } from "../repositories";
import { EngineReads } from "../engine/engineReads";
import { BalanceService } from "../engine/balanceService";
import {
  monthInfo,
  addMonths,
  toCents,
  centsToString,
} from "../engine/periodMath";
import type {
  AccSettlementV2,
  AccSettlementAdjustmentV2,
  AccSettlementApprovalV2,
  AccEngagementV2,
  AccWageLedgerV2,
} from "../../../../shared/v2/accounts/types";

const repo = new SettlementsRepository();
const engagementsRepo = new EngagementsRepository();
const reads = new EngineReads();
const balanceService = new BalanceService();

function coded(
  code: "CONFLICT" | "VALIDATION" | "NOT_FOUND",
  message: string,
  details?: unknown,
) {
  const err = new Error(message) as Error & { code: string; details?: unknown };
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

/** Settlement statuses that freeze the covered periods for engine re-runs. */
export const FROZEN_SETTLEMENT_STATUSES = [
  "submitted",
  "approved",
  "paid",
  "locked",
] as const;

/** YYYY-MM of an ISO date. */
const periodOf = (isoDate: string) => isoDate.slice(0, 7);

/** First period AFTER the given period (YYYY-MM). */
function periodAfter(period: string): string {
  return periodOf(addMonths(monthInfo(period).monthStart, 1));
}

/** Inclusive list of periods from one YYYY-MM to another. */
function periodRange(fromPeriod: string, toPeriod: string): string[] {
  const out: string[] = [];
  let p = fromPeriod;
  while (p <= toPeriod) {
    out.push(p);
    p = periodAfter(p);
  }
  return out;
}

/**
 * Effective (post-supersede) lines per period: a period calculated into a
 * portage bill supersedes any leftover preview lines of the same period.
 * Mirrors BalanceService's grouping so both read the same reality.
 */
function effectiveLinesByPeriod(
  lines: AccWageLedgerV2[],
): Map<string, AccWageLedgerV2[]> {
  const byPeriod = new Map<string, AccWageLedgerV2[]>();
  for (const l of lines) {
    const list = byPeriod.get(l.period);
    if (list) list.push(l);
    else byPeriod.set(l.period, [l]);
  }
  const out = new Map<string, AccWageLedgerV2[]>();
  for (const [period, periodLines] of byPeriod) {
    const hasPortage = periodLines.some((l) => l.portageUuid != null);
    out.set(
      period,
      hasPortage
        ? periodLines.filter((l) => l.portageUuid != null)
        : periodLines,
    );
  }
  return out;
}

export interface AccrualItem {
  payElementUuid: string;
  code: string;
  name: string;
  category: string;
  amount: string;
}

export interface SettlementDetail {
  settlement: AccSettlementV2;
  adjustments: AccSettlementAdjustmentV2[];
  approvals: AccSettlementApprovalV2[];
  engagement: AccEngagementV2 | null;
  crewName: string | null;
}

async function adjustmentTotalsCents(
  settlementUuid: string,
): Promise<{ earningsCents: number; deductionsCents: number }> {
  const adjustments = await repo.findAdjustmentsBySettlement(settlementUuid);
  let earningsCents = 0;
  let deductionsCents = 0;
  for (const a of adjustments) {
    const cents = toCents(a.amount);
    if (a.type === "deduction") deductionsCents += cents;
    else earningsCents += cents;
  }
  return { earningsCents, deductionsCents };
}

/**
 * Recompute the adjustment components + net of a DRAFT settlement from its
 * live adjustment rows, without re-deriving the ledger components.
 */
async function refreshTotals(
  settlement: AccSettlementV2,
  auditUserUuid?: string,
): Promise<AccSettlementV2> {
  const { earningsCents, deductionsCents } = await adjustmentTotalsCents(
    settlement.settlementUuid,
  );
  const netCents =
    toCents(settlement.balancePaid ?? "0") +
    toCents(settlement.accrualsPaid ?? "0") +
    earningsCents -
    deductionsCents;
  const adjustments = await repo.findAdjustmentsBySettlement(
    settlement.settlementUuid,
  );
  const elementInfo = await repo.findElementInfo(
    Array.from(new Set(adjustments.map((a) => a.payElementUuid))),
  );
  const snapshot =
    (settlement.statementSnapshot as Record<string, unknown> | null) ?? {};
  const updated = await repo.update(settlement.settlementUuid, {
    adjustmentsEarnings: centsToString(earningsCents),
    adjustmentsDeductions: centsToString(deductionsCents),
    netPayable: centsToString(netCents),
    statementSnapshot: {
      ...snapshot,
      adjustments: {
        items: adjustments.map((a) => ({
          adjustmentUuid: a.adjustmentUuid,
          payElementUuid: a.payElementUuid,
          code: elementInfo.get(a.payElementUuid)?.code ?? null,
          name: elementInfo.get(a.payElementUuid)?.name ?? null,
          type: a.type,
          amount: a.amount,
          remarks: a.remarks,
        })),
        earningsTotal: centsToString(earningsCents),
        deductionsTotal: centsToString(deductionsCents),
      },
      netPayable: centsToString(netCents),
    },
    updatedByUuid: auditUserUuid ?? null,
  });
  return updated!;
}

async function requireSettlement(
  settlementUuid: string,
): Promise<AccSettlementV2> {
  const settlement = await repo.findByUuid(settlementUuid);
  if (!settlement) throw coded("NOT_FOUND", "Settlement not found");
  return settlement;
}

export const settlementsService = {
  /** List page payload: settlements + engagements eligible for one. */
  async list(): Promise<{
    settlements: Array<
      AccSettlementV2 & {
        crewName: string | null;
        vesselUuid: string | null;
        engagementStartDate: string | null;
        engagementEndDate: string | null;
        rankIdAtStart: string | null;
      }
    >;
    eligibleEngagements: Array<
      AccEngagementV2 & { crewName: string | null; calculatedThrough: string | null }
    >;
  }> {
    const [settlements, ended] = await Promise.all([
      repo.findAll(),
      repo.findEndedEngagements(),
    ]);
    const settlementEngagements = await engagementsRepo.findByUuids(
      settlements.map((s) => s.engagementUuid),
    );
    const engByUuid = new Map(
      settlementEngagements.map((e) => [e.engagementUuid, e]),
    );
    const settled = new Set(settlements.map((s) => s.engagementUuid));
    const eligible = ended.filter((e) => !settled.has(e.engagementUuid));
    const crewUuids = Array.from(
      new Set([
        ...settlements.map((s) => s.crewUuid),
        ...eligible.map((e) => e.crewUuid),
      ]),
    );
    const crewInfo = await engagementsRepo.findCrewInfo(crewUuids);
    const eligibleEnriched = await Promise.all(
      eligible.map(async (e) => {
        const finalPeriod = periodOf(e.endDate!);
        const lines = await reads.findLedgerLinesBefore(
          e.engagementUuid,
          periodAfter(finalPeriod),
        );
        const periods = Array.from(effectiveLinesByPeriod(lines).keys());
        return {
          ...e,
          crewName: crewInfo.get(e.crewUuid)?.name ?? null,
          calculatedThrough:
            periods.length > 0 ? periods.sort()[periods.length - 1] : null,
        };
      }),
    );
    return {
      settlements: settlements.map((s) => {
        const eng = engByUuid.get(s.engagementUuid);
        return {
          ...s,
          crewName: crewInfo.get(s.crewUuid)?.name ?? null,
          vesselUuid: eng?.vesselUuid ?? null,
          engagementStartDate: eng?.startDate ?? null,
          engagementEndDate: eng?.endDate ?? null,
          rankIdAtStart: eng?.rankIdAtStart ?? null,
        };
      }),
      eligibleEngagements: eligibleEnriched,
    };
  },

  async get(settlementUuid: string): Promise<SettlementDetail> {
    const settlement = await requireSettlement(settlementUuid);
    const [adjustments, approvals, engagement, crewInfo] = await Promise.all([
      repo.findAdjustmentsBySettlement(settlementUuid),
      repo.findApprovalsBySettlement(settlementUuid),
      engagementsRepo.findByUuid(settlement.engagementUuid),
      engagementsRepo.findCrewInfo([settlement.crewUuid]),
    ]);
    return {
      settlement,
      adjustments,
      approvals,
      engagement: engagement ?? null,
      crewName: crewInfo.get(settlement.crewUuid)?.name ?? null,
    };
  },

  /**
   * Compute (or recompute, draft-only) the settlement of an engagement.
   *
   * - Requires an end_date; every month start..end must have effective
   *   calculated ledger lines (409 naming the missing periods).
   * - balance_paid = derived on-board balance through the final period.
   * - accruals_paid = settlement-timed earnings/employer contributions,
   *   itemized per element (leaveTotal split for the leave mini-ledger).
   * - fund remittances reported informationally (never paid out).
   * - statement_snapshot records the source calc_run_uuids + periods.
   */
  async compute(
    engagementUuid: string,
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const engagement = await reads.findEngagementByUuid(engagementUuid);
    if (!engagement) throw coded("NOT_FOUND", "Engagement not found");
    if (!engagement.startDate) {
      throw coded("VALIDATION", "Engagement has no start_date");
    }
    if (!engagement.endDate) {
      throw coded(
        "VALIDATION",
        "Engagement has no end_date (sign-off) — a settlement needs the final service date",
      );
    }
    const existing = await repo.findByEngagement(engagementUuid);
    if (existing && existing.status !== "draft") {
      throw coded(
        "CONFLICT",
        `Settlement ${existing.settlementUuid} is '${existing.status}' — recompute is only allowed while draft`,
      );
    }

    const finalPeriod = periodOf(engagement.endDate);
    const periods = periodRange(periodOf(engagement.startDate), finalPeriod);
    const nextPeriod = periodAfter(finalPeriod);
    const allLines = await reads.findLedgerLinesBefore(
      engagementUuid,
      nextPeriod,
    );
    const byPeriod = effectiveLinesByPeriod(allLines);
    const missingPeriods = periods.filter((p) => {
      const lines = byPeriod.get(p) ?? [];
      return !lines.some((l) => l.sourceType !== "settlement");
    });
    if (missingPeriods.length > 0) {
      throw coded(
        "CONFLICT",
        `Cannot compute settlement: no completed calculation for period(s) ${missingPeriods.join(", ")} — run the wage calculation for every month of the engagement first`,
        { missingPeriods },
      );
    }

    // Effective lines across the whole engagement span.
    const effective: AccWageLedgerV2[] = [];
    for (const p of periods) {
      for (const l of byPeriod.get(p) ?? []) {
        if (l.sourceType === "settlement") continue;
        effective.push(l);
      }
    }
    const elementInfo = await repo.findElementInfo(
      Array.from(new Set(effective.map((l) => l.payElementUuid))),
    );

    // Source calc runs (distinct, with the periods they covered).
    const runPeriods = new Map<string, Set<string>>();
    for (const l of effective) {
      const set = runPeriods.get(l.calcRunUuid) ?? new Set<string>();
      set.add(l.period);
      runPeriods.set(l.calcRunUuid, set);
    }
    const sourceCalcRuns = Array.from(runPeriods.entries()).map(
      ([calcRunUuid, ps]) => ({
        calcRunUuid,
        periods: Array.from(ps).sort(),
      }),
    );

    // Component 1: unpaid on-board balance through the final period.
    const prior = await balanceService.priorBalances(
      engagementUuid,
      nextPeriod,
    );
    const balancePaidCents = prior.balanceBfCents;

    // Per-period on-board net (statement detail).
    const balanceByPeriod = periods.map((p) => {
      let netCents = 0;
      for (const l of byPeriod.get(p) ?? []) {
        if (l.sourceType === "settlement") continue;
        if (l.paymentTiming === "remitted_to_fund") continue;
        const cents = toCents(l.amount);
        if (
          (l.elementType === "earning" ||
            l.elementType === "employer_contribution") &&
          l.paymentTiming === "paid_on_board"
        ) {
          netCents += cents;
        } else if (l.elementType === "deduction") {
          netCents -= cents;
        }
      }
      return { period: p, netOnBoard: centsToString(netCents) };
    });

    // Component 2: settlement-timed accruals, itemized per element.
    const accrualByElement = new Map<string, number>();
    let accrualsPaidCents = 0;
    let leaveTotalCents = 0;
    let fundCents = 0;
    for (const l of effective) {
      const cents = toCents(l.amount);
      const isContribution =
        l.elementType === "earning" ||
        l.elementType === "employer_contribution";
      if (!isContribution) continue;
      if (l.paymentTiming === "remitted_to_fund") {
        fundCents += cents;
        continue;
      }
      if (l.paymentTiming !== "payable_at_settlement") continue;
      accrualsPaidCents += cents;
      accrualByElement.set(
        l.payElementUuid,
        (accrualByElement.get(l.payElementUuid) ?? 0) + cents,
      );
      if (elementInfo.get(l.payElementUuid)?.category === "leave") {
        leaveTotalCents += cents;
      }
    }
    const accrualItems: AccrualItem[] = Array.from(
      accrualByElement.entries(),
    ).map(([payElementUuid, cents]) => {
      const info = elementInfo.get(payElementUuid);
      return {
        payElementUuid,
        code: info?.code ?? payElementUuid,
        name: info?.name ?? payElementUuid,
        category: info?.category ?? "other",
        amount: centsToString(cents),
      };
    });
    accrualItems.sort((a, b) => a.code.localeCompare(b.code));

    // Component 3: settlement adjustments (existing draft rows survive).
    const { earningsCents, deductionsCents } = existing
      ? await adjustmentTotalsCents(existing.settlementUuid)
      : { earningsCents: 0, deductionsCents: 0 };

    const netCents =
      balancePaidCents + accrualsPaidCents + earningsCents - deductionsCents;

    const run = await repo.createSettlementRun({
      portageUuid: null,
      engagementUuid,
      runType: "settlement",
      runDate: new Date(),
      runByUuid: auditUserUuid ?? null,
      status: "completed",
      inputSnapshot: { engagementUuid, finalPeriod, periods, sourceCalcRuns },
      createdByUuid: auditUserUuid ?? null,
    });

    const adjustments = existing
      ? await repo.findAdjustmentsBySettlement(existing.settlementUuid)
      : [];
    const adjElementInfo = await repo.findElementInfo(
      Array.from(new Set(adjustments.map((a) => a.payElementUuid))),
    );
    const statementSnapshot = {
      computedAt: new Date().toISOString(),
      computeRunUuid: run.calcRunUuid,
      engagementUuid,
      crewUuid: engagement.crewUuid,
      vesselUuid: engagement.vesselUuid,
      startDate: engagement.startDate,
      endDate: engagement.endDate,
      currency: engagement.currency ?? "USD",
      periods,
      sourceCalcRuns,
      balance: {
        byPeriod: balanceByPeriod,
        total: centsToString(balancePaidCents),
      },
      accruals: {
        items: accrualItems,
        total: centsToString(accrualsPaidCents),
        leaveTotal: centsToString(leaveTotalCents),
      },
      adjustments: {
        items: adjustments.map((a) => ({
          adjustmentUuid: a.adjustmentUuid,
          payElementUuid: a.payElementUuid,
          code: adjElementInfo.get(a.payElementUuid)?.code ?? null,
          name: adjElementInfo.get(a.payElementUuid)?.name ?? null,
          type: a.type,
          amount: a.amount,
          remarks: a.remarks,
        })),
        earningsTotal: centsToString(earningsCents),
        deductionsTotal: centsToString(deductionsCents),
      },
      fundRemittance: centsToString(fundCents),
      netPayable: centsToString(netCents),
    };

    const values = {
      crewUuid: engagement.crewUuid,
      settlementDate: engagement.endDate,
      period: finalPeriod,
      status: "draft",
      currency: engagement.currency ?? "USD",
      balancePaid: centsToString(balancePaidCents),
      accrualsPaid: centsToString(accrualsPaidCents),
      adjustmentsEarnings: centsToString(earningsCents),
      adjustmentsDeductions: centsToString(deductionsCents),
      netPayable: centsToString(netCents),
      statementSnapshot,
    };
    const settlement = existing
      ? (await repo.update(existing.settlementUuid, {
          ...values,
          updatedByUuid: auditUserUuid ?? null,
        }))!
      : await repo.create({
          ...values,
          engagementUuid,
          createdByUuid: auditUserUuid ?? null,
        });
    return this.get(settlement.settlementUuid);
  },

  // --------------------------------------------------------------------
  // Adjustments (draft-only)
  // --------------------------------------------------------------------

  async addAdjustment(
    settlementUuid: string,
    data: {
      payElementUuid: string;
      type: "earning" | "deduction";
      amount: string;
      remarks?: string | null;
    },
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const settlement = await requireSettlement(settlementUuid);
    if (settlement.status !== "draft") {
      throw coded(
        "CONFLICT",
        `Adjustments can only be edited while draft (status '${settlement.status}')`,
      );
    }
    await repo.createAdjustment({
      settlementUuid,
      payElementUuid: data.payElementUuid,
      type: data.type,
      amount: data.amount,
      remarks: data.remarks ?? null,
      createdByUuid: auditUserUuid ?? null,
    });
    await refreshTotals(settlement, auditUserUuid);
    return this.get(settlementUuid);
  },

  async updateAdjustment(
    adjustmentUuid: string,
    data: {
      payElementUuid?: string;
      type?: "earning" | "deduction";
      amount?: string;
      remarks?: string | null;
    },
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const adjustment = await repo.findAdjustmentByUuid(adjustmentUuid);
    if (!adjustment) throw coded("NOT_FOUND", "Adjustment not found");
    const settlement = await requireSettlement(adjustment.settlementUuid);
    if (settlement.status !== "draft") {
      throw coded(
        "CONFLICT",
        `Adjustments can only be edited while draft (status '${settlement.status}')`,
      );
    }
    await repo.updateAdjustment(adjustmentUuid, {
      ...data,
      updatedByUuid: auditUserUuid ?? null,
    });
    await refreshTotals(settlement, auditUserUuid);
    return this.get(settlement.settlementUuid);
  },

  async deleteAdjustment(
    adjustmentUuid: string,
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const adjustment = await repo.findAdjustmentByUuid(adjustmentUuid);
    if (!adjustment) throw coded("NOT_FOUND", "Adjustment not found");
    const settlement = await requireSettlement(adjustment.settlementUuid);
    if (settlement.status !== "draft") {
      throw coded(
        "CONFLICT",
        `Adjustments can only be edited while draft (status '${settlement.status}')`,
      );
    }
    await repo.updateAdjustment(adjustmentUuid, {
      isDeleted: true,
      updatedByUuid: auditUserUuid ?? null,
    });
    await refreshTotals(settlement, auditUserUuid);
    return this.get(settlement.settlementUuid);
  },

  // --------------------------------------------------------------------
  // Status flow: draft → submitted → approved → paid → locked
  // --------------------------------------------------------------------

  async submit(
    settlementUuid: string,
    approvers: Array<{ approverId?: string | null; approver: string }>,
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const settlement = await requireSettlement(settlementUuid);
    if (settlement.status !== "draft") {
      throw coded(
        "CONFLICT",
        `Settlement cannot be submitted from status '${settlement.status}'`,
      );
    }
    if (!approvers || approvers.length === 0) {
      throw coded("VALIDATION", "At least one approver is required");
    }
    await repo.softDeleteApprovals(settlementUuid);
    await repo.createApprovals(
      approvers.map((a) => ({
        settlementUuid,
        approverId: a.approverId ?? null,
        approver: a.approver,
        status: "Pending",
        createdByUuid: auditUserUuid ?? null,
      })),
    );
    await repo.update(settlementUuid, {
      status: "submitted",
      updatedByUuid: auditUserUuid ?? null,
    });
    return this.get(settlementUuid);
  },

  /** Reject → back to draft; every live row Approved → approved. */
  async decide(
    stApprovalUuid: string,
    decision: "Approved" | "Rejected",
    comments: string | null,
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const approval = await repo.findApprovalByUuid(stApprovalUuid);
    if (!approval) throw coded("NOT_FOUND", "Approval row not found");
    if (approval.status !== "Pending") {
      throw coded("CONFLICT", `Approval already ${approval.status}`);
    }
    const settlement = await requireSettlement(approval.settlementUuid);
    if (settlement.status !== "submitted") {
      throw coded(
        "CONFLICT",
        `Settlement is not awaiting approval (status '${settlement.status}')`,
      );
    }
    await repo.updateApproval(stApprovalUuid, {
      status: decision,
      comments,
      date: new Date().toISOString().slice(0, 10),
      updatedByUuid: auditUserUuid ?? null,
    });
    if (decision === "Rejected") {
      await repo.update(settlement.settlementUuid, {
        status: "draft",
        updatedByUuid: auditUserUuid ?? null,
      });
    } else {
      const approvals = await repo.findApprovalsBySettlement(
        settlement.settlementUuid,
      );
      if (approvals.every((a) => a.status === "Approved")) {
        await repo.update(settlement.settlementUuid, {
          status: "approved",
          updatedByUuid: auditUserUuid ?? null,
        });
      }
    }
    return this.get(settlement.settlementUuid);
  },

  /** approved → paid; the engagement is closed out as 'settled'. */
  async markPaid(
    settlementUuid: string,
    data: { paidDate: string; paymentReference?: string | null },
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const settlement = await requireSettlement(settlementUuid);
    if (settlement.status !== "approved") {
      throw coded(
        "CONFLICT",
        `Settlement can only be marked paid from 'approved' (status '${settlement.status}')`,
      );
    }
    await repo.update(settlementUuid, {
      status: "paid",
      paidDate: data.paidDate,
      paymentReference: data.paymentReference ?? null,
      updatedByUuid: auditUserUuid ?? null,
    });
    await engagementsRepo.update(settlement.engagementUuid, {
      status: "settled",
      updatedByUuid: auditUserUuid ?? null,
    });
    return this.get(settlementUuid);
  },

  async lock(
    settlementUuid: string,
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const settlement = await requireSettlement(settlementUuid);
    if (settlement.status !== "paid") {
      throw coded(
        "CONFLICT",
        `Settlement can only be locked from 'paid' (status '${settlement.status}')`,
      );
    }
    await repo.update(settlementUuid, {
      status: "locked",
      updatedByUuid: auditUserUuid ?? null,
    });
    return this.get(settlementUuid);
  },

  /** Allowed ONLY from submitted — approved+ periods stay frozen. */
  async revertToDraft(
    settlementUuid: string,
    auditUserUuid?: string,
  ): Promise<SettlementDetail> {
    const settlement = await requireSettlement(settlementUuid);
    if (settlement.status !== "submitted") {
      throw coded(
        "CONFLICT",
        `Settlement can only be reverted to draft from 'submitted' (status '${settlement.status}')`,
      );
    }
    await repo.softDeleteApprovals(settlementUuid);
    await repo.update(settlementUuid, {
      status: "draft",
      updatedByUuid: auditUserUuid ?? null,
    });
    return this.get(settlementUuid);
  },
};
