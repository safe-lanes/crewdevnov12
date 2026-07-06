import { v4 as uuidv4 } from "uuid";
import { EngineReads, type PromotionEvent } from "./engineReads";
import { LedgerRepository } from "./ledgerRepository";
import {
  monthInfo,
  type MonthInfo,
  type RoundingRule,
  type ProrationBasis,
  type DatedSegment,
  parseIsoDate,
  addDays,
  addMonths,
  allocateDays,
  toCents,
  centsToString,
  formatScaled,
  parseScaled,
  divRound,
  roundCents,
  prorateCents,
  rateTimesQtyCents,
  percentageOfCents,
  precisionToUnitCents,
} from "./periodMath";
import type {
  AccTenantConfigV2,
  AccEngagementV2,
  AccEngagementPhaseV2,
  AccEngagementPayElementV2,
  AccPayElementV2,
  AccWageScaleV2,
  AccWageScaleLineV2,
  AccMonthlyTransactionV2,
  AccAllotmentV2,
  AccAdvanceV2,
  AccBondItemV2,
  AccCalculationRunV2,
  AccPortageBillV2,
  InsertAccWageLedgerV2,
} from "../../../../shared/v2/accounts/types";

// ============================================================================
// Types
// ============================================================================

interface EngineConfig {
  prorationBasis: ProrationBasis;
  dayInclusionRule: "both_inclusive" | "exclude_sign_off_day";
  functionalCurrency: string;
  fxRatePolicy: string;
  preparationMode: string;
}

interface CalcContext {
  config: EngineConfig;
  month: MonthInfo;
  elements: Map<string, AccPayElementV2>;
  elementsByCategory: Map<string, AccPayElementV2[]>;
  scaleByUuid: Map<string, AccWageScaleV2>;
  scaleLinesByScale: Map<string, AccWageScaleLineV2[]>;
  overridesByEngagement: Map<string, AccEngagementPayElementV2[]>;
  phasesByEngagement: Map<string, AccEngagementPhaseV2[]>;
  promosByCrew: Map<string, PromotionEvent[]>;
  txnsByEngagement: Map<string, AccMonthlyTransactionV2[]>;
  allotmentsByCrew: Map<string, AccAllotmentV2[]>;
  advancesByCrew: Map<string, AccAdvanceV2[]>;
  bondsByCrew: Map<string, AccBondItemV2[]>;
  nationalityByCrew: Map<string, string | null>;
}

/** Ledger line before run/portage identifiers are attached. */
type EngineLine = Omit<
  InsertAccWageLedgerV2,
  "ledgerUuid" | "calcRunUuid" | "portageUuid"
>;

interface EngagementResult {
  engagement: AccEngagementV2;
  lines: EngineLine[];
  errors: string[];
}

export interface CrewTotals {
  crewUuid: string;
  engagementUuid: string;
  rankId: string | null;
  earnedGross: string;
  deductions: string;
  netOnBoard: string;
  settlementAccrual: string;
  fundRemittance: string;
}

export interface RunSummary {
  run: AccCalculationRunV2;
  portage?: AccPortageBillV2;
  lineCount: number;
  crewTotals: CrewTotals[];
}

interface ResolvedEntry {
  element: AccPayElementV2;
  amountE2: number | null; // monthly amount in cents (or percentage ×10^2)
  rateE4: number | null; // rate ×10^4
  sourceType: "scale" | "engagement_override";
  sourceUuid: string | null;
  scaleUuid: string;
  scaleLineUuid: string | null;
  epeUuid: string | null;
}

interface SegmentState {
  from: string;
  to: string;
  days: number;
  daysCalendar: number;
  rankId: string;
  scaleYear: number;
  scaleUuid: string;
  phaseType: string | null;
}

class EngineError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// Service
// ============================================================================

const reads = new EngineReads();
const ledgerRepo = new LedgerRepository();

function toEngineConfig(row: AccTenantConfigV2 | undefined): EngineConfig {
  return {
    prorationBasis: (row?.prorationBasis ??
      "thirty_day_month") as ProrationBasis,
    dayInclusionRule: (row?.dayInclusionRule ?? "both_inclusive") as
      | "both_inclusive"
      | "exclude_sign_off_day",
    functionalCurrency: row?.functionalCurrency ?? "USD",
    fxRatePolicy: row?.fxRatePolicy ?? "month_end",
    preparationMode: row?.preparationMode ?? "office_prepares",
  };
}

