import { EngagementsRepository } from "../repositories";
import type {
  AccEngagementV2,
  InsertAccEngagementV2,
  AccWageScaleV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";
import { monthInfo, parseIsoDate, addMonths } from "../engine/periodMath";

const engagementsRepository = new EngagementsRepository();

export interface SyncError {
  assignUuid: string;
  crewUuid: string | null;
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

function resolveScaleForStart(
  scales: AccWageScaleV2[],
  vesselType: string | null,
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
  if (vesselType) {
    const typed = effective
      .filter((s) => s.vesselTypeUuid === vesselType)
      .sort(byNewest);
    if (typed.length > 0) return typed[0];
  }
  const fleetWide = effective
    .filter((s) => s.vesselTypeUuid == null && s.vesselGroupUuid == null)
    .sort(byNewest);
  return fleetWide[0];
}

export const engagementsService = {
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
    const crewRanks = await engagementsRepository.findCrewRanks(crewUuids);
    const crewEngagements =
      await engagementsRepository.findByCrewUuids(crewUuids);
    const vesselType = await engagementsRepository.findVesselType(vesselUuid);
    const scales = await engagementsRepository.findActiveScales();
    const resolveRankCode = buildRankResolver(
      await engagementsRepository.findCompanyRanks(),
    );

    const result: SyncResult = {
      created: [],
      updated: [],
      cancelled: [],
      attention: [],
      skippedExisting: 0,
      skippedNoOverlap: 0,
      errors: [],
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
      if ((newEnd ?? null) !== (engagement.endDate ?? null)) {
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

    for (const assignment of assignments) {
      const startDate = parseTextDate(assignment.signOnDate);
      const endDate = parseTextDate(assignment.signOffDate);
      if (startDate === undefined) {
        result.errors.push({
          assignUuid: assignment.assignUuid,
          crewUuid: assignment.crewUuid,
          reason: `unparseable sign_on_date '${assignment.signOnDate}'`,
        });
        continue;
      }
      if (endDate === undefined) {
        result.errors.push({
          assignUuid: assignment.assignUuid,
          crewUuid: assignment.crewUuid,
          reason: `unparseable sign_off_date '${assignment.signOffDate}'`,
        });
        continue;
      }
      if (startDate == null) {
        result.errors.push({
          assignUuid: assignment.assignUuid,
          crewUuid: assignment.crewUuid,
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
          reason: `overlapping engagement ${conflict.engagementUuid} (${conflict.startDate} – ${conflict.endDate ?? "open"}, ${conflict.status}) already exists for this crew member — resolve via the engagement overlap audit`,
        });
        continue;
      }
      const rawRank = crewRanks.get(assignment.crewUuid) ?? null;
      if (!rawRank) {
        result.errors.push({
          assignUuid: assignment.assignUuid,
          crewUuid: assignment.crewUuid,
          reason: "crew member has no present_rank",
        });
        continue;
      }
      const rankId = resolveRankCode(rawRank);
      if (!rankId) {
        result.errors.push({
          assignUuid: assignment.assignUuid,
          crewUuid: assignment.crewUuid,
          reason: `unmapped rank: ${rawRank}`,
        });
        continue;
      }
      const scale = resolveScaleForStart(scales, vesselType, startDate);
      if (!scale) {
        result.errors.push({
          assignUuid: assignment.assignUuid,
          crewUuid: assignment.crewUuid,
          reason: `no active wage scale for vessel type '${vesselType ?? "-"}' or fleet-wide at ${startDate}`,
        });
        continue;
      }
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
      const created = await engagementsRepository.create(dataWithAudit);
      result.created.push(created);
      crewEngagements.push(created);
    }

    return result;
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
    return overlapping.map((a) => {
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
    const dataWithAudit = applyAuditUser(data, false);
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
          ? (vesselNames.get(e.vesselUuid) ?? e.vesselUuid)
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
