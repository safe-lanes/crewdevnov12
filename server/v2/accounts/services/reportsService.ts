import { ledgerQueries, BalanceService } from "../engine";
import { toCents, centsToString } from "../engine/periodMath";
import { EngagementsRepository } from "../repositories";
import {
  ReportsRepository,
  type ReportElementInfo,
} from "../repositories/reportsRepository";
import { tenantConfigService } from "./tenantConfigService";
import type {
  AccWageLedgerV2,
  AccEngagementV2,
  AccPortageBillV2,
} from "../../../../shared/v2/accounts/types";

/**
 * Reports layer — read-only projections of the wage ledger. NOTHING here
 * recomputes wages: every figure is a sum of stored acc_wage_ledger_v2
 * lines (plus derived balances via BalanceService), so reports always
 * reconcile with the portage bill and the balance math.
 *
 * Bucketing mirrors wageEngineService.summaryForPortage exactly:
 * - remitted_to_fund lines -> fund remittances (informational; never payable)
 * - deduction lines        -> deductions
 * - earning/employer_contribution + payable_at_settlement -> settlement accrual
 * - remaining earning/employer_contribution               -> gross (on board)
 * Superseding rule (same as BalanceService): within one engagement+period,
 * once ANY line belongs to a portage bill, only portage lines count —
 * leftover preview lines (portage_uuid IS NULL) are ignored.
 */

const FINAL_STATUSES = new Set(["approved", "locked"]);
export const UNMAPPED_GL_CODE = "UNMAPPED";

const balanceService = new BalanceService();
const engagementsRepo = new EngagementsRepository();
const reportsRepo = new ReportsRepository();