export const wageEngineService = {
  /**
   * Run the engine for every engagement overlapping the period on a vessel.
   * Creates/uses the portage bill; refuses when it is locked.
   */
  async runForVesselPeriod(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<RunSummary> {
    const month = monthInfo(period);
    let portage = await ledgerRepo.findPortage(vesselUuid, period);
    if (portage && (portage.isLocked || portage.status === "locked")) {
      throw new EngineError(
        "CONFLICT",
        `Portage bill for vessel ${vesselUuid} period ${period} is locked; post an adjustment run into a later open period instead`,
      );
    }

    const configRow = await reads.getConfig();
    const config = toEngineConfig(configRow);
    const engagements = await reads.findEngagementsForVesselPeriod(
      vesselUuid,
      month.monthStart,
      month.monthEnd,
    );
    const ctx = await buildContext(config, month, engagements);

    const results = engagements
      .slice()
      .sort((a, b) => a.engagementUuid.localeCompare(b.engagementUuid))
      .map((e) => calcEngagement(ctx, e));
    const errors = results.flatMap((r) =>
      r.errors.map((m) => `${r.engagement.engagementUuid}: ${m}`),
    );

    const inputSnapshot = buildInputSnapshot(config, period, {
      vesselUuid,
      engagementUuids: results.map((r) => r.engagement.engagementUuid),
      scaleUuids: Array.from(ctx.scaleByUuid.keys()).sort(),
    });

    if (errors.length > 0) {
      const run = await ledgerRepo.createRun({
        portageUuid: portage?.portageUuid ?? null,
        engagementUuid: null,
        runType: "monthly",
        runDate: new Date(),
        runByUuid: auditUserUuid ?? null,
        inputSnapshot,
        status: "failed",
        errorDetail: errors.join("; "),
        createdByUuid: auditUserUuid ?? null,
      });
      throw new EngineError(
        "VALIDATION",
        "Calculation failed; no ledger lines were written",
        { errors, calcRunUuid: run.calcRunUuid },
      );
    }

    if (!portage) {
      portage = await ledgerRepo.createPortage({
        vesselUuid,
        period,
        status: "open",
        preparedMode: config.preparationMode,
        currency: config.functionalCurrency,
        createdByUuid: auditUserUuid ?? null,
      });
    }

    const priorLines = await ledgerRepo.findLinesByPortage(portage.portageUuid);
    const runType = priorLines.length > 0 ? "recalculation" : "monthly";
    const run = await ledgerRepo.createRun({
      portageUuid: portage.portageUuid,
      engagementUuid: null,
      runType,
      runDate: new Date(),
      runByUuid: auditUserUuid ?? null,
      inputSnapshot,
      status: "completed",
      createdByUuid: auditUserUuid ?? null,
    });

    const allLines: InsertAccWageLedgerV2[] = [];
    for (const r of results) {
      for (const line of r.lines) {
        allLines.push({
          ...line,
          ledgerUuid: uuidv4(),
          calcRunUuid: run.calcRunUuid,
          portageUuid: portage.portageUuid,
          createdByUuid: auditUserUuid ?? null,
        });
      }
    }

    const crewTotals = results
      .filter((r) => r.lines.length > 0)
      .map((r) => summarizeCrew(r));
    const totals = portageTotals(allLines);
    await ledgerRepo.replacePortageLines(portage.portageUuid, allLines, {
      crewCount: new Set(allLines.map((l) => l.crewUuid)).size,
      totalEarnings: totals.totalEarnings,
      totalDeductions: totals.totalDeductions,
      netTotal: totals.netTotal,
      updatedByUuid: auditUserUuid ?? null,
    });

    return { run, portage, lineCount: allLines.length, crewTotals };
  },

  /** Single-engagement preview run — no portage linkage. */
  async runForEngagement(
    engagementUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<RunSummary> {
    const month = monthInfo(period);
    const engagement = await reads.findEngagementByUuid(engagementUuid);
    if (!engagement) {
      throw new EngineError("NOT_FOUND", "Engagement not found");
    }
    if (engagement.vesselUuid) {
      const portage = await ledgerRepo.findPortage(
        engagement.vesselUuid,
        period,
      );
      if (portage && (portage.isLocked || portage.status === "locked")) {
        throw new EngineError(
          "CONFLICT",
          `Portage bill for vessel ${engagement.vesselUuid} period ${period} is locked; the engine refuses to run against it`,
        );
      }
    }

    const configRow = await reads.getConfig();
    const config = toEngineConfig(configRow);
    const ctx = await buildContext(config, month, [engagement]);
    const result = calcEngagement(ctx, engagement);

    const inputSnapshot = buildInputSnapshot(config, period, {
      engagementUuid,
      scaleUuids: Array.from(ctx.scaleByUuid.keys()).sort(),
    });

    if (result.errors.length > 0) {
      const run = await ledgerRepo.createRun({
        portageUuid: null,
        engagementUuid,
        runType: "monthly",
        runDate: new Date(),
        runByUuid: auditUserUuid ?? null,
        inputSnapshot,
        status: "failed",
        errorDetail: result.errors.join("; "),
        createdByUuid: auditUserUuid ?? null,
      });
      throw new EngineError(
        "VALIDATION",
        "Calculation failed; no ledger lines were written",
        { errors: result.errors, calcRunUuid: run.calcRunUuid },
      );
    }

    const run = await ledgerRepo.createRun({
      portageUuid: null,
      engagementUuid,
      runType: "monthly",
      runDate: new Date(),
      runByUuid: auditUserUuid ?? null,
      inputSnapshot,
      status: "completed",
      createdByUuid: auditUserUuid ?? null,
    });

    const allLines: InsertAccWageLedgerV2[] = result.lines.map((line) => ({
      ...line,
      ledgerUuid: uuidv4(),
      calcRunUuid: run.calcRunUuid,
      portageUuid: null,
      createdByUuid: auditUserUuid ?? null,
    }));
    await ledgerRepo.replacePreviewLines(engagementUuid, period, allLines);

    return {
      run,
      lineCount: allLines.length,
      crewTotals: result.lines.length > 0 ? [summarizeCrew(result)] : [],
    };
  },

  /**
   * Post-lock corrections: explicit adjustment lines tied to source ledger
   * lines, written into a later OPEN period (run_type = adjustment).
   */
  async createAdjustments(
    input: {
      period: string;
      lines: {
        adjustsLedgerUuid: string;
        amount: string;
        payElementUuid?: string;
        remarks?: string;
      }[];
    },
    auditUserUuid?: string,
  ): Promise<{ run: AccCalculationRunV2; lines: InsertAccWageLedgerV2[] }> {
    const month = monthInfo(input.period);
    if (input.lines.length === 0) {
      throw new EngineError("VALIDATION", "No adjustment lines supplied");
    }
    const configRow = await reads.getConfig();
    const config = toEngineConfig(configRow);
    const elements = await reads.findActiveElements();
    const elementByUuid = new Map(elements.map((e) => [e.payElementUuid, e]));

    const prepared: Omit<InsertAccWageLedgerV2, "calcRunUuid">[] = [];
    for (const adj of input.lines) {
      const source = await ledgerRepo.findLineByUuid(adj.adjustsLedgerUuid);
      if (!source) {
        throw new EngineError(
          "VALIDATION",
          `Source ledger line ${adj.adjustsLedgerUuid} not found`,
        );
      }
      if (input.period <= source.period) {
        throw new EngineError(
          "VALIDATION",
          `Adjustment period ${input.period} must be later than the source line's period ${source.period}`,
        );
      }
      let targetPortageUuid: string | null = null;
      if (source.vesselUuid) {
        const portage = await ledgerRepo.findPortage(
          source.vesselUuid,
          input.period,
        );
        if (portage && (portage.isLocked || portage.status === "locked")) {
          throw new EngineError(
            "CONFLICT",
            `Target period ${input.period} is locked for vessel ${source.vesselUuid}; choose a later open period`,
          );
        }
        targetPortageUuid = portage?.portageUuid ?? null;
      }
      const elementUuid = adj.payElementUuid ?? source.payElementUuid;
      const element = elementByUuid.get(elementUuid);
      if (!element) {
        throw new EngineError(
          "VALIDATION",
          `Pay element ${elementUuid} not found or inactive`,
        );
      }
      const amountCents = toCents(adj.amount);
      if (amountCents <= 0) {
        throw new EngineError(
          "VALIDATION",
          "Adjustment amount must be positive; element type carries the sign",
        );
      }
      const amount = centsToString(amountCents);
      const fx = fxFor(source.currency, amount, config);
      prepared.push({
        ledgerUuid: uuidv4(),
        portageUuid: targetPortageUuid,
        engagementUuid: source.engagementUuid,
        crewUuid: source.crewUuid,
        vesselUuid: source.vesselUuid,
        period: input.period,
        periodFrom: month.monthStart,
        periodTo: month.monthEnd,
        daysBasis: null,
        daysServed: null,
        rankId: source.rankId,
        payElementUuid: element.payElementUuid,
        elementType: element.type,
        elementCode: element.code,
        paymentTiming: element.paymentTiming,
        qty: null,
        rate: null,
        amount,
        currency: source.currency,
        fxRate: fx.fxRate,
        amountFunctional: fx.amountFunctional,
        sourceType: "adjustment",
        sourceUuid: source.ledgerUuid,
        calcSnapshot: {
          adjustsLedgerUuid: source.ledgerUuid,
          sourcePeriod: source.period,
          remarks: adj.remarks ?? null,
          ...(fx.note ? { fxNote: fx.note } : {}),
        },
        isAdjustment: true,
        adjustsLedgerUuid: source.ledgerUuid,
        createdByUuid: auditUserUuid ?? null,
      });
    }

    const run = await ledgerRepo.createRun({
      portageUuid: null,
      engagementUuid: null,
      runType: "adjustment",
      runDate: new Date(),
      runByUuid: auditUserUuid ?? null,
      inputSnapshot: buildInputSnapshot(config, input.period, {
        adjustsLedgerUuids: input.lines.map((l) => l.adjustsLedgerUuid),
      }),
      status: "completed",
      createdByUuid: auditUserUuid ?? null,
    });
    const lines = prepared.map((l) => ({ ...l, calcRunUuid: run.calcRunUuid }));
    await ledgerRepo.insertAdjustmentLines(lines);
    return { run, lines };
  },
};

// ============================================================================
// Context building
// ============================================================================

async function buildContext(
  config: EngineConfig,
  month: MonthInfo,
  engagements: AccEngagementV2[],
): Promise<CalcContext> {
  const engagementUuids = engagements.map((e) => e.engagementUuid);
  const crewUuids = Array.from(new Set(engagements.map((e) => e.crewUuid)));

  // Walk every engagement's scale-version chain.
  const scaleByUuid = new Map<string, AccWageScaleV2>();
  for (const e of engagements) {
    let uuid: string | null | undefined = e.wageScaleUuid;
    let guard = 0;
    while (uuid && !scaleByUuid.has(uuid) && guard < 50) {
      const scale = await reads.findScaleByUuid(uuid);
      if (!scale) break;
      scaleByUuid.set(scale.scaleUuid, scale);
      uuid = scale.supersededByScaleUuid;
      guard++;
    }
  }

  const [
    elements,
    scaleLines,
    phases,
    overrides,
    promos,
    txns,
    allotments,
    advances,
    bonds,
    nationalityByCrew,
  ] = await Promise.all([
    reads.findActiveElements(),
    reads.findScaleLines(Array.from(scaleByUuid.keys())),
    reads.findPhases(engagementUuids),
    reads.findOverrides(engagementUuids),
    reads.findPromotions(crewUuids),
    reads.findAcceptedTxns(engagementUuids, month.period),
    reads.findActiveAllotments(crewUuids),
    reads.findAdvanceRecoveries(crewUuids, month.period),
    reads.findBondDeductions(crewUuids, month.period),
    reads.findCrewNationalities(crewUuids),
  ]);

  const elementsMap = new Map(elements.map((e) => [e.payElementUuid, e]));
  const elementsByCategory = groupBy(elements, (e) => e.category);
  for (const list of elementsByCategory.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code));
  }

  return {
    config,
    month,
    elements: elementsMap,
    elementsByCategory,
    scaleByUuid,
    scaleLinesByScale: groupBy(scaleLines, (l) => l.scaleUuid),
    overridesByEngagement: groupBy(overrides, (o) => o.engagementUuid),
    phasesByEngagement: groupBy(phases, (p) => p.engagementUuid),
    promosByCrew: groupBy(promos, (p) => p.crewUuid),
    txnsByEngagement: groupBy(txns, (t) => t.engagementUuid),
    allotmentsByCrew: groupBy(allotments, (a) => a.crewUuid),
    advancesByCrew: groupBy(advances, (a) => a.crewUuid),
    bondsByCrew: groupBy(bonds, (b) => b.crewUuid),
    nationalityByCrew,
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function buildInputSnapshot(
  config: EngineConfig,
  period: string,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    period,
    config: {
      prorationBasis: config.prorationBasis,
      dayInclusionRule: config.dayInclusionRule,
      functionalCurrency: config.functionalCurrency,
      fxRatePolicy: config.fxRatePolicy,
    },
    ...extra,
  };
}

// ============================================================================
// Per-engagement calculation (pure over the prefetched context)
// ============================================================================

function calcEngagement(
  ctx: CalcContext,
  engagement: AccEngagementV2,
): EngagementResult {
  const errors: string[] = [];
  const { month, config } = ctx;

  if (!engagement.startDate || !parseIsoDate(engagement.startDate)) {
    return {
      engagement,
      lines: [],
      errors: [`invalid or missing start_date (${engagement.startDate})`],
    };
  }
  if (engagement.endDate && !parseIsoDate(engagement.endDate)) {
    return {
      engagement,
      lines: [],
      errors: [`invalid end_date (${engagement.endDate})`],
    };
  }
  if (!engagement.wageScaleUuid) {
    return { engagement, lines: [], errors: ["engagement has no wage scale"] };
  }
  if (!engagement.rankIdAtStart) {
    return {
      engagement,
      lines: [],
      errors: ["engagement has no rank_id_at_start"],
    };
  }

  // ---- Service window inside the month --------------------------------
  let svcFrom =
    engagement.startDate > month.monthStart
      ? engagement.startDate
      : month.monthStart;
  let svcTo =
    engagement.endDate && engagement.endDate < month.monthEnd
      ? engagement.endDate
      : month.monthEnd;
  if (svcFrom > svcTo) return { engagement, lines: [], errors: [] };
  if (
    config.dayInclusionRule === "exclude_sign_off_day" &&
    engagement.endDate &&
    engagement.endDate <= month.monthEnd &&
    engagement.endDate >= month.monthStart
  ) {
    svcTo = addDays(engagement.endDate, -1);
    if (svcTo < svcFrom) return { engagement, lines: [], errors: [] };
  }

  // ---- Split events ----------------------------------------------------
  const boundaries = new Set<string>();
  const promos = (ctx.promosByCrew.get(engagement.crewUuid) ?? [])
    .filter((p) => parseIsoDate(p.effectiveDate))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  for (const p of promos) {
    if (p.effectiveDate > svcFrom && p.effectiveDate <= svcTo) {
      boundaries.add(p.effectiveDate);
    }
  }
  const anniversaries = anniversaryDates(engagement, svcTo);
  for (const d of anniversaries) {
    if (d > svcFrom && d <= svcTo) boundaries.add(d);
  }
  const phases = (
    ctx.phasesByEngagement.get(engagement.engagementUuid) ?? []
  ).filter((p) => p.fromDate);
  for (const p of phases) {
    const d = p.fromDate as string;
    if (d > svcFrom && d <= svcTo) boundaries.add(d);
  }
  const startScaleUuid = engagement.wageScaleUuid;
  for (const d of scaleVersionBoundaries(ctx, startScaleUuid, svcFrom, svcTo)) {
    boundaries.add(d);
  }

  const segments: DatedSegment[] = [];
  let cursor = svcFrom;
  for (const b of Array.from(boundaries).sort()) {
    segments.push({ from: cursor, to: addDays(b, -1) });
    cursor = b;
  }
  segments.push({ from: cursor, to: svcTo });

  // ---- Day allocation (both bases, for per-element overrides) ----------
  const thirty = allocateDays(
    segments,
    month,
    svcFrom,
    svcTo,
    "thirty_day_month",
  );
  const calendar = allocateDays(segments, month, svcFrom, svcTo, "calendar_days");

  // ---- Per-segment state ------------------------------------------------
  const states: SegmentState[] = segments.map((seg, i) => ({
    from: seg.from,
    to: seg.to,
    days:
      config.prorationBasis === "calendar_days"
        ? calendar.days[i]
        : thirty.days[i],
    daysCalendar: calendar.days[i],
    rankId: rankAt(engagement, promos, seg.from),
    scaleYear: scaleYearAt(engagement, anniversaries, seg.from),
    scaleUuid: resolveScaleAt(ctx, startScaleUuid, seg.from),
    phaseType: phaseAt(phases, seg.from),
  }));

  const crewNat = ctx.nationalityByCrew.get(engagement.crewUuid) ?? null;
  const overrides = ctx.overridesByEngagement.get(engagement.engagementUuid) ?? [];
  const lines: EngineLine[] = [];
  const totalDaysServed = states.reduce((s, st) => s + st.days, 0);
  const monthDaysBasis =
    config.prorationBasis === "calendar_days"
      ? calendar.daysBasis
      : thirty.daysBasis;

  const base = {
    engagementUuid: engagement.engagementUuid,
    crewUuid: engagement.crewUuid,
    vesselUuid: engagement.vesselUuid ?? null,
    period: month.period,
  };

  // Track non-prorated elements posted once per month.
  const nonProratedPosted = new Set<string>();
  const lastState = states[states.length - 1];

  for (const state of states) {
    if (state.days <= 0) continue; // zero-day segment: no lines
    const entries = resolveEntries(ctx, engagement, state, crewNat, overrides, errors);
    const segLineAmounts = new Map<string, number>(); // elementUuid -> rounded cents

    // Pass 1: amount-bearing elements (scale_lookup / fixed_amount).
    for (const entry of sortedEntries(entries)) {
      const el = entry.element;
      if (el.calcMethod === "rate_times_qty" || el.calcMethod === "manual_entry") {
        continue; // posted from monthly transactions
      }
      if (el.calcMethod === "percentage_of_base") continue; // pass 2
      if (entry.amountE2 == null) {
        errors.push(
          `element ${el.code}: no amount on scale line/override (segment ${state.from})`,
        );
        continue;
      }
      const rule = el.roundingRule as RoundingRule;
      const unit = precisionToUnitCents(el.roundingPrecision);
      if (!el.prorate) {
        if (nonProratedPosted.has(el.payElementUuid)) continue;
        nonProratedPosted.add(el.payElementUuid);
        const amountCents = roundCents(entry.amountE2, rule, unit);
        segLineAmounts.set(el.payElementUuid, amountCents);
        lines.push(
          mkLine(ctx, engagement, entry, {
            ...base,
            periodFrom: svcFrom,
            periodTo: svcTo,
            daysBasis: monthDaysBasis,
            daysServed: String(totalDaysServed),
            rankId: state.rankId,
            amountCents,
            snapshot: {
              scaleYear: state.scaleYear,
              monthlyAmount: centsToString(entry.amountE2),
              rawAmount: centsToString(entry.amountE2),
              prorated: false,
              daysServed: totalDaysServed,
              daysBasis: monthDaysBasis,
            },
          }),
        );
        continue;
      }
      const basis: ProrationBasis =
        (el.prorationBasisOverride as ProrationBasis | null) ??
        config.prorationBasis;
      const segIdx = states.indexOf(state);
      const days =
        basis === "calendar_days" ? calendar.days[segIdx] : thirty.days[segIdx];
      const daysBasis =
        basis === "calendar_days" ? calendar.daysBasis : thirty.daysBasis;
      if (days <= 0) continue;
      const amountCents = prorateCents(entry.amountE2, days, daysBasis, rule, unit);
      const rawE6 = divRound(entry.amountE2 * days * 10_000, daysBasis, "nearest", 1);
      segLineAmounts.set(el.payElementUuid, amountCents);
      lines.push(
        mkLine(ctx, engagement, entry, {
          ...base,
          periodFrom: state.from,
          periodTo: state.to,
          daysBasis,
          daysServed: String(days),
          rankId: state.rankId,
          amountCents,
          snapshot: {
            scaleYear: state.scaleYear,
            monthlyAmount: centsToString(entry.amountE2),
            rawAmount: formatScaled(rawE6, 6),
            prorated: true,
            daysServed: days,
            daysBasis,
          },
        }),
      );
    }

    // Pass 2: percentage_of_base — applied to the base's sub-period amount.
    for (const entry of sortedEntries(entries)) {
      const el = entry.element;
      if (el.calcMethod !== "percentage_of_base") continue;
      if (entry.amountE2 == null) {
        errors.push(`element ${el.code}: no percentage value (segment ${state.from})`);
        continue;
      }
      if (!el.percentageBaseElementUuid) {
        errors.push(`element ${el.code}: percentage_of_base without base element`);
        continue;
      }
      const baseCents = segLineAmounts.get(el.percentageBaseElementUuid);
      if (baseCents == null) {
        errors.push(
          `element ${el.code}: base element line missing in segment ${state.from}`,
        );
        continue;
      }
      const rule = el.roundingRule as RoundingRule;
      const unit = precisionToUnitCents(el.roundingPrecision);
      const amountCents = percentageOfCents(baseCents, entry.amountE2, rule, unit);
      lines.push(
        mkLine(ctx, engagement, entry, {
          ...base,
          periodFrom: state.from,
          periodTo: state.to,
          daysBasis: null,
          daysServed: null,
          rankId: state.rankId,
          amountCents,
          snapshot: {
            scaleYear: state.scaleYear,
            percentage: centsToString(entry.amountE2),
            baseElementUuid: el.percentageBaseElementUuid,
            baseAmount: centsToString(baseCents),
          },
        }),
      );
    }
  }

  // ---- Monthly transactions (posted per month, not sub-period split) ----
  const txns = (ctx.txnsByEngagement.get(engagement.engagementUuid) ?? [])
    .slice()
    .sort((a, b) => a.txnUuid.localeCompare(b.txnUuid));
  for (const txn of txns) {
    const el = ctx.elements.get(txn.payElementUuid);
    if (!el) {
      errors.push(`monthly txn ${txn.txnUuid}: unknown pay element`);
      continue;
    }
    const rule = el.roundingRule as RoundingRule;
    const unit = precisionToUnitCents(el.roundingPrecision);
    let amountCents: number;
    let qty: string | null = txn.qty;
    let rateStr: string | null = null;
    let snapshot: Record<string, unknown>;
    if (el.calcMethod === "rate_times_qty") {
      if (txn.qty == null) {
        errors.push(`monthly txn ${txn.txnUuid}: rate_times_qty without qty`);
        continue;
      }
      const rateE4 = resolveRateForElement(
        ctx,
        engagement,
        lastState,
        crewNat,
        overrides,
        el.payElementUuid,
      );
      const effectiveRateE4 =
        rateE4 ?? (txn.rate != null ? parseScaled(txn.rate, 4) : null);
      if (effectiveRateE4 == null) {
        errors.push(
          `monthly txn ${txn.txnUuid}: no rate on scale/override/txn for ${el.code}`,
        );
        continue;
      }
      const qtyE2 = parseScaled(txn.qty, 2);
      amountCents = rateTimesQtyCents(effectiveRateE4, qtyE2, rule, unit);
      rateStr = formatScaled(effectiveRateE4, 4);
      snapshot = {
        txnUuid: txn.txnUuid,
        qty: txn.qty,
        rate: rateStr,
        rawAmount: formatScaled(effectiveRateE4 * qtyE2, 6),
      };
    } else {
      amountCents = toCents(txn.amount);
      snapshot = { txnUuid: txn.txnUuid, txnAmount: txn.amount };
    }
    lines.push({
      ...base,
      periodFrom: svcFrom,
      periodTo: svcTo,
      daysBasis: null,
      daysServed: null,
      rankId: lastState.rankId,
      payElementUuid: el.payElementUuid,
      elementType: el.type,
      elementCode: el.code,
      paymentTiming: el.paymentTiming,
      qty,
      rate: rateStr,
      amount: centsToString(amountCents),
      currency: txn.currency,
      ...fxColumns(txn.currency, centsToString(amountCents), ctx.config, snapshot),
      sourceType: "monthly_txn",
      sourceUuid: txn.txnUuid,
      calcSnapshot: withConfig(ctx, snapshot),
      isAdjustment: false,
      adjustsLedgerUuid: null,
    });
  }

  // ---- Gross so far (needed for percentage allotments) -------------------
  const grossOnBoardCents = lines
    .filter(
      (l) => l.elementType === "earning" && l.paymentTiming === "paid_on_board",
    )
    .reduce((s, l) => s + toCents(l.amount), 0);

  // ---- Allotments --------------------------------------------------------
  const allotments = (ctx.allotmentsByCrew.get(engagement.crewUuid) ?? [])
    .filter(
      (a) =>
        (!a.engagementUuid || a.engagementUuid === engagement.engagementUuid) &&
        (a.validFrom == null || a.validFrom <= month.monthEnd) &&
        (a.validTo == null || a.validTo >= month.monthStart),
    )
    .sort((a, b) => a.allotmentUuid.localeCompare(b.allotmentUuid));
  for (const allotment of allotments) {
    const el = categoryElement(ctx, "allotment");
    if (!el) {
      errors.push("no active pay element with category 'allotment'");
      break;
    }
    const rule = el.roundingRule as RoundingRule;
    const unit = precisionToUnitCents(el.roundingPrecision);
    let amountCents: number;
    let snapshot: Record<string, unknown>;
    if (allotment.allotmentType === "percentage") {
      const pctE2 = parseScaled(allotment.value, 2);
      amountCents = percentageOfCents(grossOnBoardCents, pctE2, rule, unit);
      snapshot = {
        allotmentUuid: allotment.allotmentUuid,
        percentage: allotment.value,
        basis: "earned_on_board_gross",
        baseAmount: centsToString(grossOnBoardCents),
      };
    } else {
      amountCents = roundCents(toCents(allotment.value), rule, unit);
      snapshot = { allotmentUuid: allotment.allotmentUuid, value: allotment.value };
    }
    lines.push(
      deductionLine(ctx, base, svcFrom, svcTo, lastState.rankId, el, amountCents,
        allotment.currency, "allotment", allotment.allotmentUuid, snapshot),
    );
  }

  // ---- Advance recoveries -------------------------------------------------
  const advances = (ctx.advancesByCrew.get(engagement.crewUuid) ?? [])
    .filter(
      (a) => !a.engagementUuid || a.engagementUuid === engagement.engagementUuid,
    )
    .sort((a, b) => a.advanceUuid.localeCompare(b.advanceUuid));
  for (const advance of advances) {
    const el =
      (advance.recoveryPayElementUuid
        ? ctx.elements.get(advance.recoveryPayElementUuid)
        : undefined) ?? categoryElement(ctx, "advance_recovery");
    if (!el) {
      errors.push("no active pay element with category 'advance_recovery'");
      break;
    }
    const rule = el.roundingRule as RoundingRule;
    const unit = precisionToUnitCents(el.roundingPrecision);
    const amountCents = roundCents(
      toCents(advance.recoveryAmount as string),
      rule,
      unit,
    );
    lines.push(
      deductionLine(ctx, base, svcFrom, svcTo, lastState.rankId, el, amountCents,
        advance.currency, "advance_recovery", advance.advanceUuid, {
          advanceUuid: advance.advanceUuid,
          recoveryAmount: advance.recoveryAmount,
        }),
    );
  }

  // ---- Bond / slop chest ---------------------------------------------------
  const bonds = (ctx.bondsByCrew.get(engagement.crewUuid) ?? [])
    .filter(
      (b) => !b.engagementUuid || b.engagementUuid === engagement.engagementUuid,
    )
    .sort((a, b) => a.bondItemUuid.localeCompare(b.bondItemUuid));
  for (const bond of bonds) {
    const el = categoryElement(ctx, "bond_slop_chest");
    if (!el) {
      errors.push("no active pay element with category 'bond_slop_chest'");
      break;
    }
    const rule = el.roundingRule as RoundingRule;
    const unit = precisionToUnitCents(el.roundingPrecision);
    const amountCents = roundCents(
      toCents(bond.deductionAmount ?? bond.totalPrice),
      rule,
      unit,
    );
    lines.push(
      deductionLine(ctx, base, svcFrom, svcTo, lastState.rankId, el, amountCents,
        bond.currency, "bond", bond.bondItemUuid, {
          bondItemUuid: bond.bondItemUuid,
          itemName: bond.itemName,
          deductionAmount: bond.deductionAmount ?? bond.totalPrice,
        }),
    );
  }

  return { engagement, lines, errors };
}

// ============================================================================
// Resolution helpers
// ============================================================================

function anniversaryDates(engagement: AccEngagementV2, upTo: string): string[] {
  if (!engagement.nextStepDate) return [];
  const dates: string[] = [];
  let d = engagement.nextStepDate;
  let guard = 0;
  while (d <= upTo && guard < 100) {
    dates.push(d);
    d = addMonths(d, 12);
    guard++;
  }
  return dates;
}

function rankAt(
  engagement: AccEngagementV2,
  promos: PromotionEvent[],
  date: string,
): string {
  let rank = engagement.rankIdAtStart as string;
  for (const p of promos) {
    if (
      p.effectiveDate > (engagement.startDate as string) &&
      p.effectiveDate <= date
    ) {
      rank = p.toRank;
    }
  }
  return rank;
}

function scaleYearAt(
  engagement: AccEngagementV2,
  anniversaries: string[],
  date: string,
): number {
  const start = engagement.scaleYearAtStart ?? 1;
  return start + anniversaries.filter((a) => a <= date).length;
}

function phaseAt(phases: AccEngagementPhaseV2[], date: string): string | null {
  let current: string | null = null;
  let currentFrom = "";
  for (const p of phases) {
    const from = p.fromDate as string;
    if (from <= date && from >= currentFrom) {
      if (p.toDate == null || p.toDate >= date) {
        current = p.phaseType;
        currentFrom = from;
      }
    }
  }
  return current;
}

function resolveScaleAt(
  ctx: CalcContext,
  startScaleUuid: string,
  date: string,
): string {
  let current = ctx.scaleByUuid.get(startScaleUuid);
  if (!current) return startScaleUuid;
  let guard = 0;
  while (current.supersededByScaleUuid && guard < 50) {
    const next = ctx.scaleByUuid.get(current.supersededByScaleUuid);
    if (
      next &&
      next.effectiveFrom != null &&
      next.effectiveFrom <= date &&
      (next.status === "active" || next.status === "superseded")
    ) {
      current = next;
      guard++;
    } else {
      break;
    }
  }
  return current.scaleUuid;
}

function scaleVersionBoundaries(
  ctx: CalcContext,
  startScaleUuid: string,
  from: string,
  to: string,
): string[] {
  const result: string[] = [];
  let current = ctx.scaleByUuid.get(startScaleUuid);
  let guard = 0;
  while (current?.supersededByScaleUuid && guard < 50) {
    const next = ctx.scaleByUuid.get(current.supersededByScaleUuid);
    if (!next) break;
    if (
      next.effectiveFrom != null &&
      next.effectiveFrom > from &&
      next.effectiveFrom <= to &&
      (next.status === "active" || next.status === "superseded")
    ) {
      result.push(next.effectiveFrom);
    }
    current = next;
    guard++;
  }
  return result;
}

/**
 * Resolve the effective pay-element entries for one segment: scale lines
 * (nationality-specific beats any; experience band by scale-year months),
 * then engagement overrides, then the nationality_conditional gate.
 */
function resolveEntries(
  ctx: CalcContext,
  engagement: AccEngagementV2,
  state: SegmentState,
  crewNat: string | null,
  overrides: AccEngagementPayElementV2[],
  errors: string[],
): Map<string, ResolvedEntry> {
  const entries = new Map<string, ResolvedEntry>();
  const scaleLines = (ctx.scaleLinesByScale.get(state.scaleUuid) ?? []).filter(
    (l) => l.rankId === state.rankId,
  );
  const months = (state.scaleYear - 1) * 12;
  const byElement = groupBy(scaleLines, (l) => l.payElementUuid);

  for (const [elementUuid, candidates] of byElement) {
    const element = ctx.elements.get(elementUuid);
    if (!element) continue; // inactive/unknown element: not applicable
    const natSpecific = crewNat
      ? candidates.filter((l) => l.nationalityUuid === crewNat)
      : [];
    const pool =
      natSpecific.length > 0
        ? natSpecific
        : candidates.filter((l) => l.nationalityUuid == null);
    const inBand = pool.filter(
      (l) =>
        (l.experienceMinMonths == null || months >= l.experienceMinMonths) &&
        (l.experienceMaxMonths == null || months <= l.experienceMaxMonths),
    );
    if (inBand.length === 0) continue;
    inBand.sort(
      (a, b) =>
        (b.experienceMinMonths ?? -1) - (a.experienceMinMonths ?? -1) ||
        a.scaleLineUuid.localeCompare(b.scaleLineUuid),
    );
    const line = inBand[0];
    entries.set(elementUuid, {
      element,
      amountE2: line.amount != null ? toCents(line.amount) : null,
      rateE4: line.rate != null ? parseScaled(line.rate, 4) : null,
      sourceType: "scale",
      sourceUuid: line.scaleLineUuid,
      scaleUuid: state.scaleUuid,
      scaleLineUuid: line.scaleLineUuid,
      epeUuid: null,
    });
  }

  // Engagement overrides effective in (overlapping) the sub-period.
  const active = overrides.filter(
    (o) =>
      (o.effectiveFrom == null || o.effectiveFrom <= state.to) &&
      (o.effectiveTo == null || o.effectiveTo >= state.from),
  );
  for (const o of active) {
    const element = ctx.elements.get(o.payElementUuid);
    if (!element) {
      errors.push(`override ${o.epeUuid}: unknown pay element`);
      continue;
    }
    if (o.overrideMode === "suppress_element") {
      entries.delete(o.payElementUuid);
    } else if (o.overrideMode === "replace_scale_value") {
      const existing = entries.get(o.payElementUuid);
      if (existing) {
        existing.amountE2 = o.amount != null ? toCents(o.amount) : existing.amountE2;
        existing.rateE4 = o.rate != null ? parseScaled(o.rate, 4) : existing.rateE4;
        existing.sourceType = "engagement_override";
        existing.sourceUuid = o.epeUuid;
        existing.epeUuid = o.epeUuid;
      }
    } else if (o.overrideMode === "add_element") {
      entries.set(o.payElementUuid, {
        element,
        amountE2: o.amount != null ? toCents(o.amount) : null,
        rateE4: o.rate != null ? parseScaled(o.rate, 4) : null,
        sourceType: "engagement_override",
        sourceUuid: o.epeUuid,
        scaleUuid: state.scaleUuid,
        scaleLineUuid: null,
        epeUuid: o.epeUuid,
      });
    }
  }

  // nationality_conditional gate.
  for (const [uuid, entry] of Array.from(entries)) {
    const el = entry.element;
    if (el.nationalityConditional) {
      const applicable = el.applicableNationalityUuids ?? [];
      if (!crewNat || !applicable.includes(crewNat)) entries.delete(uuid);
    }
  }

  return entries;
}

function sortedEntries(entries: Map<string, ResolvedEntry>): ResolvedEntry[] {
  return Array.from(entries.values()).sort((a, b) =>
    a.element.code.localeCompare(b.element.code),
  );
}

function resolveRateForElement(
  ctx: CalcContext,
  engagement: AccEngagementV2,
  state: SegmentState,
  crewNat: string | null,
  overrides: AccEngagementPayElementV2[],
  elementUuid: string,
): number | null {
  const entries = resolveEntries(ctx, engagement, state, crewNat, overrides, []);
  return entries.get(elementUuid)?.rateE4 ?? null;
}

function categoryElement(
  ctx: CalcContext,
  category: string,
): AccPayElementV2 | undefined {
  return ctx.elementsByCategory.get(category)?.[0];
}

// ============================================================================
// Line construction
// ============================================================================

// Money columns on engine-written lines are never null. No FX-rate source
// exists in the schema yet, so cross-currency lines deterministically record
// a placeholder rate of 1.000000 (amount mirrored into amount_functional)
// and flag it in calc_snapshot.fxNote for reviewers.
function fxColumns(
  currency: string,
  amount: string,
  config: EngineConfig,
  snapshot: Record<string, unknown>,
): { fxRate: string; amountFunctional: string } {
  if (currency === config.functionalCurrency) {
    return { fxRate: "1.000000", amountFunctional: amount };
  }
  snapshot.fxNote = `cross-currency (${currency} -> ${config.functionalCurrency}) conversion not performed; placeholder fx_rate 1.000000 applied (no FX rate source); fx policy ${config.fxRatePolicy}`;
  return { fxRate: "1.000000", amountFunctional: amount };
}

function fxFor(
  currency: string,
  amount: string,
  config: EngineConfig,
): { fxRate: string; amountFunctional: string; note?: string } {
  if (currency === config.functionalCurrency) {
    return { fxRate: "1.000000", amountFunctional: amount };
  }
  return {
    fxRate: "1.000000",
    amountFunctional: amount,
    note: `cross-currency (${currency} -> ${config.functionalCurrency}) conversion not performed; placeholder fx_rate 1.000000 applied (no FX rate source); fx policy ${config.fxRatePolicy}`,
  };
}

function withConfig(
  ctx: CalcContext,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...snapshot,
    prorationBasis: ctx.config.prorationBasis,
    dayInclusionRule: ctx.config.dayInclusionRule,
  };
}

