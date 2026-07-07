import { VariableTasksRepository, CrewRecordsRepository, DailyRecordsRepository, VesselRecordsRepository } from "../repositories";
import type {
  RhVariableTaskV2,
  InsertRhVariableTaskV2,
} from "../../../../shared/v2/rest-hours/types";
import { detectActivityConflict } from "../utils/activityConflictHelpers";
import { rankResolutionService, toIsoDate } from "./rankResolutionService";

const variableTasksRepository = new VariableTasksRepository();
const crewRecordsRepository = new CrewRecordsRepository();
const dailyRecordsRepository = new DailyRecordsRepository();
const vesselRecordsRepository = new VesselRecordsRepository();

/**
 * Authoritatively stamp each involved crew member's rank with the rank they
 * held on the task's start date, derived from the promotion ledger. This keeps
 * the `crew_involved_details` snapshot historically correct for new, back-dated,
 * and edited tasks regardless of what rank the client submitted.
 *
 * The crew rank lives only inside the `crew_involved_details` JSON
 * (`{ crew: [{ id, rank, name, department }], ... }`). Crew are matched by id
 * (empNo / crew_member_id); a member whose rank cannot be resolved keeps the
 * rank already on the payload. Non-fatal: any failure leaves the payload as-is.
 */
async function stampHistoricalRanks<T extends { crewInvolvedDetails?: string | null; startDateTimeSort?: string | null; startDateTime?: string | null }>(
  data: T,
  fallbackStart?: string | null,
): Promise<T> {
  try {
    if (!data.crewInvolvedDetails) return data;

    const isoDate =
      toIsoDate(data.startDateTimeSort) ||
      toIsoDate(fallbackStart) ||
      toIsoDate(data.startDateTime);
    if (!isoDate) return data;

    const details = JSON.parse(data.crewInvolvedDetails);
    if (!details || !Array.isArray(details.crew) || details.crew.length === 0) {
      return data;
    }

    const crewIds = details.crew
      .map((c: any) => c?.id)
      .filter((id: any): id is string => typeof id === "string" && id.length > 0);
    if (crewIds.length === 0) return data;

    const rankMap = await rankResolutionService.resolveRanksAsOfDate(crewIds, isoDate);

    details.crew = details.crew.map((c: any) =>
      c && typeof c.id === "string" && rankMap[c.id]
        ? { ...c, rank: rankMap[c.id] }
        : c
    );

    return { ...data, crewInvolvedDetails: JSON.stringify(details) };
  } catch (error) {
    console.error("[variable-tasks] Failed to stamp historical ranks (non-fatal):", error);
    return data;
  }
}

function applyAuditUser<T extends object>(
  data: T,
  isCreate = false
): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;

  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;

  return result;
}

