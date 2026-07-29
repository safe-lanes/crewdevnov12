import { v4 as uuidv4 } from "uuid";
import { EngineReads, type PromotionEvent } from "./engineReads";
import { LedgerRepository } from "./ledgerRepository";
import { BalanceService } from "./balanceService";
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
  AccCalculationRunV2,
  AccPortageBillV2,
  AccSettlementV2,
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
  /** advance_uuid -> cents recovered in periods strictly before this run. */
  advancePriorRecoveredCents: Map<string, number>;
  nationalityByCrew: Map<string, string | null>;
  nationalityNames: Map<string, string>;
}

/** Ledger line before run/portage identifiers are attached. */
type EngineLine = Omit<
  InsertAccWageLedgerV2,
  "ledgerUuid" | "calcRunUuid" | "portageUuid"
>;

/** Structured engine warning (persisted on the run row for later display). */
export interface EngagementWarning {
  code: string;
  message: string;
}

interface EngagementResult {
  engagement: AccEngagementV2;
  lines: EngineLine[];
  errors: string[];
  warnings: EngagementWarning[];
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
  /** Derived from the ledger (never stored): prior net carried forward. */
  balanceBf: string;
  balanceCf: string;
  leaveBf: string;
  leaveThisMonth: string;
  leaveCf: string;
}

/** CrewTotals before the async balance enrichment. */
type CrewBaseTotals = Omit<
  CrewTotals,
  "balanceBf" | "balanceCf" | "leaveBf" | "leaveThisMonth" | "leaveCf"
>;

/** Engagement excluded from a vessel-period run because it is settled. */
export interface SkippedSettled {
  engagementUuid: string;
  crewUuid: string;
  crewName: string | null;
  settlementUuid: string;
  status: string;
}

export interface RunSummary {
  run: AccCalculationRunV2;
  portage?: AccPortageBillV2;
  lineCount: number;
  crewTotals: CrewTotals[];
  warnings: string[];
  /** Informational: engagements skipped because a final settlement froze them. */
  skippedSettled?: SkippedSettled[];
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
  /** Effective timing: element default unless payment_timing_override applies. */
  paymentTiming: string;
  timingEpeUuid: string | null;
  /** Fix (c): replace_scale_value applied without a base scale line. */
  replaceFallbackWarning?: boolean;
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
const balanceService = new BalanceService();

/** Inclusive date-range overlap; a null end date means open-ended. */
function rangesOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null,
): boolean {
  return (bEnd == null || aStart <= bEnd) && (aEnd == null || bStart <= aEnd);
}

/**
 * Settlement freeze guard (amendment to Prompt 05): once a final settlement
 * is submitted (or beyond), the engine refuses to re-run any period of that
 * engagement — a re-run would silently diverge the ledger from the payout.
 * Overlap-aware: a frozen settlement on ANY same-crew engagement whose
 * service window overlaps a run engagement's window also freezes the run —
 * pre-existing overlap data must not bypass the guard.
 */
async function findFrozenSettlementsFor(
  engagements: AccEngagementV2[],
): Promise<{ frozen: AccSettlementV2[]; frozenEngagementUuids: Set<string> }> {
  if (engagements.length === 0) {
    return { frozen: [], frozenEngagementUuids: new Set() };
  }
  const crewUuids = [...new Set(engagements.map((e) => e.crewUuid))];
  const crewEngagements = await reads.findEngagementsByCrewUuids(crewUuids);
  const candidateUuids = new Set(engagements.map((e) => e.engagementUuid));
  for (const e of engagements) {
    if (!e.startDate) continue;
    for (const other of crewEngagements) {
      if (
        other.crewUuid === e.crewUuid &&
        other.engagementUuid !== e.engagementUuid &&
        other.startDate != null &&
        rangesOverlap(
          e.startDate,
          e.endDate ?? null,
          other.startDate,
          other.endDate ?? null,
        )
      ) {
        candidateUuids.add(other.engagementUuid);
      }
    }
  }
  const frozen = await reads.findFrozenSettlements([...candidateUuids]);
  const frozenEngagementUuids = new Set(frozen.map((s) => s.engagementUuid));
  // A frozen settlement on a same-crew overlapping engagement also freezes
  // the run engagement itself (overlap data must not bypass the guard).
  for (const e of engagements) {
    if (frozenEngagementUuids.has(e.engagementUuid)) continue;
    if (!e.startDate) continue;
    for (const other of crewEngagements) {
      if (
        other.crewUuid === e.crewUuid &&
        other.engagementUuid !== e.engagementUuid &&
        frozenEngagementUuids.has(other.engagementUuid) &&
        other.startDate != null &&
        rangesOverlap(
          e.startDate,
          e.endDate ?? null,
          other.startDate,
          other.endDate ?? null,
        )
      ) {
        frozenEngagementUuids.add(e.engagementUuid);
        break;
      }
    }
  }
  return { frozen, frozenEngagementUuids };
}