function mkLine(
  ctx: CalcContext,
  engagement: AccEngagementV2,
  entry: ResolvedEntry,
  args: {
    engagementUuid: string;
    crewUuid: string;
    vesselUuid: string | null;
    period: string;
    periodFrom: string;
    periodTo: string;
    daysBasis: number | null;
    daysServed: string | null;
    rankId: string;
    amountCents: number;
    snapshot: Record<string, unknown>;
  },
): EngineLine {
  const el = entry.element;
  const scale = ctx.scaleByUuid.get(entry.scaleUuid);
  const currency = scale?.currency ?? engagement.currency;
  const amount = centsToString(args.amountCents);
  const snapshot: Record<string, unknown> = {
    ...args.snapshot,
    scaleUuid: entry.scaleUuid,
    scaleLineUuid: entry.scaleLineUuid,
    epeUuid: entry.epeUuid,
    roundingRule: el.roundingRule,
    roundingPrecision: el.roundingPrecision,
  };
  const fx = fxColumns(currency, amount, ctx.config, snapshot);
  return {
    engagementUuid: args.engagementUuid,
    crewUuid: args.crewUuid,
    vesselUuid: args.vesselUuid,
    period: args.period,
    periodFrom: args.periodFrom,
    periodTo: args.periodTo,
    daysBasis: args.daysBasis,
    daysServed: args.daysServed,
    rankId: args.rankId,
    payElementUuid: el.payElementUuid,
    elementType: el.type,
    elementCode: el.code,
    paymentTiming: el.paymentTiming,
    qty: null,
    rate: null,
    amount,
    currency,
    fxRate: fx.fxRate,
    amountFunctional: fx.amountFunctional,
    sourceType: entry.sourceType,
    sourceUuid: entry.sourceUuid,
    calcSnapshot: withConfig(ctx, snapshot),
    isAdjustment: false,
    adjustsLedgerUuid: null,
  };
}

