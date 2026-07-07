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

export interface SyncResult {
  created: AccEngagementV2[];
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
    const crewRanks = await engagementsRepository.findCrewRanks(
      Array.from(new Set(assignments.map((a) => a.crewUuid))),
    );
    const vesselType = await engagementsRepository.findVesselType(vesselUuid);
    const scales = await engagementsRepository.findActiveScales();
    const resolveRankCode = buildRankResolver(
      await engagementsRepository.findCompanyRanks(),
    );

    const result: SyncResult = {
      created: [],
      skippedExisting: 0,
      skippedNoOverlap: 0,
      errors: [],
    };

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
        "scaleYearAtStart" | "nextStepDate" | "wageScaleUuid" | "status"
      >
    > & { auditUserUuid?: string },
  ): Promise<AccEngagementV2 | undefined> {
    const dataWithAudit = applyAuditUser(data, false);
    return engagementsRepository.update(engagementUuid, dataWithAudit);
  },
};
