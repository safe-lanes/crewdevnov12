import { EngagementsRepository, PortageRepository } from "../repositories";
import { assertVesselScope } from "./vesselScope";
import type { RequestActor } from "../controllers/_auth";
import type {
  AccEngagementV2,
  InsertAccEngagementV2,
  AccWageScaleV2,
  AccEngagementPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";
import { monthInfo, parseIsoDate, addMonths } from "../engine/periodMath";

const engagementsRepository = new EngagementsRepository();
const portageRepository = new PortageRepository();

export interface SyncError {
  assignUuid: string;
  crewUuid: string | null;
  crewName?: string | null;
  reason: string;
}

export interface SyncUpdate {
  engagementUuid: string;
  crewUuid: string;
  field: "startDate" | "endDate";
  old: string | null;
  new: string | null;
}

export interface SyncAttention {
  engagementUuid: string;
  crewUuid: string;
  reason: string;
}

export interface SyncResult {
  created: AccEngagementV2[];
  updated: SyncUpdate[];
  cancelled: Array<{ engagementUuid: string; crewUuid: string }>;
  attention: SyncAttention[];
  skippedExisting: number;
  skippedNoOverlap: number;
  errors: SyncError[];
  warnings: string[];
}

/**
 * Crew-pool dates are free text; parse defensively. Returns an ISO
 * YYYY-MM-DD string, null for empty, or undefined when unparseable.
 */
function parseTextDate(value: string | null): string | null | undefined {
  if (value == null || value.trim() === "") return null;
  const trimmed = value.trim();
  const isoCandidate = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoCandidate) && parseIsoDate(isoCandidate)) {
    return isoCandidate;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return undefined;
}

/**
 * Rank normalization: engagements must store rank CODES (never names).
 * Resolution order against the live company ranks master:
 *   1. value already a valid rank code → keep as-is
 *   2. exact rank-name match (unique)
 *   3. case-insensitive rank-name match (unique)
 * Ambiguous (non-unique) or unmatched values resolve to null.
 */
function buildRankResolver(
  companyRanks: Array<{ rank: string; rankId: string }>,
): (raw: string) => string | null {
  const validCodes = new Set(companyRanks.map((r) => r.rankId));
  const AMBIGUOUS = Symbol("ambiguous");
  const exact = new Map<string, string | typeof AMBIGUOUS>();
  const ci = new Map<string, string | typeof AMBIGUOUS>();
  for (const r of companyRanks) {
    const prevExact = exact.get(r.rank);
    if (prevExact === undefined) exact.set(r.rank, r.rankId);
    else if (prevExact !== r.rankId) exact.set(r.rank, AMBIGUOUS);
    const lower = r.rank.toLowerCase();
    const prevCi = ci.get(lower);
    if (prevCi === undefined) ci.set(lower, r.rankId);
    else if (prevCi !== r.rankId) ci.set(lower, AMBIGUOUS);
  }
  return (raw: string) => {
    if (validCodes.has(raw)) return raw;
    const e = exact.get(raw);
    if (typeof e === "string") return e;
    const c = ci.get(raw.toLowerCase());
    if (typeof c === "string") return c;
    return null;
  };
}

/**
 * Sort rows by the Admin-defined canonical rank order (available-ranks
 * sort_order), unmapped ranks last, then alphabetically by name.
 */
export function sortByRankOrder<T>(
  rows: T[],
  sortOrders: Map<string, number>,
  getRankId: (row: T) => string | null,
  getName: (row: T) => string,
): T[] {
  return [...rows].sort((a, b) => {
    const ra = getRankId(a);
    const rb = getRankId(b);
    const oa = ra != null ? sortOrders.get(ra) : undefined;
    const ob = rb != null ? sortOrders.get(rb) : undefined;
    if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;
    if (oa !== undefined && ob === undefined) return -1;
    if (oa === undefined && ob !== undefined) return 1;
    return getName(a).localeCompare(getName(b));
  });
}

/** Statuses whose date ranges may not overlap for the same crew. */
const OVERLAP_STATUSES = new Set(["draft", "active", "completed"]);

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
 * First existing engagement of the same crew whose service dates overlap
 * the candidate range (overlap-relevant statuses only).
 */
function findOverlapConflict(
  candidate: {
    crewUuid: string;
    startDate: string;
    endDate: string | null;
    engagementUuid?: string;
  },
  existing: AccEngagementV2[],
): AccEngagementV2 | undefined {
  return existing.find(
    (e) =>
      e.engagementUuid !== candidate.engagementUuid &&
      e.crewUuid === candidate.crewUuid &&
      OVERLAP_STATUSES.has(e.status) &&
      e.startDate != null &&
      rangesOverlap(
        candidate.startDate,
        candidate.endDate,
        e.startDate,
        e.endDate ?? null,
      ),
  );
}

function overlapConflictError(conflict: AccEngagementV2): Error {
  const err = new Error(
    `Overlapping engagement ${conflict.engagementUuid} (${conflict.startDate} – ${conflict.endDate ?? "open"}, ${conflict.status}) already exists for this crew member; resolve it via the engagement overlap audit first`,
  ) as Error & { code: string; details: unknown };
  err.code = "CONFLICT";
  err.details = {
    engagementUuid: conflict.engagementUuid,
    crewUuid: conflict.crewUuid,
    vesselUuid: conflict.vesselUuid,
    startDate: conflict.startDate,
    endDate: conflict.endDate,
    status: conflict.status,
  };
  return err;
}

export function resolveScaleForStart(
  scales: AccWageScaleV2[],
  vesselTypeUuid: string | null,
  startDate: string,
): AccWageScaleV2 | undefined {
  const effective = scales.filter(
    (s) =>
      (s.effectiveFrom == null || s.effectiveFrom <= startDate) &&
      (s.effectiveTo == null || s.effectiveTo >= startDate),
  );
  const byNewest = (a: AccWageScaleV2, b: AccWageScaleV2) =>
    (b.effectiveFrom ?? "").localeCompare(a.effectiveFrom ?? "") ||
    a.scaleUuid.localeCompare(b.scaleUuid);
  if (vesselTypeUuid) {
    const typed = effective
      .filter((s) => s.vesselTypeUuid === vesselTypeUuid)
      .sort(byNewest);
    if (typed.length > 0) return typed[0];
  }
  const fleetWide = effective
    .filter((s) => s.vesselTypeUuid == null && s.vesselGroupUuid == null)
    .sort(byNewest);
  return fleetWide[0];
}