function reportError(code: "NOT_FOUND" | "VALIDATION", message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/** Apply the portage-supersedes-preview rule to ONE engagement's period lines. */
function supersede(lines: AccWageLedgerV2[]): AccWageLedgerV2[] {
  const hasPortage = lines.some((l) => l.portageUuid != null);
  return hasPortage ? lines.filter((l) => l.portageUuid != null) : lines;
}

/** Group lines by engagement and apply the superseding rule per engagement. */
function supersedeByEngagement(
  lines: AccWageLedgerV2[],
): Map<string, AccWageLedgerV2[]> {
  const byEngagement = new Map<string, AccWageLedgerV2[]>();
  for (const l of lines) {
    const list = byEngagement.get(l.engagementUuid);
    if (list) list.push(l);
    else byEngagement.set(l.engagementUuid, [l]);
  }
  const out = new Map<string, AccWageLedgerV2[]>();
  for (const [engagementUuid, engLines] of byEngagement) {
    const effective = supersede(engLines);
    if (effective.length > 0) out.set(engagementUuid, effective);
  }
  return out;
}

interface BucketTotals {
  grossCents: number;
  deductionCents: number;
  settlementCents: number;
  fundCents: number;
  leaveThisCents: number;
}

/** Cents totals mirroring summaryForPortage bucketing. */
function bucketTotals(
  lines: AccWageLedgerV2[],
  elements: Map<string, ReportElementInfo>,
): BucketTotals {
  const t: BucketTotals = {
    grossCents: 0,
    deductionCents: 0,
    settlementCents: 0,
    fundCents: 0,
    leaveThisCents: 0,
  };
  for (const l of lines) {
    // settlement payout postings are not monthly wage activity
    // (mirrors BalanceService / settlementsService exclusion)
    if (l.sourceType === "settlement") continue;
    const cents = toCents(l.amount);
    if (l.paymentTiming === "remitted_to_fund") {
      t.fundCents += cents;
      continue;
    }
    if (l.elementType === "deduction") {
      t.deductionCents += cents;
    } else if (
      l.elementType === "earning" ||
      l.elementType === "employer_contribution"
    ) {
      if (l.paymentTiming === "payable_at_settlement") {
        t.settlementCents += cents;
        if (
          l.elementType === "earning" &&
          elements.get(l.payElementUuid)?.category === "leave"
        ) {
          t.leaveThisCents += cents;
        }
      } else {
        t.grossCents += cents;
      }
    }
  }
  return t;
}

export interface PayslipLine {
  ledgerUuid: string;
  elementCode: string;
  elementName: string;
  rankId: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  daysServed: string | null;
  qty: string | null;
  rate: string | null;
  amount: string;
  currency: string;
  isAdjustment: boolean;
  isLeave: boolean;
}

export interface Payslip {
  crewUuid: string;
  crewName: string;
  rankId: string | null;
  nationalityUuid: string | null;
  engagementUuid: string;
  engagementStart: string | null;
  engagementEnd: string | null;
  vesselUuid: string | null;
  vesselName: string | null;
  period: string;
  wagePeriodFrom: string | null;
  wagePeriodTo: string | null;
  daysServed: string;
  currency: string;
  sections: {
    earnings: PayslipLine[];
    deductions: PayslipLine[];
    settlementAccruals: PayslipLine[];
    fundRemittances: PayslipLine[];
  };
  totals: {
    earnedGross: string;
    deductions: string;
    netOnBoard: string;
    settlementAccrual: string;
    fundRemittance: string;
    balanceBf: string;
    balanceCf: string;
    leaveBf: string;
    leaveThisMonth: string;
    leaveCf: string;
  };
  meta: {
    portageUuid: string | null;
    portageStatus: string | null;
    isDraft: boolean;
  };
}

function toPayslipLine(
  l: AccWageLedgerV2,
  elements: Map<string, ReportElementInfo>,
): PayslipLine {
  const el = elements.get(l.payElementUuid);
  return {
    ledgerUuid: l.ledgerUuid,
    elementCode: l.elementCode ?? el?.code ?? "",
    elementName: el?.name ?? l.elementCode ?? "",
    rankId: l.rankId ?? null,
    periodFrom: l.periodFrom ?? null,
    periodTo: l.periodTo ?? null,
    daysServed: l.daysServed ?? null,
    qty: l.qty ?? null,
    rate: l.rate ?? null,
    amount: l.amount,
    currency: l.currency,
    isAdjustment: l.isAdjustment,
    isLeave: el?.category === "leave",
  };
}

/** Sum of days served over distinct sub-periods (max per sub-period). */
function totalDaysServed(lines: AccWageLedgerV2[]): string {
  const bySubPeriod = new Map<string, number>();
  for (const l of lines) {
    if (l.daysServed == null) continue;
    const key = `${l.periodFrom ?? ""}|${l.periodTo ?? ""}`;
    const days = Number(l.daysServed);
    bySubPeriod.set(key, Math.max(bySubPeriod.get(key) ?? 0, days));
  }
  let total = 0;
  for (const days of bySubPeriod.values()) total += days;
  return String(Math.round(total * 100) / 100);
}

async function buildPayslip(
  engagement: AccEngagementV2,
  lines: AccWageLedgerV2[],
  period: string,
  portage: AccPortageBillV2 | undefined,
  elements: Map<string, ReportElementInfo>,
  crewDetails: Map<
    string,
    { name: string; presentRank: string | null; nationalityUuid: string | null }
  >,
  vesselNames: Map<string, string>,
): Promise<Payslip> {
  const sections: Payslip["sections"] = {
    earnings: [],
    deductions: [],
    settlementAccruals: [],
    fundRemittances: [],
  };
  let rankId: string | null = null;
  for (const l of lines) {
    if (l.sourceType === "settlement") continue; // payout postings excluded
    const item = toPayslipLine(l, elements);
    if (l.paymentTiming === "remitted_to_fund") {
      sections.fundRemittances.push(item);
    } else if (l.elementType === "deduction") {
      sections.deductions.push(item);
    } else if (
      l.elementType === "earning" ||
      l.elementType === "employer_contribution"
    ) {
      if (l.paymentTiming === "payable_at_settlement") {
        sections.settlementAccruals.push(item);
      } else {
        sections.earnings.push(item);
      }
    }
    rankId = l.rankId ?? rankId;
  }

  const t = bucketTotals(lines, elements);
  const prior = await balanceService.priorBalances(
    engagement.engagementUuid,
    period,
  );
  const netCents = t.grossCents - t.deductionCents;
  const balanceCfCents =
    prior.balanceBfCents + netCents - prior.settlementsAtPeriodCents;

  const crew = crewDetails.get(engagement.crewUuid);
  const dated = lines.filter((l) => l.periodFrom != null);
  const wagePeriodFrom = dated.length
    ? dated.reduce(
        (min, l) => (l.periodFrom! < min ? l.periodFrom! : min),
        dated[0].periodFrom!,
      )
    : null;
  const datedTo = lines.filter((l) => l.periodTo != null);
  const wagePeriodTo = datedTo.length
    ? datedTo.reduce(
        (max, l) => (l.periodTo! > max ? l.periodTo! : max),
        datedTo[0].periodTo!,
      )
    : null;

  const portageStatus = portage?.status ?? null;
  return {
    crewUuid: engagement.crewUuid,
    crewName: crew?.name ?? engagement.crewUuid,
    rankId: rankId ?? crew?.presentRank ?? null,
    nationalityUuid: crew?.nationalityUuid ?? null,
    engagementUuid: engagement.engagementUuid,
    engagementStart: engagement.startDate ?? null,
    engagementEnd: engagement.endDate ?? null,
    vesselUuid: engagement.vesselUuid ?? null,
    vesselName: engagement.vesselUuid
      ? (vesselNames.get(engagement.vesselUuid) ?? null)
      : null,
    period,
    wagePeriodFrom,
    wagePeriodTo,
    daysServed: totalDaysServed(lines),
    currency: lines[0]?.currency ?? "USD",
    sections,
    totals: {
      earnedGross: centsToString(t.grossCents),
      deductions: centsToString(t.deductionCents),
      netOnBoard: centsToString(netCents),
      settlementAccrual: centsToString(t.settlementCents),
      fundRemittance: centsToString(t.fundCents),
      balanceBf: centsToString(prior.balanceBfCents),
      balanceCf: centsToString(balanceCfCents),
      leaveBf: centsToString(prior.leaveBfCents),
      leaveThisMonth: centsToString(t.leaveThisCents),
      leaveCf: centsToString(
        prior.leaveBfCents + t.leaveThisCents - prior.leaveSettledAtPeriodCents,
      ),
    },
    meta: {
      portageUuid: portage?.portageUuid ?? null,
      portageStatus,
      isDraft: !portageStatus || !FINAL_STATUSES.has(portageStatus),
    },
  };
}

export interface GlExportRow {
  glCode: string;
  label: string;
  elementCodes: string[];
  dr: string;
  cr: string;
}

export interface GlExport {
  vesselUuid: string;
  vesselName: string | null;
  period: string;
  currency: string;
  rows: GlExportRow[];
  totals: { dr: string; cr: string; balanced: boolean };
  memo: { settlementAccrual: string; fundRemittance: string };
  warnings: string[];
  meta: {
    portageUuid: string | null;
    portageStatus: string | null;
    finalized: boolean;
  };
}

export interface FleetSummaryRow {
  vesselUuid: string;
  vesselName: string | null;
  crewCount: number;
  earnedGross: string;
  employerContributions: string;
  deductions: string;
  netPayable: string;
  settlementAccrual: string;
}

export interface FleetSummary {
  period: string;
  rows: FleetSummaryRow[];
  totals: {
    crewCount: number;
    earnedGross: string;
    employerContributions: string;
    deductions: string;
    netPayable: string;
    settlementAccrual: string;
  };
}

export const reportsService = {
  /** Single payslip by engagement + period. */
  async payslipForEngagement(
    engagementUuid: string,
    period: string,
  ): Promise<Payslip> {
    const engagement = await engagementsRepo.findByUuid(engagementUuid);
    if (!engagement) {
      throw reportError("NOT_FOUND", `Engagement ${engagementUuid} not found`);
    }
    const lines = supersede(
      await ledgerQueries.findLinesByEngagementPeriod(engagementUuid, period),
    );
    if (lines.length === 0) {
      throw reportError(
        "NOT_FOUND",
        `No wage ledger lines for engagement ${engagementUuid} in ${period} — run the calculation first`,
      );
    }
    const portage = engagement.vesselUuid
      ? await ledgerQueries.findPortage(engagement.vesselUuid, period)
      : undefined;
    const [elements, crewDetails, vesselNames] = await Promise.all([
      reportsRepo.findElementsByUuids(
        Array.from(new Set(lines.map((l) => l.payElementUuid))),
      ),
      reportsRepo.findCrewDetails([engagement.crewUuid]),
      engagementsRepo.findVesselNames(
        engagement.vesselUuid ? [engagement.vesselUuid] : [],
      ),
    ]);
    return buildPayslip(
      engagement,
      lines,
      period,
      portage,
      elements,
      crewDetails,
      vesselNames,
    );
  },

  /**
   * Single payslip by crew + period. When the crew has ledger lines under
   * more than one engagement in the month, the latest engagement (by start
   * date) is used.
   */
  async payslipForCrew(crewUuid: string, period: string): Promise<Payslip> {
    const engagements = await engagementsRepo.findByCrewUuids([crewUuid]);
    if (engagements.length === 0) {
      throw reportError(
        "NOT_FOUND",
        `No engagements found for crew ${crewUuid}`,
      );
    }
    const withLines: AccEngagementV2[] = [];
    for (const e of engagements) {
      const lines = supersede(
        await ledgerQueries.findLinesByEngagementPeriod(
          e.engagementUuid,
          period,
        ),
      );
      if (lines.length > 0) withLines.push(e);
    }
    if (withLines.length === 0) {
      throw reportError(
        "NOT_FOUND",
        `No wage ledger lines for crew ${crewUuid} in ${period} — run the calculation first`,
      );
    }
    withLines.sort((a, b) =>
      String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")),
    );
    return this.payslipForEngagement(withLines[0].engagementUuid, period);
  },

  /**
   * Batch payslips for a vessel + period — strictly ONE payslip per crew
   * with ledger lines that month. The superseding rule is applied per
   * engagement, then the crew's effective lines are merged across
   * engagements; the latest engagement (by start date) is the primary for
   * header details and balance B/F (same rule as payslipForCrew).
   */
  async payslipBatch(
    vesselUuid: string,
    period: string,
  ): Promise<{
    vesselUuid: string;
    vesselName: string | null;
    period: string;
    portageStatus: string | null;
    isDraft: boolean;
    payslips: Payslip[];
  }> {
    const [rawLines, portage] = await Promise.all([
      ledgerQueries.findLinesByVesselPeriod(vesselUuid, period),
      ledgerQueries.findPortage(vesselUuid, period),
    ]);
    const byEngagement = supersedeByEngagement(rawLines);
    const engagements = await engagementsRepo.findByUuids(
      Array.from(byEngagement.keys()),
    );
    const engagementByUuid = new Map(
      engagements.map((e) => [e.engagementUuid, e]),
    );
    // group the effective lines by crew (one payslip per crew)
    const byCrew = new Map<
      string,
      { engagements: AccEngagementV2[]; lines: AccWageLedgerV2[] }
    >();
    for (const [engagementUuid, lines] of byEngagement) {
      const engagement = engagementByUuid.get(engagementUuid);
      if (!engagement) continue;
      let agg = byCrew.get(engagement.crewUuid);
      if (!agg) {
        agg = { engagements: [], lines: [] };
        byCrew.set(engagement.crewUuid, agg);
      }
      agg.engagements.push(engagement);
      agg.lines.push(...lines);
    }
    const allLines = Array.from(byCrew.values()).flatMap((a) => a.lines);
    const [elements, crewDetails, vesselNames] = await Promise.all([
      reportsRepo.findElementsByUuids(
        Array.from(new Set(allLines.map((l) => l.payElementUuid))),
      ),
      reportsRepo.findCrewDetails(Array.from(byCrew.keys())),
      engagementsRepo.findVesselNames([vesselUuid]),
    ]);
    const payslips: Payslip[] = [];
    for (const agg of byCrew.values()) {
      agg.engagements.sort((a, b) =>
        String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")),
      );
      agg.lines.sort((a, b) =>
        String(a.periodFrom ?? "").localeCompare(String(b.periodFrom ?? "")),
      );
      payslips.push(
        await buildPayslip(
          agg.engagements[0],
          agg.lines,
          period,
          portage,
          elements,
          crewDetails,
          vesselNames,
        ),
      );
    }
    payslips.sort((a, b) => a.crewName.localeCompare(b.crewName));
    const portageStatus = portage?.status ?? null;
    return {
      vesselUuid,
      vesselName: vesselNames.get(vesselUuid) ?? null,
      period,
      portageStatus,
      isDraft: !portageStatus || !FINAL_STATUSES.has(portageStatus),
      payslips,
    };
  },

  /**
   * GL DR/CR journal for a vessel + period, aggregated by element gl_code.
   * DR on-board earnings/contributions, CR deductions, CR the net payable
   * on board to the tenant's wages-payable account — so ΣDR = ΣCR is an
   * identity (net = gross − deductions, same bucketing as the portage
   * summary). Settlement accruals and fund remittances are memo-only.
   */
  async glExport(vesselUuid: string, period: string): Promise<GlExport> {
    const [rawLines, portage, config] = await Promise.all([
      ledgerQueries.findLinesByVesselPeriod(vesselUuid, period),
      ledgerQueries.findPortage(vesselUuid, period),
      tenantConfigService.get(),
    ]);
    const byEngagement = supersedeByEngagement(rawLines);
    const lines = Array.from(byEngagement.values()).flat();
    const elements = await reportsRepo.findElementsByUuids(
      Array.from(new Set(lines.map((l) => l.payElementUuid))),
    );
    const vesselNames = await engagementsRepo.findVesselNames([vesselUuid]);

    interface Bucket {
      drCents: number;
      crCents: number;
      elementCodes: Set<string>;
      labels: Set<string>;
    }
    const buckets = new Map<string, Bucket>();
    const bucketFor = (glCode: string): Bucket => {
      let b = buckets.get(glCode);
      if (!b) {
        b = { drCents: 0, crCents: 0, elementCodes: new Set(), labels: new Set() };
        buckets.set(glCode, b);
      }
      return b;
    };

    const unmappedElementCodes = new Set<string>();
    let grossCents = 0;
    let deductionCents = 0;
    let settlementCents = 0;
    let fundCents = 0;

    for (const l of lines) {
      if (l.sourceType === "settlement") continue; // payout postings excluded
      const cents = toCents(l.amount);
      if (l.paymentTiming === "remitted_to_fund") {
        fundCents += cents;
        continue;
      }
      const el = elements.get(l.payElementUuid);
      const elementCode = l.elementCode ?? el?.code ?? l.payElementUuid;
      const label = el?.name ?? elementCode;
      if (l.elementType === "deduction") {
        deductionCents += cents;
        const glCode = el?.glCode ?? UNMAPPED_GL_CODE;
        if (!el?.glCode) unmappedElementCodes.add(elementCode);
        const b = bucketFor(glCode);
        b.crCents += cents;
        b.elementCodes.add(elementCode);
        b.labels.add(label);
      } else if (
        l.elementType === "earning" ||
        l.elementType === "employer_contribution"
      ) {
        if (l.paymentTiming === "payable_at_settlement") {
          settlementCents += cents;
          continue;
        }
        grossCents += cents;
        const glCode = el?.glCode ?? UNMAPPED_GL_CODE;
        if (!el?.glCode) unmappedElementCodes.add(elementCode);
        const b = bucketFor(glCode);
        b.drCents += cents;
        b.elementCodes.add(elementCode);
        b.labels.add(label);
      }
    }

    // Balancing CR: the month's net payable on board -> wages payable.
    const netCents = grossCents - deductionCents;
    const wagesPayableCode = config.glWagesPayableCode ?? UNMAPPED_GL_CODE;
    const wb = bucketFor(wagesPayableCode);
    wb.crCents += netCents;
    wb.labels.add("Net wages payable");

    const warnings: string[] = [];
    if (unmappedElementCodes.size > 0) {
      warnings.push(
        `Pay elements without a GL code (aggregated under ${UNMAPPED_GL_CODE}): ${Array.from(unmappedElementCodes).sort().join(", ")} — set gl_code in the Pay Elements Library`,
      );
    }
    if (!config.glWagesPayableCode) {
      warnings.push(
        `No GL wages payable account configured — the net payable credit is aggregated under ${UNMAPPED_GL_CODE}; set it in Tenant Configuration`,
      );
    }

    const rows: GlExportRow[] = Array.from(buckets.entries())
      .sort(([a], [b]) => {
        if (a === UNMAPPED_GL_CODE) return 1;
        if (b === UNMAPPED_GL_CODE) return -1;
        return a.localeCompare(b);
      })
      .map(([glCode, b]) => ({
        glCode,
        label: Array.from(b.labels).sort().join(", "),
        elementCodes: Array.from(b.elementCodes).sort(),
        dr: centsToString(b.drCents),
        cr: centsToString(b.crCents),
      }));

    let drTotal = 0;
    let crTotal = 0;
    for (const b of buckets.values()) {
      drTotal += b.drCents;
      crTotal += b.crCents;
    }

    const portageStatus = portage?.status ?? null;
    return {
      vesselUuid,
      vesselName: vesselNames.get(vesselUuid) ?? null,
      period,
      currency: lines[0]?.currency ?? "USD",
      rows,
      totals: {
        dr: centsToString(drTotal),
        cr: centsToString(crTotal),
        balanced: drTotal === crTotal,
      },
      memo: {
        settlementAccrual: centsToString(settlementCents),
        fundRemittance: centsToString(fundCents),
      },
      warnings,
      meta: {
        portageUuid: portage?.portageUuid ?? null,
        portageStatus,
        finalized: !!portageStatus && FINAL_STATUSES.has(portageStatus),
      },
    };
  },

  /** Per-vessel cost summary for a period (straight ledger aggregation). */
  async fleetSummary(
    period: string,
    vesselUuid?: string,
  ): Promise<FleetSummary> {
    const rawLines = vesselUuid
      ? await ledgerQueries.findLinesByVesselPeriod(vesselUuid, period)
      : await ledgerQueries.findLinesByPeriod(period);
    const byEngagement = supersedeByEngagement(rawLines);
    const lines = Array.from(byEngagement.values()).flat();
    const elements = await reportsRepo.findElementsByUuids(
      Array.from(new Set(lines.map((l) => l.payElementUuid))),
    );

    interface VesselAgg {
      crewUuids: Set<string>;
      lines: AccWageLedgerV2[];
    }
    const byVessel = new Map<string, VesselAgg>();
    for (const l of lines) {
      const key = l.vesselUuid ?? "";
      let agg = byVessel.get(key);
      if (!agg) {
        agg = { crewUuids: new Set(), lines: [] };
        byVessel.set(key, agg);
      }
      agg.crewUuids.add(l.crewUuid);
      agg.lines.push(l);
    }

    const vesselNames = await engagementsRepo.findVesselNames(
      Array.from(byVessel.keys()).filter(Boolean),
    );

    const rows: FleetSummaryRow[] = [];
    const fleet = {
      crewCount: 0,
      grossCents: 0,
      fundCents: 0,
      deductionCents: 0,
      netCents: 0,
      settlementCents: 0,
    };
    for (const [vUuid, agg] of byVessel) {
      const t = bucketTotals(agg.lines, elements);
      const netCents = t.grossCents - t.deductionCents;
      rows.push({
        vesselUuid: vUuid,
        vesselName: vUuid ? (vesselNames.get(vUuid) ?? null) : null,
        crewCount: agg.crewUuids.size,
        earnedGross: centsToString(t.grossCents),
        employerContributions: centsToString(t.fundCents),
        deductions: centsToString(t.deductionCents),
        netPayable: centsToString(netCents),
        settlementAccrual: centsToString(t.settlementCents),
      });
      fleet.crewCount += agg.crewUuids.size;
      fleet.grossCents += t.grossCents;
      fleet.fundCents += t.fundCents;
      fleet.deductionCents += t.deductionCents;
      fleet.netCents += netCents;
      fleet.settlementCents += t.settlementCents;
    }
    rows.sort((a, b) => (a.vesselName ?? "").localeCompare(b.vesselName ?? ""));

    return {
      period,
      rows,
      totals: {
        crewCount: fleet.crewCount,
        earnedGross: centsToString(fleet.grossCents),
        employerContributions: centsToString(fleet.fundCents),
        deductions: centsToString(fleet.deductionCents),
        netPayable: centsToString(fleet.netCents),
        settlementAccrual: centsToString(fleet.settlementCents),
      },
    };
  },
};