export const variableTasksService = {
  async getAll(filters?: {
    vesselId?: string;
    periodValue?: string;
    isDraft?: boolean;
  }): Promise<RhVariableTaskV2[]> {
    return variableTasksRepository.findAll(filters);
  },

  async getByUuid(variableTaskUuid: string): Promise<RhVariableTaskV2> {
    const task = await variableTasksRepository.findByUuid(variableTaskUuid);
    if (!task) {
      throw new Error(`Variable task not found: ${variableTaskUuid}`);
    }
    return task;
  },

  async getByVesselAndPeriod(
    vesselId: string,
    periodValue: string
  ): Promise<RhVariableTaskV2[]> {
    if (!vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!periodValue) {
      throw new Error("Period value is required");
    }
    return variableTasksRepository.findAll({ vesselId, periodValue });
  },

  async getDrafts(vesselId?: string): Promise<RhVariableTaskV2[]> {
    return variableTasksRepository.findAll({ vesselId, isDraft: true });
  },

  async create(
    data: Omit<InsertRhVariableTaskV2, "variableTaskUuid"> & { auditUserUuid?: string }
  ): Promise<RhVariableTaskV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.periodValue) {
      throw new Error("Period value is required");
    }

    const dataWithRanks = await stampHistoricalRanks(data);
    const dataWithAudit = applyAuditUser(dataWithRanks, true);
    return variableTasksRepository.create(dataWithAudit);
  },

  async update(
    variableTaskUuid: string,
    data: Partial<InsertRhVariableTaskV2> & { auditUserUuid?: string }
  ): Promise<RhVariableTaskV2> {
    const existing = await this.getByUuid(variableTaskUuid);

    const dataWithRanks = await stampHistoricalRanks(data, existing.startDateTimeSort);
    const dataWithAudit = applyAuditUser(dataWithRanks, false);
    const updated = await variableTasksRepository.update(variableTaskUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update variable task: ${variableTaskUuid}`);
    }
    return updated;
  },

  async delete(variableTaskUuid: string): Promise<void> {
    await this.getByUuid(variableTaskUuid);
    const success = await variableTasksRepository.softDelete(variableTaskUuid);
    if (!success) {
      throw new Error(`Failed to delete variable task: ${variableTaskUuid}`);
    }
  },

  async saveAsDraft(
    data: Omit<InsertRhVariableTaskV2, "variableTaskUuid"> & { auditUserUuid?: string }
  ): Promise<RhVariableTaskV2> {
    return this.create({
      ...data,
      isDraft: true,
    });
  },

  async publishDraft(
    variableTaskUuid: string,
    auditUserUuid?: string
  ): Promise<RhVariableTaskV2> {
    const task = await this.getByUuid(variableTaskUuid);
    
    if (!task.isDraft) {
      throw new Error("Task is not a draft");
    }

    return this.update(variableTaskUuid, {
      isDraft: false,
      auditUserUuid,
    });
  },

  async recalculateConflictsForVessel(vesselId: string, monthValue: string): Promise<void> {
    try {
      const variableTasks = await variableTasksRepository.findAll({ vesselId, periodValue: monthValue, isDraft: false });

      const crewRecords = await crewRecordsRepository.findAll({ vesselId, monthValue });
      if (crewRecords.length === 0) return;

      const dailyRecords = await dailyRecordsRepository.findAll({ vesselId, monthYear: monthValue });
      const dailyRecordsMap = new Map<string, string>();
      for (const dr of dailyRecords) {
        dailyRecordsMap.set(dr.crewMemberId, dr.dailyRecords);
      }

      for (const crewRecord of crewRecords) {
        const dailyRecordsJson = dailyRecordsMap.get(crewRecord.crewMemberId);
        let conflicting = false;

        if (dailyRecordsJson && variableTasks.length > 0) {
          conflicting = detectActivityConflict(
            crewRecord.crewMemberId,
            variableTasks,
            dailyRecordsJson,
            monthValue
          );
        }

        if (crewRecord.activityConflicting !== conflicting) {
          await crewRecordsRepository.update(crewRecord.rhCrewRecordUuid, {
            activityConflicting: conflicting,
          });
        }
      }

      const updatedCrewRecords = await crewRecordsRepository.findAll({ vesselId, monthValue });
      const crewWithConflicts = updatedCrewRecords.filter(r => r.activityConflicting === true);
      const hasConflicts = crewWithConflicts.length > 0;
      const crewWithActivityConflictsDetails = crewWithConflicts.length > 0
        ? JSON.stringify(crewWithConflicts.map(r => ({ name: r.name, rank: r.rank })))
        : null;

      const vesselRecords = await vesselRecordsRepository.findAll({ vesselId, monthValue });
      const vesselRecord = vesselRecords[0];
      if (vesselRecord) {
        await vesselRecordsRepository.update(vesselRecord.rhVesselUuid, {
          activityConflicting: hasConflicts,
          crewWithActivityConflicts: crewWithConflicts.length,
          crewWithActivityConflictsDetails,
        });
      }
    } catch (error) {
      console.error('Failed to recalculate conflicts for vessel:', error);
    }
  },
};