/**
 * Hard guard for explicit single-engagement recompute: targeting a settled
 * engagement directly is a genuine conflict and still refuses.
 */
async function assertNoFrozenSettlements(
  engagements: AccEngagementV2[],
): Promise<void> {
  const { frozen } = await findFrozenSettlementsFor(engagements);
  if (frozen.length === 0) return;
  const names = await reads.findCrewNames(frozen.map((s) => s.crewUuid));
  const parts = frozen.map(
    (s) =>
      `${names.get(s.crewUuid) ?? s.crewUuid} (settlement ${s.settlementUuid}, ${s.status})`,
  );
  throw new EngineError(
    "CONFLICT",
    `Period is frozen by final settlement(s): ${parts.join("; ")}. Lock the portage bill around the settled engagement, or revert the settlement to draft (only possible while submitted) before re-running.`,
    {
      settlements: frozen.map((s) => ({
        settlementUuid: s.settlementUuid,
        engagementUuid: s.engagementUuid,
        crewUuid: s.crewUuid,
        status: s.status,
      })),
    },
  );
}

/**
 * Vessel-period partition (per-engagement settlement skip): frozen
 * engagements are excluded from recompute — their existing ledger lines are
 * preserved exactly — while everyone else stays computable.
 */
async function partitionBySettlement(engagements: AccEngagementV2[]): Promise<{
  computable: AccEngagementV2[];
  frozenEngagements: AccEngagementV2[];
  skippedSettled: SkippedSettled[];
}> {
  const { frozen, frozenEngagementUuids } =
    await findFrozenSettlementsFor(engagements);
  if (frozen.length === 0) {
    return { computable: engagements, frozenEngagements: [], skippedSettled: [] };
  }
  const computable = engagements.filter(
    (e) => !frozenEngagementUuids.has(e.engagementUuid),
  );
  const frozenEngagements = engagements.filter((e) =>
    frozenEngagementUuids.has(e.engagementUuid),
  );
  const names = await reads.findCrewNames(
    frozenEngagements.map((e) => e.crewUuid),
  );
  const settlementByEngagement = new Map(
    frozen.map((s) => [s.engagementUuid, s]),
  );
  const skippedSettled: SkippedSettled[] = frozenEngagements.map((e) => {
    // Direct settlement if present; otherwise the overlapping engagement's
    // settlement that froze this one (same crew).
    const s =
      settlementByEngagement.get(e.engagementUuid) ??
      frozen.find((f) => f.crewUuid === e.crewUuid) ??
      frozen[0];
    return {
      engagementUuid: e.engagementUuid,
      crewUuid: e.crewUuid,
      crewName: names.get(e.crewUuid) ?? null,
      settlementUuid: s.settlementUuid,
      status: s.status,
    };
  });
  return { computable, frozenEngagements, skippedSettled };
}

/** Statuses whose date ranges may not overlap for the same crew. */
const LIVE_OVERLAP_STATUSES = new Set(["draft", "active", "completed"]);

/**
 * Overlap guard (Task 120): a crew member with two live engagements covering
 * the same dates would double-count wages, so the run refuses until the
 * overlap is resolved (cancel or end-date one of the engagements).
 */
async function assertNoOverlappingEngagements(
  engagements: AccEngagementV2[],
): Promise<void> {
  const live = engagements.filter((e) =>
    LIVE_OVERLAP_STATUSES.has(e.status),
  );
  if (live.length === 0) return;
  const crewUuids = [...new Set(live.map((e) => e.crewUuid))];
  const crewEngagements = await reads.findEngagementsByCrewUuids(crewUuids);
  const conflicts: string[] = [];
  for (const e of live) {
    if (!e.startDate) continue;
    for (const other of crewEngagements) {
      if (
        other.crewUuid === e.crewUuid &&
        other.engagementUuid !== e.engagementUuid &&
        LIVE_OVERLAP_STATUSES.has(other.status) &&
        other.startDate != null &&
        rangesOverlap(
          e.startDate,
          e.endDate ?? null,
          other.startDate,
          other.endDate ?? null,
        )
      ) {
        conflicts.push(
          `${e.crewUuid}: ${e.engagementUuid} overlaps ${other.engagementUuid} (${other.startDate} – ${other.endDate ?? "open"}, ${other.status})`,
        );
      }
    }
  }
  if (conflicts.length > 0) {
    throw new EngineError(
      "CONFLICT",
      `Run blocked by overlapping open engagements — resolve via the engagement overlap audit first: ${conflicts.join("; ")}`,
    );
  }
}