/**
 * Vessel-type canonicalization: master_vessels stores the type as a NAME
 * string (synced from the parent system) while wage scales store the
 * canonical master_vessel_types.vt_uuid. Translate the vessel's stored
 * value to the canonical vt_uuid before scale matching.
 */
export interface VesselTypeContext {
  /** Human-readable type name for messages (as stored on the vessel). */
  typeName: string | null;
  /** Canonical master_vessel_types.vt_uuid, or null when no/unmatched type. */
  vesselTypeUuid: string | null;
  /** True when the vessel HAS a type value but it matches no master row. */
  unmatched: boolean;
}

export function resolveVesselTypeContext(
  storedType: string | null,
  masterTypes: Array<{ vtUuid: string | null; vesselType: string | null }>,
): VesselTypeContext {
  if (storedType == null || storedType.trim() === "") {
    return { typeName: null, vesselTypeUuid: null, unmatched: false };
  }
  const trimmed = storedType.trim();
  const lower = trimmed.toLowerCase();
  // Value already the canonical vt_uuid (defensive: accept either form).
  const byUuid = masterTypes.find(
    (t) => t.vtUuid != null && t.vtUuid.toLowerCase() === lower,
  );
  if (byUuid?.vtUuid) {
    return {
      typeName: byUuid.vesselType ?? trimmed,
      vesselTypeUuid: byUuid.vtUuid,
      unmatched: false,
    };
  }
  // Case-insensitive name match against the vessel-type master.
  const byName = masterTypes.find(
    (t) =>
      t.vtUuid != null &&
      (t.vesselType ?? "").trim().toLowerCase() === lower,
  );
  if (byName?.vtUuid) {
    return { typeName: trimmed, vesselTypeUuid: byName.vtUuid, unmatched: false };
  }
  return { typeName: trimmed, vesselTypeUuid: null, unmatched: true };
}

/**
 * Full scale-resolution outcome for one engagement start date, encoding the
 * unmatched-type fallback rules:
 *  - matched type → typed scale, else fleet-wide, else generic error
 *  - unmatched type name → fleet-wide with a warning, else explanatory error
 * Never throws.
 */
export function resolveScaleOutcome(
  scales: AccWageScaleV2[],
  ctx: VesselTypeContext,
  startDate: string,
): {
  scale?: AccWageScaleV2;
  usedFleetWideForUnmatchedType: boolean;
  errorReason?: string;
} {
  const scale = resolveScaleForStart(scales, ctx.vesselTypeUuid, startDate);
  if (scale) {
    return {
      scale,
      usedFleetWideForUnmatchedType:
        ctx.unmatched && scale.vesselTypeUuid == null,
    };
  }
  if (ctx.unmatched) {
    return {
      usedFleetWideForUnmatchedType: false,
      errorReason: `vessel type "${ctx.typeName}" not found in vessel-type master and no active fleet-wide wage scale at ${startDate}`,
    };
  }
  return {
    usedFleetWideForUnmatchedType: false,
    errorReason: `no active wage scale for vessel type '${ctx.typeName ?? "-"}' or fleet-wide at ${startDate}`,
  };
}

function codedError(
  code: "CONFLICT" | "VALIDATION" | "NOT_FOUND",
  message: string,
): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/** YYYY-MM periods covered by [from, to] (inclusive, ISO dates). */
function periodsBetween(from: string, to: string): string[] {
  const periods: string[] = [];
  let [y, m] = [parseInt(from.slice(0, 4), 10), parseInt(from.slice(5, 7), 10)];
  const [ey, em] = [parseInt(to.slice(0, 4), 10), parseInt(to.slice(5, 7), 10)];
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 1200) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    guard++;
  }
  return periods;
}

/**
 * Freeze rule: refuse contract edits while the engagement has a settlement
 * in submitted / approved / paid / locked status.
 */
async function assertNotFrozen(engagementUuid: string): Promise<void> {
  const frozen = await engagementsRepository.findFrozenSettlementEngagements([
    engagementUuid,
  ]);
  if (frozen.has(engagementUuid)) {
    throw codedError(
      "CONFLICT",
      "This engagement has a settlement in submitted or later status — contract edits are refused. Revert the settlement to draft first.",
    );
  }
}

/**
 * Locked-month rule: an override whose effective window falls entirely in
 * locked vessel-months can never take effect (locked months are never
 * recalculated), so the edit is refused with a clear message.
 */
async function assertWindowNotFullyLocked(
  engagement: AccEngagementV2,
  effectiveFrom: string | null,
  effectiveTo: string | null,
): Promise<void> {
  if (!engagement.vesselUuid || !engagement.startDate) return;
  const from = effectiveFrom ?? engagement.startDate;
  const to = effectiveTo ?? engagement.endDate ?? null;
  if (to == null) return; // open-ended window always reaches future open months
  const periods = periodsBetween(from, to);
  if (periods.length === 0) return;
  const locked = await engagementsRepository.findLockedPeriods(
    engagement.vesselUuid,
    periods,
  );
  if (periods.every((p) => locked.has(p))) {
    throw codedError(
      "CONFLICT",
      `Every month in the effective window (${periods.join(", ")}) is locked — the change could never take effect. Locked months are read-only.`,
    );
  }
}

const OVERRIDE_MODES = new Set([
  "add_element",
  "replace_scale_value",
  "suppress_element",
]);

