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
      const rankId = crewRanks.get(assignment.crewUuid) ?? null;
      if (!rankId) {
        result.errors.push({
          assignUuid: assignment.assignUuid,
          crewUuid: assignment.crewUuid,
          reason: "crew member has no present_rank",
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