function deductionLine(
  ctx: CalcContext,
  base: {
    engagementUuid: string;
    crewUuid: string;
    vesselUuid: string | null;
    period: string;
  },
  periodFrom: string,
  periodTo: string,
  rankId: string,
  el: AccPayElementV2,
  amountCents: number,
  currency: string,
  sourceType: string,
  sourceUuid: string,
  snapshot: Record<string, unknown>,
): EngineLine {
  const amount = centsToString(amountCents);
  const snap: Record<string, unknown> = { ...snapshot };
  const fx = fxColumns(currency, amount, ctx.config, snap);
  return {
    ...base,
    periodFrom,
    periodTo,
    daysBasis: null,
    daysServed: null,
    rankId,
    payElementUuid: el.payElementUuid,
    elementType: el.type,
    elementCode: el.code,
    paymentTiming: el.paymentTiming,
    qty: null,
    rate: null,
    amount,
    currency,
    fxRate: fx.fxRate,
    amountFunctional: fx.amountFunctional,
    sourceType,
    sourceUuid,
    calcSnapshot: withConfig(ctx, snap),
    isAdjustment: false,
    adjustsLedgerUuid: null,
  };
}

// ============================================================================
// Totals
// ============================================================================

function summarizeCrew(result: EngagementResult): CrewTotals {
  let gross = 0;
  let deductions = 0;
  let settlement = 0;
  let fund = 0;
  let rankId: string | null = null;
  for (const l of result.lines) {
    const cents = toCents(l.amount);
    if (l.paymentTiming === "remitted_to_fund") {
      fund += cents;
      continue;
    }
    if (l.elementType === "deduction") {
      deductions += cents;
    } else if (l.elementType === "earning") {
      if (l.paymentTiming === "payable_at_settlement") settlement += cents;
      else gross += cents;
    }
    rankId = l.rankId ?? rankId;
  }
  return {
    crewUuid: result.engagement.crewUuid,
    engagementUuid: result.engagement.engagementUuid,
    rankId,
    earnedGross: centsToString(gross),
    deductions: centsToString(deductions),
    netOnBoard: centsToString(gross - deductions),
    settlementAccrual: centsToString(settlement),
    fundRemittance: centsToString(fund),
  };
}

function portageTotals(lines: InsertAccWageLedgerV2[]): {
  totalEarnings: string;
  totalDeductions: string;
  netTotal: string;
} {
  let earnings = 0;
  let deductions = 0;
  for (const l of lines) {
    if (l.isAdjustment) continue;
    const cents = toCents(l.amount);
    if (l.paymentTiming === "remitted_to_fund") continue;
    if (l.elementType === "earning" && l.paymentTiming === "paid_on_board") {
      earnings += cents;
    } else if (l.elementType === "deduction") {
      deductions += cents;
    }
  }
  return {
    totalEarnings: centsToString(earnings),
    totalDeductions: centsToString(deductions),
    netTotal: centsToString(earnings - deductions),
  };
}