/** Shared validation for create/update of a contract pay item. */
function validateOverridePayload(
  engagement: AccEngagementV2,
  data: {
    overrideMode: string;
    amount?: string | null;
    rate?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  },
): void {
  if (!OVERRIDE_MODES.has(data.overrideMode)) {
    throw codedError("VALIDATION", `Unknown override mode '${data.overrideMode}'`);
  }
  if (
    data.overrideMode !== "suppress_element" &&
    data.amount == null &&
    data.rate == null
  ) {
    throw codedError(
      "VALIDATION",
      "An amount (or rate) is required when adding an element or replacing the scale value",
    );
  }
  const from = data.effectiveFrom ?? null;
  const to = data.effectiveTo ?? null;
  if (from && to && from > to) {
    throw codedError("VALIDATION", "Effective from must be on or before effective to");
  }
  if (engagement.startDate) {
    if (from && from < engagement.startDate) {
      throw codedError(
        "VALIDATION",
        `Effective from (${from}) is before the engagement start (${engagement.startDate})`,
      );
    }
    if (to && to < engagement.startDate) {
      throw codedError(
        "VALIDATION",
        `Effective to (${to}) is before the engagement start (${engagement.startDate})`,
      );
    }
  }
  if (engagement.endDate) {
    if (from && from > engagement.endDate) {
      throw codedError(
        "VALIDATION",
        `Effective from (${from}) is after the engagement end (${engagement.endDate})`,
      );
    }
    if (to && to > engagement.endDate) {
      throw codedError(
        "VALIDATION",
        `Effective to (${to}) is after the engagement end (${engagement.endDate})`,
      );
    }
  }
}


/**
 * Shared create-only pass: create a voyage_contract engagement for every
 * crewing assignment overlapping the month that lacks one. Used by both
 * the explicit "Sync from Crewing" action and the on-load auto-create.
 */
async function createMissingEngagements(ctx: {
  vesselUuid: string;
  month: ReturnType<typeof monthInfo>;
  assignments: Array<{
    assignUuid: string;
    crewUuid: string;
    signOnDate: string | null;
    signOffDate: string | null;
  }>;
  existingByAssignment: Set<string | null>;
  crewEngagements: AccEngagementV2[];
  crewInfo: Map<string, { name?: string | null; presentRank?: string | null }>;
  crewLabel: (crewUuid: string) => string;
  resolveRankCode: (raw: string) => string | null;
  typeCtx: VesselTypeContext;
  scales: AccWageScaleV2[];
  result: SyncResult;
  auditUserUuid?: string;
}): Promise<void> {
  const {
    vesselUuid,
    month,
    assignments,
    existingByAssignment,
    crewEngagements,
    crewInfo,
    crewLabel,
    resolveRankCode,
    typeCtx,
    scales,
    result,
    auditUserUuid,
  } = ctx;
  let warnedUnmatchedType = false;
  for (const assignment of assignments) {
    const startDate = parseTextDate(assignment.signOnDate);
    const endDate = parseTextDate(assignment.signOffDate);
    if (startDate === undefined) {
      result.errors.push({
        assignUuid: assignment.assignUuid,
        crewUuid: assignment.crewUuid,
        crewName: crewLabel(assignment.crewUuid),
        reason: `unparseable sign_on_date '${assignment.signOnDate}'`,
      });
      continue;
    }
    if (endDate === undefined) {
      result.errors.push({
        assignUuid: assignment.assignUuid,
        crewUuid: assignment.crewUuid,
        crewName: crewLabel(assignment.crewUuid),
        reason: `unparseable sign_off_date '${assignment.signOffDate}'`,
      });
      continue;
    }
    if (startDate == null) {
      result.errors.push({
        assignUuid: assignment.assignUuid,
        crewUuid: assignment.crewUuid,
        crewName: crewLabel(assignment.crewUuid),
        reason: "missing sign_on_date",
      });
      continue;
    }
    const overlaps =
      startDate <= month.monthEnd &&
      (endDate == null || endDate >= month.monthStart);
    if (!overlaps) {
      result.skippedNoOverlap++;
      continue;
    }
    if (existingByAssignment.has(assignment.assignUuid)) {
      result.skippedExisting++;
      continue;
    }
    const conflict = findOverlapConflict(
      { crewUuid: assignment.crewUuid, startDate, endDate },
      crewEngagements,
    );
    if (conflict) {
      result.errors.push({
        assignUuid: assignment.assignUuid,
        crewUuid: assignment.crewUuid,
        crewName: crewLabel(assignment.crewUuid),
        reason: `overlapping engagement ${conflict.engagementUuid} (${conflict.startDate} – ${conflict.endDate ?? "open"}, ${conflict.status}) already exists for this crew member — resolve via the engagement overlap audit`,
      });
      continue;
    }
    const rawRank = crewInfo.get(assignment.crewUuid)?.presentRank ?? null;
    if (!rawRank) {
      result.errors.push({
        assignUuid: assignment.assignUuid,
        crewUuid: assignment.crewUuid,
        crewName: crewLabel(assignment.crewUuid),
        reason: "crew member has no present_rank",
      });
      continue;
    }
    const rankId = resolveRankCode(rawRank);
    if (!rankId) {
      result.errors.push({
        assignUuid: assignment.assignUuid,
        crewUuid: assignment.crewUuid,
        crewName: crewLabel(assignment.crewUuid),
        reason: `unmapped rank: ${rawRank}`,
      });
      continue;
    }
    const outcome = resolveScaleOutcome(scales, typeCtx, startDate);
    if (!outcome.scale) {
      result.errors.push({
        assignUuid: assignment.assignUuid,
        crewUuid: assignment.crewUuid,
        crewName: crewLabel(assignment.crewUuid),
        reason: outcome.errorReason!,
      });
      continue;
    }
    if (outcome.usedFleetWideForUnmatchedType && !warnedUnmatchedType) {
      result.warnings.push(
        `vessel type "${typeCtx.typeName}" not found in vessel-type master — using fleet-wide scale`,
      );
      warnedUnmatchedType = true;
    }
    const scale = outcome.scale;
    const dataWithAudit = applyAuditUser(
      {
        auditUserUuid,
        crewUuid: assignment.crewUuid,
        engagementType: "voyage_contract",
        assignmentUuid: assignment.assignUuid,
        vesselUuid,
        startDate,
        endDate,
        rankIdAtStart: rankId,
        wageScaleUuid: scale.scaleUuid,
        currency: scale.currency,
        status: "active",
        scaleYearAtStart: 1,
        nextStepDate: addMonths(startDate, 12),
      },
      true,
    );
    try {
      const created = await engagementsRepository.create(dataWithAudit);
      result.created.push(created);
      crewEngagements.push(created);
    } catch (err: any) {
      // Concurrent auto-create/sync race: the partial unique index
      // uq_acc_engagements_v2_live_assignment (migration 0182) makes the
      // duplicate insert fail — treat it as an idempotent skip.
      const pgCode = err?.code ?? err?.cause?.code;
      if (pgCode === "23505") {
        result.skippedExisting += 1;
        continue;
      }
      throw err;
    }
  }
}