/** Run-row warnings payload: structured, crew-attributed (0159). */
function persistableWarnings(results: EngagementResult[]) {
  return results.flatMap((r) =>
    r.warnings.map((w) => ({
      crewUuid: r.engagement.crewUuid,
      engagementUuid: r.engagement.engagementUuid,
      code: w.code,
      message: w.message,
    })),
  );
}

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
    const allEngagements = await reads.findEngagementsForVesselPeriod(
      vesselUuid,
      month.monthStart,
      month.monthEnd,
    );
    // Per-engagement settlement skip: frozen (settled) engagements are
    // excluded from recompute; their existing ledger lines are preserved.
    const { computable: engagements, frozenEngagements, skippedSettled } =
      await partitionBySettlement(allEngagements);
    await assertNoOverlappingEngagements(engagements);
    const ctx = await buildContext(config, month, engagements);

    const results = engagements
      .slice()
      .sort((a, b) => a.engagementUuid.localeCompare(b.engagementUuid))
      .map((e) => calcEngagement(ctx, e));
    const errors = results.flatMap((r) =>
      r.errors.map((m) => `${r.engagement.engagementUuid}: ${m}`),
    );
    const warnings = results.flatMap((r) =>
      r.warnings.map((w) => `${r.engagement.engagementUuid}: ${w.message}`),
    );
    const runWarnings = persistableWarnings(results);

    const inputSnapshot = buildInputSnapshot(config, period, {
      vesselUuid,
      engagementUuids: results.map((r) => r.engagement.engagementUuid),
      skippedSettledEngagementUuids: frozenEngagements
        .map((e) => e.engagementUuid)
        .sort(),
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
        warnings: runWarnings,
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
    // Run-status lifecycle: create as "running", flip to "completed" only
    // after the line replacement commits; a failed replacement marks the run
    // "failed" and leaves the prior lines intact.
    const run = await ledgerRepo.createRun({
      portageUuid: portage.portageUuid,
      engagementUuid: null,
      runType,
      runDate: new Date(),
      runByUuid: auditUserUuid ?? null,
      inputSnapshot,
      status: "running",
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

    try {
      await ledgerRepo.replacePortageLines(
        portage.portageUuid,
        allLines,
        { updatedByUuid: auditUserUuid ?? null },
        {
          // Engagement-scoped replacement: only the computable engagements'
          // lines are deleted/regenerated; frozen (settled) engagements'
          // lines are preserved exactly as-is.
          replaceEngagementUuids: engagements.map((e) => e.engagementUuid),
          // Cached totals recompute from the FULL ledger (preserved frozen
          // lines + fresh lines), so the portage bill still shows the
          // settled crew's final figures alongside the recomputed rest.
          computeTotals: (fullLedgerLines) => {
            const totals = portageTotals(fullLedgerLines);
            return {
              crewCount: new Set(
                fullLedgerLines
                  .filter((l) => !l.isAdjustment)
                  .map((l) => l.crewUuid),
              ).size,
              totalEarnings: totals.totalEarnings,
              totalDeductions: totals.totalDeductions,
              netTotal: totals.netTotal,
            };
          },
        },
      );
    } catch (error) {
      await ledgerRepo.updateRun(run.calcRunUuid, {
        status: "failed",
        errorDetail: error instanceof Error ? error.message : String(error),
        updatedByUuid: auditUserUuid ?? null,
      });
      throw error;
    }
    const completedRun =
      (await ledgerRepo.updateRun(run.calcRunUuid, {
        status: "completed",
        warnings: runWarnings,
        updatedByUuid: auditUserUuid ?? null,
      })) ?? run;

    const crewTotals = await withBalances(
      ctx,
      results.filter((r) => r.lines.length > 0),
      period,
    );

    return {
      run: completedRun,
      portage,
      lineCount: allLines.length,
      crewTotals,
      warnings,
      skippedSettled,
    };
  },

  /**
   * Single-engagement run.  When a portage bill already exists for the
   * engagement's vessel + period the lines are attached to it (scoped
   * replacePortageLines) so the crew member is never silently dropped from the
   * bill.  When no portage exists yet the lines are stored as unattached
   * preview lines (portage_uuid IS NULL); a later full vessel-period run will
   * promote them and clean up the preview rows (replacePortageLines also
   * deletes portage_uuid IS NULL rows for replaced engagements).
   */
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
    // Hoist the portage lookup so we can reuse the result when building lines.
    let portageForEngagement: AccPortageBillV2 | undefined;
    if (engagement.vesselUuid) {
      portageForEngagement = await ledgerRepo.findPortage(
        engagement.vesselUuid,
        period,
      );
      if (
        portageForEngagement &&
        (portageForEngagement.isLocked || portageForEngagement.status === "locked")
      ) {
        throw new EngineError(
          "CONFLICT",
          `Portage bill for vessel ${engagement.vesselUuid} period ${period} is locked; the engine refuses to run against it`,
        );
      }
    }

    await assertNoFrozenSettlements([engagement]);
    await assertNoOverlappingEngagements([engagement]);
    const configRow = await reads.getConfig();
    const config = toEngineConfig(configRow);
    const ctx = await buildContext(config, month, [engagement]);
    const result = calcEngagement(ctx, engagement);
    const runWarnings = persistableWarnings([result]);

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
        warnings: runWarnings,
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
      status: "running",
      createdByUuid: auditUserUuid ?? null,
    });

    // Attach lines to the portage when one exists, so the crew member stays on
    // the portage bill and totals are refreshed.  Without a portage, fall back
    // to unattached preview lines (portage_uuid IS NULL).
    const allLines: InsertAccWageLedgerV2[] = result.lines.map((line) => ({
      ...line,
      ledgerUuid: uuidv4(),
      calcRunUuid: run.calcRunUuid,
      portageUuid: portageForEngagement
        ? portageForEngagement.portageUuid
        : null,
      createdByUuid: auditUserUuid ?? null,
    }));
    try {
      if (portageForEngagement) {
        // Portage exists: scoped single-engagement replacement keeps the crew
        // member on the portage bill.  replacePortageLines handles the lock
        // re-check, settlement-freeze guard, preview-line cleanup, and totals
        // refresh in a single transaction.
        await ledgerRepo.replacePortageLines(
          portageForEngagement.portageUuid,
          allLines,
          { updatedByUuid: auditUserUuid ?? null },
          {
            replaceEngagementUuids: [engagementUuid],
            computeTotals: (fullLedgerLines) => {
              const totals = portageTotals(fullLedgerLines);
              return {
                crewCount: new Set(
                  fullLedgerLines
                    .filter((l) => !l.isAdjustment)
                    .map((l) => l.crewUuid),
                ).size,
                totalEarnings: totals.totalEarnings,
                totalDeductions: totals.totalDeductions,
                netTotal: totals.netTotal,
              };
            },
          },
        );
      } else {
        // No portage yet: preview mode — lines stored unattached.  A later full
        // vessel-period run will promote them (replacePortageLines cleans up
        // portage_uuid IS NULL rows for the replaced engagements).
        await ledgerRepo.replacePreviewLines(
          engagementUuid,
          period,
          allLines,
        );
      }
    } catch (error) {
      await ledgerRepo.updateRun(run.calcRunUuid, {
        status: "failed",
        errorDetail: error instanceof Error ? error.message : String(error),
        updatedByUuid: auditUserUuid ?? null,
      });
      throw error;
    }
    const completedRun =
      (await ledgerRepo.updateRun(run.calcRunUuid, {
        status: "completed",
        warnings: runWarnings,
        updatedByUuid: auditUserUuid ?? null,
      })) ?? run;

    return {
      run: completedRun,
      lineCount: allLines.length,
      crewTotals:
        result.lines.length > 0 ? await withBalances(ctx, [result], period) : [],
      warnings: result.warnings.map((w) => `${engagementUuid}: ${w.message}`),
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

  /**
   * Rebuild per-crew totals (incl. derived balances) from the stored ledger
   * lines of an existing portage — used to reload the run workspace without
   * re-running the engine. Bucketing mirrors summarizeCrew/withBalances.
   */
  async summaryForPortage(
    portageUuid: string,
    period: string,
  ): Promise<CrewTotals[]> {
    const lines = await ledgerRepo.findLinesByPortage(portageUuid);
    const categories = await reads.findElementCategories(
      Array.from(new Set(lines.map((l) => l.payElementUuid))),
    );
    const byEngagement = new Map<string, typeof lines>();
    for (const l of lines) {
      const list = byEngagement.get(l.engagementUuid);
      if (list) list.push(l);
      else byEngagement.set(l.engagementUuid, [l]);
    }
    const out: CrewTotals[] = [];
    for (const [engagementUuid, engLines] of byEngagement) {
      let gross = 0;
      let deductions = 0;
      let settlement = 0;
      let fund = 0;
      let leaveThisCents = 0;
      let rankId: string | null = null;
      for (const l of engLines) {
        const cents = toCents(l.amount);
        if (l.paymentTiming === "remitted_to_fund") {
          fund += cents;
          continue;
        }
        if (l.elementType === "deduction") {
          deductions += cents;
        } else if (
          l.elementType === "earning" ||
          l.elementType === "employer_contribution"
        ) {
          if (l.paymentTiming === "payable_at_settlement") {
            settlement += cents;
            if (
              l.elementType === "earning" &&
              categories.get(l.payElementUuid) === "leave"
            ) {
              leaveThisCents += cents;
            }
          } else {
            gross += cents;
          }
        }
        rankId = l.rankId ?? rankId;
      }
      const prior = await balanceService.priorBalances(engagementUuid, period);
      const netCents = gross - deductions;
      const balanceCfCents =
        prior.balanceBfCents + netCents - prior.settlementsAtPeriodCents;
      out.push({
        crewUuid: engLines[0].crewUuid,
        engagementUuid,
        rankId,
        earnedGross: centsToString(gross),
        deductions: centsToString(deductions),
        netOnBoard: centsToString(netCents),
        settlementAccrual: centsToString(settlement),
        fundRemittance: centsToString(fund),
        balanceBf: centsToString(prior.balanceBfCents),
        balanceCf: centsToString(balanceCfCents),
        leaveBf: centsToString(prior.leaveBfCents),
        leaveThisMonth: centsToString(leaveThisCents),
        leaveCf: centsToString(
          prior.leaveBfCents + leaveThisCents - prior.leaveSettledAtPeriodCents,
        ),
      });
    }
    return out;
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
    priorRecoveryLines,
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
    reads.findPriorRecoveryLines(crewUuids, month.period),
    reads.findCrewNationalities(crewUuids),
  ]);

  // Prior recovered per advance (clamp basis, spec Prompt 07 2b). Preview
  // lines (portage_uuid IS NULL) are not cleaned up when the same month is
  // later run for a portage, so per (advance, period) we count only the
  // portage-attached lines when any exist, else the preview lines —
  // counting both would double-count a month.
  const advancePriorRecoveredCents = new Map<string, number>();
  {
    const byAdvancePeriod = new Map<string, typeof priorRecoveryLines>();
    for (const line of priorRecoveryLines) {
      if (!line.sourceUuid) continue;
      const key = `${line.sourceUuid}|${line.period}`;
      const list = byAdvancePeriod.get(key);
      if (list) list.push(line);
      else byAdvancePeriod.set(key, [line]);
    }
    for (const [key, group] of byAdvancePeriod) {
      const advanceUuid = key.slice(0, key.indexOf("|"));
      const portageLines = group.filter((l) => l.portageUuid != null);
      const counted = portageLines.length > 0 ? portageLines : group;
      const sum = counted.reduce((s, l) => s + toCents(l.amount), 0);
      advancePriorRecoveredCents.set(
        advanceUuid,
        (advancePriorRecoveredCents.get(advanceUuid) ?? 0) + sum,
      );
    }
  }

  const nationalityNames = await reads.findNationalityNames([
    ...Array.from(nationalityByCrew.values()).filter(
      (v): v is string => v != null,
    ),
    ...scaleLines
      .map((l) => l.nationalityUuid)
      .filter((v): v is string => v != null),
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
    advancePriorRecoveredCents,
    nationalityByCrew,
    nationalityNames,
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
  const warnings: EngagementWarning[] = [];
  const { month, config } = ctx;

  if (!engagement.startDate || !parseIsoDate(engagement.startDate)) {
    return {
      engagement,
      lines: [],
      errors: [`invalid or missing start_date (${engagement.startDate})`],
      warnings,
    };
  }
  if (engagement.endDate && !parseIsoDate(engagement.endDate)) {
    return {
      engagement,
      lines: [],
      errors: [`invalid end_date (${engagement.endDate})`],
      warnings,
    };
  }
  if (!engagement.wageScaleUuid) {
    return {
      engagement,
      lines: [],
      errors: ["engagement has no wage scale"],
      warnings,
    };
  }
  if (!engagement.rankIdAtStart) {
    return {
      engagement,
      lines: [],
      errors: ["engagement has no rank_id_at_start"],
      warnings,
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
  if (svcFrom > svcTo) return { engagement, lines: [], errors: [], warnings };
  if (
    config.dayInclusionRule === "exclude_sign_off_day" &&
    engagement.endDate &&
    engagement.endDate <= month.monthEnd &&
    engagement.endDate >= month.monthStart
  ) {
    svcTo = addDays(engagement.endDate, -1);
    if (svcTo < svcFrom) return { engagement, lines: [], errors: [], warnings };
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
    const entries = resolveEntries(ctx, engagement, state, crewNat, overrides, errors, warnings);
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
    const txnTiming = effectiveTiming(el, overrides, svcFrom, svcTo);
    snapshot.paymentTiming = txnTiming.timing;
    if (txnTiming.epeUuid) {
      snapshot.paymentTimingOverriddenBy = txnTiming.epeUuid;
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
      paymentTiming: txnTiming.timing,
      qty,
      rate: rateStr,
      amount: centsToString(amountCents),
      currency: txn.currency,
      ...fxColumns(txn.currency, centsToString(amountCents), ctx.config, snapshot),
      // Bond rollup transactions keep their 'bond' source tag on the ledger
      // line so bond deductions stay traceable (spec Prompt 07 2a).
      sourceType: txn.sourceType === "bond" ? "bond" : "monthly_txn",
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
  // Lifecycle (spec Prompt 07 2c): only status='active' allotments (read
  // filter) whose validity window overlaps the month post — suspended/ended
  // post nothing. The full monthly value posts whenever valid: no proration.
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
  // Clamp (spec Prompt 07 2b): posted = min(recovery_amount, outstanding),
  // outstanding = advance amount − Σ recovery lines posted in periods
  // strictly BEFORE this run (deterministic across replacement re-runs of
  // an unlocked month). Fully recovered ⇒ no line.
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
    const totalCents = toCents(advance.amount as string);
    const priorCents =
      ctx.advancePriorRecoveredCents.get(advance.advanceUuid) ?? 0;
    const outstandingCents = totalCents - priorCents;
    if (outstandingCents <= 0) continue; // fully recovered — no line
    const recoveryCents = roundCents(
      toCents(advance.recoveryAmount as string),
      rule,
      unit,
    );
    const amountCents = Math.min(recoveryCents, outstandingCents);
    if (amountCents <= 0) continue;
    lines.push(
      deductionLine(ctx, base, svcFrom, svcTo, lastState.rankId, el, amountCents,
        advance.currency, "advance_recovery", advance.advanceUuid, {
          advanceUuid: advance.advanceUuid,
          advanceAmount: advance.amount,
          recoveryAmount: advance.recoveryAmount,
          priorRecovered: centsToString(priorCents),
          outstandingBefore: centsToString(outstandingCents),
          clamped: amountCents < recoveryCents,
        }),
    );
  }

  // ---- Bond / slop chest ---------------------------------------------------
  // Single-posting-path (spec Prompt 07 2a): bond items are NOT posted
  // directly. bondItemsService maintains ONE rolled-up monthly transaction
  // per crew-month (source_type='bond', element category bond_slop_chest),
  // which posts through the accepted-transaction loop above. If a manual
  // bond-category transaction coexists with the rollup, warn — don't block.
  const bondCatTxns = txns.filter(
    (t) => ctx.elements.get(t.payElementUuid)?.category === "bond_slop_chest",
  );
  if (
    bondCatTxns.some((t) => t.sourceType === "bond") &&
    bondCatTxns.some((t) => t.sourceType !== "bond")
  ) {
    warnings.push({
      code: "bond_double_entry",
      message: `possible bond double entry for crew ${engagement.crewUuid} in ${ctx.month.period}: the crew-month has both a bond rollup transaction and manual bond-category transaction(s)`,
    });
  }

  // Safety net (spec Prompt 04, extended Task 144): a served period that
  // resolves ZERO scale-sourced wage lines must be surfaced as a diagnostic,
  // never a silent green run — even when transaction/allotment/advance
  // deduction lines still post (e.g. every scale element fell to the
  // nationality_conditional gate).
  const hasWageLines = lines.some(
    (l) => l.sourceType === "scale" || l.sourceType === "engagement_override",
  );
  if (!hasWageLines && errors.length === 0) {
    // Diagnose against the effective segment context (rank/scale/year as of
    // the last served segment), not the engagement start anchors — a mid-month
    // promotion or scale supersession must name the rank/scale actually used.
    const diagState = [...states].reverse().find((s) => s.days > 0) ?? lastState;
    const scaleLines = (
      ctx.scaleLinesByScale.get(diagState.scaleUuid) ?? []
    ).filter((l) => l.rankId === diagState.rankId);
    let detail =
      scaleLines.length === 0
        ? `no scale lines for rank ${diagState.rankId} on the assigned wage scale`
        : diagnoseSkip(ctx, engagement, scaleLines, diagState);
    // Task 148: if the served scale has a superseding revision that the
    // supersession chain can never reach (missing effective_from), name it —
    // that revision is almost always where the missing lines live.
    const unreachable = unreachableRevision(ctx, diagState.scaleUuid);
    if (unreachable) {
      detail += `; note: scale "${ctx.scaleByUuid.get(diagState.scaleUuid)?.scaleName ?? diagState.scaleUuid}" is superseded by "${unreachable.scaleName}" which has no Effective From date, so the revision is never applied — set its Effective From to make it reachable`;
    }
    warnings.push(
      lines.length === 0
        ? { code: "engagement_skipped", message: `skipped: ${detail}` }
        : {
            code: "no_scale_wages",
            message: `no scale wages posted (other lines posted): ${detail}`,
          },
    );
  }

  // Negative net (Prompt 07 follow-up): a crew-month whose deductions exceed the
  // paid-on-board earnings is legal but almost always an over-allotment or
  // over-recovery — warn, never block. Bucketing mirrors summarizeCrew so
  // the warning always agrees with the net_on_board shown in Step 2.
  const netTotals = summarizeCrew({ engagement, lines, errors, warnings: [] });
  if (toCents(netTotals.netOnBoard) < 0) {
    warnings.push({
      code: "negative_net",
      message: `negative net payable on board for crew ${engagement.crewUuid} in ${ctx.month.period}: ${netTotals.netOnBoard} (gross ${netTotals.earnedGross} − deductions ${netTotals.deductions})`,
    });
  }

  return { engagement, lines, errors, warnings };
}

/**
 * One-line diagnosis of WHY rank-matching scale lines produced no ledger
 * lines: names the failed match dimension (nationality or scale year).
 */
function diagnoseSkip(
  ctx: CalcContext,
  engagement: AccEngagementV2,
  scaleLines: AccWageScaleLineV2[],
  state?: { rankId: string | null; scaleYear: number },
): string {
  const rank = state?.rankId ?? engagement.rankIdAtStart;
  const crewNat = ctx.nationalityByCrew.get(engagement.crewUuid) ?? null;
  const natName = (uuid: string | null) =>
    uuid == null ? "any" : (ctx.nationalityNames.get(uuid) ?? uuid);

  // Nationality dimension: lines usable for this crew member are the
  // nationality-specific ones (if any) else the nationality-agnostic pool.
  const natSpecific = crewNat
    ? scaleLines.filter((l) => l.nationalityUuid === crewNat)
    : [];
  const natAgnostic = scaleLines.filter((l) => l.nationalityUuid == null);
  const pool = natSpecific.length > 0 ? natSpecific : natAgnostic;
  if (pool.length === 0) {
    const available = Array.from(
      new Set(
        scaleLines
          .map((l) => l.nationalityUuid)
          .filter((v): v is string => v != null)
          .map((v) => natName(v)),
      ),
    );
    return `no scale line for rank ${rank} matching nationality ${natName(crewNat)} (lines exist only for: ${available.join(", ") || "none"})`;
  }

  // Scale-year / experience-band dimension.
  const scaleYear = state?.scaleYear ?? engagement.scaleYearAtStart ?? 1;
  const months = (scaleYear - 1) * 12;
  const inBand = pool.filter(
    (l) =>
      (l.experienceMinMonths == null || months >= l.experienceMinMonths) &&
      (l.experienceMaxMonths == null || months <= l.experienceMaxMonths),
  );
  if (inBand.length === 0) {
    const years = pool.map((l) => ({
      min: l.experienceMinMonths == null ? 1 : Math.floor(l.experienceMinMonths / 12) + 1,
      max: l.experienceMaxMonths == null ? null : Math.floor(l.experienceMaxMonths / 12) + 1,
    }));
    const minYear = Math.min(...years.map((y) => y.min));
    const maxYear = years.some((y) => y.max == null)
      ? null
      : Math.max(...years.map((y) => y.max!));
    return `no scale line for rank ${rank} matching scale year ${scaleYear} (lines cover years ${minYear}–${maxYear ?? "open"})`;
  }

  // Nationality-conditional element gate (Task 144): scale lines matched the
  // crew member on every line dimension, but every surviving element was
  // removed by the nationality_conditional gate on the pay element itself.
  const inBandElements = Array.from(
    new Set(inBand.map((l) => l.payElementUuid)),
  )
    .map((uuid) => ctx.elements.get(uuid))
    .filter((el): el is NonNullable<typeof el> => el != null);
  const gatedElements = inBandElements.filter(
    (el) =>
      el.nationalityConditional &&
      (!crewNat || !(el.applicableNationalityUuids ?? []).includes(crewNat)),
  );
  if (inBandElements.length > 0 && gatedElements.length === inBandElements.length) {
    const allowed = Array.from(
      new Set(
        gatedElements.flatMap((el) => el.applicableNationalityUuids ?? []),
      ),
    ).map((uuid) => natName(uuid));
    return `all scale elements for rank ${rank} excluded by nationality gate for nationality ${natName(crewNat)} (allowed: ${allowed.join(", ") || "none"})`;
  }

  return `no ledger lines produced for rank ${rank} (scale lines exist but none were applicable)`;
}

// ============================================================================
// Resolution helpers
// ============================================================================

/**
 * Effective payment timing for an element on an engagement: the element
 * default, unless an effective-dated override row carries
 * payment_timing_override (0157). Deterministic: override rows are applied
 * in epe_uuid order, last one wins.
 */
function effectiveTiming(
  el: AccPayElementV2,
  overrides: AccEngagementPayElementV2[],
  from: string,
  to: string,
): { timing: string; epeUuid: string | null } {
  let timing = el.paymentTiming;
  let epeUuid: string | null = null;
  const applicable = overrides
    .filter(
      (o) =>
        o.payElementUuid === el.payElementUuid &&
        o.paymentTimingOverride != null &&
        (o.effectiveFrom == null || o.effectiveFrom <= to) &&
        (o.effectiveTo == null || o.effectiveTo >= from),
    )
    .sort((a, b) => a.epeUuid.localeCompare(b.epeUuid));
  for (const o of applicable) {
    timing = o.paymentTimingOverride as string;
    epeUuid = o.epeUuid;
  }
  return { timing, epeUuid };
}

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

/**
 * Walk the supersession chain from a scale and return the first superseding
 * revision that the chain can never reach because it lacks effective_from
 * (Task 148). Returns undefined when the chain is healthy.
 */
function unreachableRevision(
  ctx: CalcContext,
  scaleUuid: string,
): AccWageScaleV2 | undefined {
  let current = ctx.scaleByUuid.get(scaleUuid);
  let guard = 0;
  while (current?.supersededByScaleUuid && guard < 50) {
    const next = ctx.scaleByUuid.get(current.supersededByScaleUuid);
    if (!next) return undefined;
    if (
      next.effectiveFrom == null &&
      (next.status === "active" || next.status === "superseded")
    ) {
      return next;
    }
    current = next;
    guard++;
  }
  return undefined;
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
  warnings: EngagementWarning[],
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
      paymentTiming: element.paymentTiming,
      timingEpeUuid: null,
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
        if (o.amount != null || o.rate != null) {
          existing.amountE2 = o.amount != null ? toCents(o.amount) : existing.amountE2;
          existing.rateE4 = o.rate != null ? parseScaled(o.rate, 4) : existing.rateE4;
          existing.sourceType = "engagement_override";
          existing.sourceUuid = o.epeUuid;
          existing.epeUuid = o.epeUuid;
        }
      } else if (o.amount != null || o.rate != null) {
        // Fix (c): replace_scale_value with no base scale line for this
        // rank — apply the override value directly instead of silently
        // dropping the element.
        warnings.push({
          code: "replace_without_base",
          message: `element ${element.code}: replace_scale_value override has no base scale line for rank ${state.rankId}; override value applied directly (segment ${state.from})`,
        });
        entries.set(o.payElementUuid, {
          element,
          amountE2: o.amount != null ? toCents(o.amount) : null,
          rateE4: o.rate != null ? parseScaled(o.rate, 4) : null,
          sourceType: "engagement_override",
          sourceUuid: o.epeUuid,
          scaleUuid: state.scaleUuid,
          scaleLineUuid: null,
          epeUuid: o.epeUuid,
          paymentTiming: element.paymentTiming,
          timingEpeUuid: null,
          replaceFallbackWarning: true,
        });
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
        paymentTiming: element.paymentTiming,
        timingEpeUuid: null,
      });
    }
  }

  // Payment-timing overlay (0157): any active override row carrying
  // payment_timing_override retimes the element, independent of the
  // override_mode value handling above. Deterministic: epe_uuid order,
  // last one wins.
  const timingRows = active
    .filter((o) => o.paymentTimingOverride != null)
    .sort((a, b) => a.epeUuid.localeCompare(b.epeUuid));
  for (const o of timingRows) {
    const entry = entries.get(o.payElementUuid);
    if (entry) {
      entry.paymentTiming = o.paymentTimingOverride as string;
      entry.timingEpeUuid = o.epeUuid;
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
  const entries = resolveEntries(ctx, engagement, state, crewNat, overrides, [], []);
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
    paymentTiming: entry.paymentTiming,
    ...(entry.timingEpeUuid
      ? { paymentTimingOverriddenBy: entry.timingEpeUuid }
      : {}),
    ...(entry.replaceFallbackWarning
      ? {
          warning:
            "replace_scale_value override had no base scale line; override value applied directly",
        }
      : {}),
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
    paymentTiming: entry.paymentTiming,
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

function summarizeCrew(result: EngagementResult): CrewBaseTotals {
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
    } else if (
      l.elementType === "earning" ||
      l.elementType === "employer_contribution"
    ) {
      // employer_contribution lines only reach here when retimed away from
      // remitted_to_fund (0157 timing override) — they then pay like earnings.
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

/**
 * Enrich crew totals with ledger-derived balances (never stored):
 * balance_bf/cf carry the on-board net across calculated periods less
 * settlement payouts; the leave mini-ledger tracks settlement-timed
 * leave-category earnings.
 */
async function withBalances(
  ctx: CalcContext,
  results: EngagementResult[],
  period: string,
): Promise<CrewTotals[]> {
  const out: CrewTotals[] = [];
  for (const r of results) {
    const base = summarizeCrew(r);
    let leaveThisCents = 0;
    for (const l of r.lines) {
      if (
        l.elementType === "earning" &&
        l.paymentTiming === "payable_at_settlement" &&
        ctx.elements.get(l.payElementUuid)?.category === "leave"
      ) {
        leaveThisCents += toCents(l.amount);
      }
    }
    const prior = await balanceService.priorBalances(
      r.engagement.engagementUuid,
      period,
    );
    const balanceBfCents = prior.balanceBfCents;
    const balanceCfCents =
      balanceBfCents + toCents(base.netOnBoard) - prior.settlementsAtPeriodCents;
    out.push({
      ...base,
      balanceBf: centsToString(balanceBfCents),
      balanceCf: centsToString(balanceCfCents),
      leaveBf: centsToString(prior.leaveBfCents),
      leaveThisMonth: centsToString(leaveThisCents),
      leaveCf: centsToString(
        prior.leaveBfCents + leaveThisCents - prior.leaveSettledAtPeriodCents,
      ),
    });
  }
  return out;
}

function portageTotals(
  lines: Array<
    Pick<
      InsertAccWageLedgerV2,
      "isAdjustment" | "amount" | "paymentTiming" | "elementType"
    >
  >,
): {
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
    if (
      (l.elementType === "earning" ||
        l.elementType === "employer_contribution") &&
      l.paymentTiming === "paid_on_board"
    ) {
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