export const engagementsService = {
  /**
   * Contracts list rows: engagement + crew name/rank + vessel + scale name,
   * filterable by vessel and status, newest start first.
   */
  async list(filters: { vesselUuid?: string; status?: string }) {
    const engagements = await engagementsRepository.findEngagementList(filters);
    const crewInfo = await engagementsRepository.findCrewInfo(
      Array.from(new Set(engagements.map((e) => e.crewUuid))),
    );
    const vesselNames = await engagementsRepository.findVesselNames(
      Array.from(
        new Set(
          engagements.map((e) => e.vesselUuid).filter((v): v is string => !!v),
        ),
      ),
    );
    const scaleNames = await engagementsRepository.findScaleNames(
      Array.from(
        new Set(
          engagements
            .map((e) => e.wageScaleUuid)
            .filter((u): u is string => !!u),
        ),
      ),
    );
    return engagements.map((e) => ({
      engagementUuid: e.engagementUuid,
      crewUuid: e.crewUuid,
      crewName: crewInfo.get(e.crewUuid)?.name || e.crewUuid,
      rankIdAtStart: e.rankIdAtStart,
      vesselUuid: e.vesselUuid,
      vesselName: e.vesselUuid
        ? (vesselNames.get(e.vesselUuid) ?? null)
        : null,
      startDate: e.startDate,
      endDate: e.endDate,
      endDateManual: e.endDateManual,
      status: e.status,
      scaleName: e.wageScaleUuid
        ? (scaleNames.get(e.wageScaleUuid) ?? null)
        : null,
    }));
  },

  /**
   * Contract detail: engagement + names + all live override rows + the
   * settlement-freeze flag driving read-only mode in the UI.
   */
  async detail(engagementUuid: string) {
    const engagement = await engagementsRepository.findByUuid(engagementUuid);
    if (!engagement) return undefined;
    const [crewInfo, overrides, frozen] = await Promise.all([
      engagementsRepository.findCrewInfo([engagement.crewUuid]),
      engagementsRepository.findOverridesByEngagement(engagementUuid),
      engagementsRepository.findFrozenSettlementEngagements([engagementUuid]),
    ]);
    const vesselNames = engagement.vesselUuid
      ? await engagementsRepository.findVesselNames([engagement.vesselUuid])
      : new Map<string, string>();
    const scaleNames = engagement.wageScaleUuid
      ? await engagementsRepository.findScaleNames([engagement.wageScaleUuid])
      : new Map<string, string>();
    const info = crewInfo.get(engagement.crewUuid);
    return {
      engagement,
      crewName: info?.name || engagement.crewUuid,
      presentRank: info?.presentRank ?? null,
      vesselName: engagement.vesselUuid
        ? (vesselNames.get(engagement.vesselUuid) ?? null)
        : null,
      scaleName: engagement.wageScaleUuid
        ? (scaleNames.get(engagement.wageScaleUuid) ?? null)
        : null,
      overrides,
      frozen: frozen.has(engagementUuid),
    };
  },

  // ---- Contract pay items (engagement pay-element overrides) -------------

  async createPayItem(
    engagementUuid: string,
    data: {
      payElementUuid: string;
      overrideMode: string;
      amount?: string | null;
      rate?: string | null;
      paymentTimingOverride?: string | null;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      remarks?: string | null;
    },
    auditUserUuid?: string,
  ): Promise<AccEngagementPayElementV2> {
    const engagement = await engagementsRepository.findByUuid(engagementUuid);
    if (!engagement) throw codedError("NOT_FOUND", "Engagement not found");
    await assertNotFrozen(engagementUuid);
    validateOverridePayload(engagement, data);
    await assertWindowNotFullyLocked(
      engagement,
      data.effectiveFrom ?? null,
      data.effectiveTo ?? null,
    );
    return engagementsRepository.createOverride({
      engagementUuid,
      payElementUuid: data.payElementUuid,
      overrideMode: data.overrideMode,
      amount: data.overrideMode === "suppress_element" ? null : (data.amount ?? null),
      rate: data.overrideMode === "suppress_element" ? null : (data.rate ?? null),
      paymentTimingOverride: data.paymentTimingOverride ?? null,
      effectiveFrom: data.effectiveFrom ?? null,
      effectiveTo: data.effectiveTo ?? null,
      remarks: data.remarks ?? null,
      createdByUuid: auditUserUuid ?? null,
    });
  },

  async updatePayItem(
    epeUuid: string,
    data: Partial<{
      payElementUuid: string;
      overrideMode: string;
      amount: string | null;
      rate: string | null;
      paymentTimingOverride: string | null;
      effectiveFrom: string | null;
      effectiveTo: string | null;
      remarks: string | null;
    }>,
    auditUserUuid?: string,
  ): Promise<AccEngagementPayElementV2> {
    const existing = await engagementsRepository.findOverrideByUuid(epeUuid);
    if (!existing) throw codedError("NOT_FOUND", "Contract pay item not found");
    const engagement = await engagementsRepository.findByUuid(
      existing.engagementUuid,
    );
    if (!engagement) throw codedError("NOT_FOUND", "Engagement not found");
    await assertNotFrozen(existing.engagementUuid);
    const merged = {
      overrideMode: data.overrideMode ?? existing.overrideMode,
      amount: data.amount !== undefined ? data.amount : existing.amount,
      rate: data.rate !== undefined ? data.rate : existing.rate,
      effectiveFrom:
        data.effectiveFrom !== undefined
          ? data.effectiveFrom
          : existing.effectiveFrom,
      effectiveTo:
        data.effectiveTo !== undefined ? data.effectiveTo : existing.effectiveTo,
    };
    validateOverridePayload(engagement, merged);
    await assertWindowNotFullyLocked(
      engagement,
      merged.effectiveFrom,
      merged.effectiveTo,
    );
    // Suppress overrides never carry a value — normalize like the create path.
    const normalized =
      merged.overrideMode === "suppress_element"
        ? { ...data, amount: null, rate: null }
        : data;
    const updated = await engagementsRepository.updateOverride(epeUuid, {
      ...normalized,
      updatedByUuid: auditUserUuid ?? null,
    });
    return updated!;
  },

  async deletePayItem(epeUuid: string, auditUserUuid?: string): Promise<void> {
    const existing = await engagementsRepository.findOverrideByUuid(epeUuid);
    if (!existing) throw codedError("NOT_FOUND", "Contract pay item not found");
    await assertNotFrozen(existing.engagementUuid);
    // Same locked-month rule as create/update: removing an override whose
    // window lies entirely in locked months could never take effect.
    const engagement = await engagementsRepository.findByUuid(
      existing.engagementUuid,
    );
    if (engagement) {
      await assertWindowNotFullyLocked(
        engagement,
        existing.effectiveFrom ?? null,
        existing.effectiveTo ?? null,
      );
    }
    await engagementsRepository.updateOverride(epeUuid, {
      isDeleted: true,
      updatedByUuid: auditUserUuid ?? null,
    });
  },

  /**
   * Auto-create voyage_contract engagements for crew_assignments rows
   * overlapping the period that lack one (spec Prompt 03 section C).
   */
  async sync(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<SyncResult> {
    const month = monthInfo(period);
    const assignments =
      await engagementsRepository.findAssignmentsForVessel(vesselUuid);
    const existing = await engagementsRepository.findByAssignmentUuids(
      assignments.map((a) => a.assignUuid),
    );
    const existingByAssignment = new Set(
      existing.map((e) => e.assignmentUuid).filter(Boolean),
    );
    const crewUuids = Array.from(new Set(assignments.map((a) => a.crewUuid)));
    const crewInfo = await engagementsRepository.findCrewInfo(crewUuids);
    const crewEngagements =
      await engagementsRepository.findByCrewUuids(crewUuids);
    const vesselTypeName =
      await engagementsRepository.findVesselType(vesselUuid);
    const masterTypes = await engagementsRepository.findVesselTypeMaster();
    const typeCtx = resolveVesselTypeContext(vesselTypeName, masterTypes);
    const scales = await engagementsRepository.findActiveScales();
    const resolveRankCode = buildRankResolver(
      await engagementsRepository.findCompanyRanks(),
    );

    // "AMIT SHARMA (AB) (uuid)" — name + rank for humans, uuid in parens.
    const crewLabel = (crewUuid: string): string => {
      const info = crewInfo.get(crewUuid);
      if (!info?.name) return crewUuid;
      const rank = info.presentRank ? ` (${info.presentRank})` : "";
      return `${info.name}${rank} (${crewUuid})`;
    };

    const result: SyncResult = {
      created: [],
      updated: [],
      cancelled: [],
      attention: [],
      skippedExisting: 0,
      skippedNoOverlap: 0,
      errors: [],
      warnings: [],
    };

    // ---- Reconciliation of existing assignment-derived engagements -----
    // Only start_date / end_date / status are ever touched; manual anchor
    // fields (scale_year_at_start, next_step_date, wage scale) and timing
    // overrides are never overwritten. Settled/cancelled engagements and
    // engagements frozen by a settlement in submitted+ are never modified.
    const vesselEngagements =
      await engagementsRepository.findAssignmentDerivedByVessel(vesselUuid);
    const assignmentByUuid = new Map(assignments.map((a) => [a.assignUuid, a]));
    const engagementUuids = vesselEngagements.map((e) => e.engagementUuid);
    const [lineCounts, frozen] = await Promise.all([
      engagementsRepository.countLedgerLinesByEngagements(engagementUuids),
      engagementsRepository.findFrozenSettlementEngagements(engagementUuids),
    ]);

    for (const engagement of vesselEngagements) {
      if (engagement.status === "settled" || engagement.status === "cancelled") {
        continue;
      }
      if (frozen.has(engagement.engagementUuid)) continue;
      const assignment = assignmentByUuid.get(engagement.assignmentUuid!);
      const lineCount = lineCounts.get(engagement.engagementUuid) ?? 0;

      if (!assignment) {
        // Orphan: source assignment removed.
        if (lineCount > 0) {
          result.attention.push({
            engagementUuid: engagement.engagementUuid,
            crewUuid: engagement.crewUuid,
            reason:
              "assignment removed/changed but wage history exists — review manually",
          });
        } else {
          await engagementsRepository.update(engagement.engagementUuid, {
            status: "cancelled",
            ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}),
          });
          result.cancelled.push({
            engagementUuid: engagement.engagementUuid,
            crewUuid: engagement.crewUuid,
          });
          const local = crewEngagements.find(
            (e: AccEngagementV2) =>
              e.engagementUuid === engagement.engagementUuid,
          );
          if (local) local.status = "cancelled";
        }
        continue;
      }

      const newStart = parseTextDate(assignment.signOnDate);
      const newEnd = parseTextDate(assignment.signOffDate);
      if (newStart === undefined || newEnd === undefined || newStart == null) {
        // Unparseable/missing source dates are reported by the create loop.
        continue;
      }

      const stillOverlaps =
        newStart <= month.monthEnd &&
        (newEnd == null || newEnd >= month.monthStart);
      if (!stillOverlaps) {
        // Assignment no longer overlaps the period.
        if (lineCount > 0) {
          result.attention.push({
            engagementUuid: engagement.engagementUuid,
            crewUuid: engagement.crewUuid,
            reason:
              "assignment removed/changed but wage history exists — review manually",
          });
        } else {
          await engagementsRepository.update(engagement.engagementUuid, {
            status: "cancelled",
            ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}),
          });
          result.cancelled.push({
            engagementUuid: engagement.engagementUuid,
            crewUuid: engagement.crewUuid,
          });
          const local = crewEngagements.find(
            (e: AccEngagementV2) =>
              e.engagementUuid === engagement.engagementUuid,
          );
          if (local) local.status = "cancelled";
        }
        continue;
      }

      const patch: Partial<InsertAccEngagementV2> = {};
      if (newStart !== engagement.startDate) {
        patch.startDate = newStart;
        result.updated.push({
          engagementUuid: engagement.engagementUuid,
          crewUuid: engagement.crewUuid,
          field: "startDate",
          old: engagement.startDate ?? null,
          new: newStart,
        });
      }
      if (
        engagement.endDateManual &&
        (newEnd ?? null) !== (engagement.endDate ?? null)
      ) {
        // Manually set sign-off: never overwritten by sync — report instead.
        result.attention.push({
          engagementUuid: engagement.engagementUuid,
          crewUuid: engagement.crewUuid,
          reason: `sign-off date was set manually to ${engagement.endDate ?? "open"} but the crewing assignment says ${newEnd ?? "open"} — review the contract`,
        });
      } else if ((newEnd ?? null) !== (engagement.endDate ?? null)) {
        patch.endDate = newEnd;
        result.updated.push({
          engagementUuid: engagement.engagementUuid,
          crewUuid: engagement.crewUuid,
          field: "endDate",
          old: engagement.endDate ?? null,
          new: newEnd,
        });
      }
      if (Object.keys(patch).length > 0) {
        await engagementsRepository.update(engagement.engagementUuid, {
          ...patch,
          ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}),
        });
        const local = crewEngagements.find(
          (e) => e.engagementUuid === engagement.engagementUuid,
        );
        if (local) {
          if (patch.startDate !== undefined) local.startDate = patch.startDate;
          if (patch.endDate !== undefined) local.endDate = patch.endDate ?? null;
        }
      }
    }

    await createMissingEngagements({
      vesselUuid,
      month,
      assignments,
      existingByAssignment,
      crewEngagements,
      crewInfo,
      crewLabel,
      resolveRankCode,
      typeCtx,
      scales,
      result,
      auditUserUuid,
    });

    return result;
  },

  /**
   * Auto-create engagements when a vessel-period workspace loads (spec
   * task #179 part 1): CREATE-ONLY — never updates or cancels existing
   * engagements (that stays on the explicit "Sync from Crewing" action).
   * Skips entirely when the month's portage bill is approved or locked.
   */
  async autoCreate(
    vesselUuid: string,
    period: string,
    auditUserUuid?: string,
  ): Promise<SyncResult & { skippedLockedMonth: boolean }> {
    const result: SyncResult = {
      created: [],
      updated: [],
      cancelled: [],
      attention: [],
      skippedExisting: 0,
      skippedNoOverlap: 0,
      errors: [],
      warnings: [],
    };
    const portage = await portageRepository.findByVesselPeriod(
      vesselUuid,
      period,
    );
    if (
      portage &&
      (portage.isLocked ||
        portage.status === "approved" ||
        portage.status === "locked")
    ) {
      return { ...result, skippedLockedMonth: true };
    }

    const month = monthInfo(period);
    const assignments =
      await engagementsRepository.findAssignmentsForVessel(vesselUuid);
    const existing = await engagementsRepository.findByAssignmentUuids(
      assignments.map((a) => a.assignUuid),
    );
    const existingByAssignment = new Set(
      existing.map((e) => e.assignmentUuid).filter(Boolean),
    );
    const crewUuids = Array.from(new Set(assignments.map((a) => a.crewUuid)));
    const crewInfo = await engagementsRepository.findCrewInfo(crewUuids);
    const crewEngagements =
      await engagementsRepository.findByCrewUuids(crewUuids);
    const vesselTypeName =
      await engagementsRepository.findVesselType(vesselUuid);
    const masterTypes = await engagementsRepository.findVesselTypeMaster();
    const typeCtx = resolveVesselTypeContext(vesselTypeName, masterTypes);
    const scales = await engagementsRepository.findActiveScales();
    const resolveRankCode = buildRankResolver(
      await engagementsRepository.findCompanyRanks(),
    );
    const crewLabel = (crewUuid: string): string => {
      const info = crewInfo.get(crewUuid);
      if (!info?.name) return crewUuid;
      const rank = info.presentRank ? ` (${info.presentRank})` : "";
      return `${info.name}${rank} (${crewUuid})`;
    };

    await createMissingEngagements({
      vesselUuid,
      month,
      assignments,
      existingByAssignment,
      crewEngagements,
      crewInfo,
      crewLabel,
      resolveRankCode,
      typeCtx,
      scales,
      result,
      auditUserUuid,
    });

    return { ...result, skippedLockedMonth: false };
  },

  /**
   * Vessel-editable sign-off date (spec task #179 part 4): sets the
   * engagement end date with the endDateManual flag so "Sync from
   * Crewing" never overwrites it. Allowed only while the month's portage
   * is open / vessel_draft / returned (or absent) and the engagement is
   * not frozen by a submitted settlement. Vessel actors are scoped to
   * their own vessels; office users may also use this path.
   */
  async setSignOffDate(
    engagementUuid: string,
    period: string,
    endDate: string,
    actor?: RequestActor,
  ): Promise<AccEngagementV2> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !parseIsoDate(endDate)) {
      throw codedError("VALIDATION", "endDate must be YYYY-MM-DD");
    }
    // The guarded month must be derived from the date being written, not
    // trusted from the caller — otherwise a locked month could be modified
    // by sending an open `period` alongside an endDate in the locked month.
    if (endDate.slice(0, 7) !== period) {
      throw codedError(
        "VALIDATION",
        `Sign-off date (${endDate}) must fall inside the requested month (${period})`,
      );
    }
    const engagement = await engagementsRepository.findByUuid(engagementUuid);
    if (!engagement) throw codedError("NOT_FOUND", "Engagement not found");
    assertVesselScope(actor, engagement.vesselUuid);
    if (engagement.status === "settled" || engagement.status === "cancelled") {
      throw codedError(
        "CONFLICT",
        `Sign-off date cannot be changed on a ${engagement.status} engagement`,
      );
    }
    if (engagement.startDate && endDate < engagement.startDate) {
      throw codedError(
        "VALIDATION",
        `Sign-off date (${endDate}) is before the engagement start (${engagement.startDate})`,
      );
    }
    await assertNotFrozen(engagementUuid);
    if (engagement.vesselUuid) {
      // Guard every affected month: the month the new date falls in
      // (= period, enforced above) and, if the engagement already has an
      // end date in a different month, that month too — moving a sign-off
      // out of a closed month would silently change its figures.
      const guardedPeriods = new Set([period]);
      if (engagement.endDate) guardedPeriods.add(engagement.endDate.slice(0, 7));
      for (const p of guardedPeriods) {
        const portage = await portageRepository.findByVesselPeriod(
          engagement.vesselUuid,
          p,
        );
        if (
          portage &&
          (portage.isLocked ||
            !["open", "vessel_draft", "returned"].includes(portage.status))
        ) {
          throw codedError(
            "CONFLICT",
            `Sign-off date cannot be changed while month ${p} is ${portage.status}`,
          );
        }
      }
    }
    const updated = await engagementsRepository.update(engagementUuid, {
      endDate,
      endDateManual: true,
      ...(actor?.auditUserUuid ? { updatedByUuid: actor.auditUserUuid } : {}),
    });
    return updated!;
  },

  /**
   * Step-1 review rows: every assignment overlapping the month vs its
   * engagement (if any), with crew name/rank, resolved scale and flags.
   */
  async review(vesselUuid: string, period: string) {
    const month = monthInfo(period);
    const assignments =
      await engagementsRepository.findAssignmentsForVessel(vesselUuid);
    const overlapping = assignments.filter((a) => {
      const startDate = parseTextDate(a.signOnDate);
      const endDate = parseTextDate(a.signOffDate);
      if (startDate == null) return true; // surfaced as an error row
      if (endDate === undefined) return true;
      return (
        startDate <= month.monthEnd &&
        (endDate == null || endDate >= month.monthStart)
      );
    });
    const engagements = await engagementsRepository.findByAssignmentUuids(
      overlapping.map((a) => a.assignUuid),
    );
    const engagementByAssignment = new Map(
      engagements.map((e) => [e.assignmentUuid, e]),
    );
    const crewInfo = await engagementsRepository.findCrewInfo(
      Array.from(new Set(overlapping.map((a) => a.crewUuid))),
    );
    const scaleNames = await engagementsRepository.findScaleNames(
      Array.from(
        new Set(
          engagements.map((e) => e.wageScaleUuid).filter((u): u is string => !!u),
        ),
      ),
    );
    const overrides = await engagementsRepository.findTimingOverrides(
      engagements.map((e) => e.engagementUuid),
    );
    const overridesByEngagement = new Map<string, typeof overrides>();
    for (const o of overrides) {
      const list = overridesByEngagement.get(o.engagementUuid);
      if (list) list.push(o);
      else overridesByEngagement.set(o.engagementUuid, [o]);
    }
    const ledgerLineCounts =
      await engagementsRepository.countLedgerLinesByEngagements(
        engagements.map((e) => e.engagementUuid),
      );
    const [rankSortOrders, companyRanks] = await Promise.all([
      engagementsRepository.findRankSortOrders(),
      engagementsRepository.findCompanyRanks(),
    ]);
    const resolveRank = buildRankResolver(companyRanks);
    const rows = overlapping.map((a) => {
      const engagement = engagementByAssignment.get(a.assignUuid) ?? null;
      const info = crewInfo.get(a.crewUuid);
      return {
        assignUuid: a.assignUuid,
        crewUuid: a.crewUuid,
        crewName: info?.name || a.crewUuid,
        presentRank: info?.presentRank ?? null,
        signOnDate: a.signOnDate,
        signOffDate: a.signOffDate,
        engagement,
        scaleName: engagement?.wageScaleUuid
          ? (scaleNames.get(engagement.wageScaleUuid) ?? null)
          : null,
        timingOverrides: engagement
          ? (overridesByEngagement.get(engagement.engagementUuid) ?? [])
          : [],
        ledgerLineCount: engagement
          ? (ledgerLineCounts.get(engagement.engagementUuid) ?? 0)
          : 0,
      };
    });
    return sortByRankOrder(
      rows,
      rankSortOrders,
      (r) =>
        r.engagement?.rankIdAtStart ??
        (r.presentRank ? resolveRank(r.presentRank) : null),
      (r) => r.crewName,
    );
  },

  /**
   * Engagement flag toggle: write (or remove) a timing-only override row
   * for one pay element. `paymentTimingOverride: null` removes the flag so
   * the element's default timing applies again.
   */
  async setTimingOverride(
    engagementUuid: string,
    payElementUuid: string,
    paymentTimingOverride: string | null,
    auditUserUuid?: string,
  ) {
    const engagement = await engagementsRepository.findByUuid(engagementUuid);
    if (!engagement) {
      throw new Error(`Engagement not found: ${engagementUuid}`);
    }
    // Timing changes are contract edits: refuse when frozen by a settlement
    // or when every month of the engagement window is locked.
    await assertNotFrozen(engagementUuid);
    await assertWindowNotFullyLocked(engagement, null, null);
    const existing = await engagementsRepository.findTimingOnlyRow(
      engagementUuid,
      payElementUuid,
    );
    if (paymentTimingOverride == null) {
      if (existing) {
        await engagementsRepository.updateTimingOverride(existing.epeUuid, {
          isDeleted: true,
          updatedByUuid: auditUserUuid ?? null,
        });
      }
      return null;
    }
    if (existing) {
      return engagementsRepository.updateTimingOverride(existing.epeUuid, {
        paymentTimingOverride,
        updatedByUuid: auditUserUuid ?? null,
      });
    }
    return engagementsRepository.createTimingOverride({
      engagementUuid,
      payElementUuid,
      paymentTimingOverride,
      createdByUuid: auditUserUuid ?? null,
    });
  },

  /** Manual seniority anchor / status patch (spec Prompt 03 section C). */
  async update(
    engagementUuid: string,
    data: Partial<
      Pick<
        InsertAccEngagementV2,
        | "scaleYearAtStart"
        | "nextStepDate"
        | "wageScaleUuid"
        | "status"
        | "startDate"
        | "endDate"
      >
    > & { auditUserUuid?: string },
  ): Promise<AccEngagementV2 | undefined> {
    // Freeze rule: contract fields may not change once a settlement is in
    // submitted or later status.
    const touchesContractFields =
      data.scaleYearAtStart !== undefined ||
      data.nextStepDate !== undefined ||
      data.wageScaleUuid !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined;
    if (touchesContractFields) await assertNotFrozen(engagementUuid);
    // Overlap guard: whenever an overlap-relevant field changes (status or
    // service dates), validate the EFFECTIVE post-patch record — the patch
    // merged over persisted values — against the crew's other engagements.
    const touchesOverlapFields =
      data.status !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined;
    if (touchesOverlapFields) {
      const engagement =
        await engagementsRepository.findByUuid(engagementUuid);
      if (!engagement) return undefined;
      if (data.status === "cancelled" && engagement.status !== "cancelled") {
        const counts =
          await engagementsRepository.countLedgerLinesByEngagements([
            engagementUuid,
          ]);
        const lineCount = counts.get(engagementUuid) ?? 0;
        if (lineCount > 0) {
          const err = new Error(
            `Engagement has ${lineCount} wage ledger line(s) — it cannot be cancelled. Review the wage history manually.`,
          ) as Error & { code: string };
          err.code = "CONFLICT";
          throw err;
        }
      }
      const effectiveStatus = data.status ?? engagement.status;
      const effectiveStart =
        data.startDate !== undefined ? data.startDate : engagement.startDate;
      const effectiveEnd =
        data.endDate !== undefined ? data.endDate : engagement.endDate;
      if (OVERLAP_STATUSES.has(effectiveStatus) && effectiveStart) {
        const others = (
          await engagementsRepository.findByCrewUuids([engagement.crewUuid])
        ).filter((e) => e.engagementUuid !== engagementUuid);
        const conflict = findOverlapConflict(
          {
            crewUuid: engagement.crewUuid,
            startDate: effectiveStart,
            endDate: effectiveEnd ?? null,
            engagementUuid,
          },
          others,
        );
        if (conflict) throw overlapConflictError(conflict);
      }
    }
    // Any end-date change through this API is a manual edit: mark it so
    // sync reports (rather than overwrites) future differences.
    const dataWithAudit = applyAuditUser(
      data.endDate !== undefined ? { ...data, endDateManual: true } : data,
      false,
    );
    return engagementsRepository.update(engagementUuid, dataWithAudit);
  },

  /**
   * Overlap audit: existing groups of same-crew engagements whose service
   * dates overlap (draft/active/completed only). Read-only — existing data
   * is never auto-fixed.
   */
  async overlapAudit() {
    const engagements = await engagementsRepository.findOverlapCandidates();
    const byCrew = new Map<string, AccEngagementV2[]>();
    for (const e of engagements) {
      if (!e.startDate) continue;
      const list = byCrew.get(e.crewUuid);
      if (list) list.push(e);
      else byCrew.set(e.crewUuid, [e]);
    }
    const groups: Array<{ crewUuid: string; engagements: AccEngagementV2[] }> =
      [];
    for (const [crewUuid, list] of byCrew) {
      if (list.length < 2) continue;
      list.sort((a, b) => a.startDate!.localeCompare(b.startDate!));
      let cluster: AccEngagementV2[] = [list[0]];
      let clusterEnd: string | null = list[0].endDate ?? null;
      for (let i = 1; i < list.length; i++) {
        const e = list[i];
        if (clusterEnd == null || e.startDate! <= clusterEnd) {
          cluster.push(e);
          if (clusterEnd != null) {
            clusterEnd =
              e.endDate == null
                ? null
                : e.endDate > clusterEnd
                  ? e.endDate
                  : clusterEnd;
          }
        } else {
          if (cluster.length > 1) groups.push({ crewUuid, engagements: cluster });
          cluster = [e];
          clusterEnd = e.endDate ?? null;
        }
      }
      if (cluster.length > 1) groups.push({ crewUuid, engagements: cluster });
    }
    const crewInfo = await engagementsRepository.findCrewInfo(
      groups.map((g) => g.crewUuid),
    );
    const ledgerLineCounts =
      await engagementsRepository.countLedgerLinesByEngagements(
        groups.flatMap((g) => g.engagements.map((e) => e.engagementUuid)),
      );
    const vesselNames = await engagementsRepository.findVesselNames(
      Array.from(
        new Set(
          groups.flatMap((g) =>
            g.engagements
              .map((e) => e.vesselUuid)
              .filter((v): v is string => !!v),
          ),
        ),
      ),
    );
    return groups.map((g) => ({
      crewUuid: g.crewUuid,
      crewName: crewInfo.get(g.crewUuid)?.name ?? g.crewUuid,
      engagements: g.engagements.map((e) => ({
        engagementUuid: e.engagementUuid,
        vesselUuid: e.vesselUuid,
        vesselName: e.vesselUuid
          ? (vesselNames.get(e.vesselUuid) ?? null)
          : null,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        assignmentUuid: e.assignmentUuid,
        ledgerLineCount: ledgerLineCounts.get(e.engagementUuid) ?? 0,
      })),
    }));
  },
};
