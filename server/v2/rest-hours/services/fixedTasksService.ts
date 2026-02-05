import { FixedTasksRepository } from "../repositories";
import type {
  RhFixedTaskV2,
  InsertRhFixedTaskV2,
} from "../../../../shared/v2/rest-hours/types";

const fixedTasksRepository = new FixedTasksRepository();

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

export const fixedTasksService = {
  async getAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthYear?: string;
  }): Promise<RhFixedTaskV2[]> {
    return fixedTasksRepository.findAll(filters);
  },

  async getByUuid(fixedTaskUuid: string): Promise<RhFixedTaskV2> {
    const task = await fixedTasksRepository.findByUuid(fixedTaskUuid);
    if (!task) {
      throw new Error(`Fixed task not found: ${fixedTaskUuid}`);
    }
    return task;
  },

  async getByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RhFixedTaskV2 | undefined> {
    if (!crewMemberId || !vesselId || !monthYear) {
      throw new Error("Crew member ID, vessel ID, and month year are required");
    }
    return fixedTasksRepository.findByKey(crewMemberId, vesselId, monthYear);
  },

  async create(
    data: Omit<InsertRhFixedTaskV2, "fixedTaskUuid"> & { auditUserUuid?: string }
  ): Promise<RhFixedTaskV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.crewMemberId) {
      throw new Error("Crew member ID is required");
    }
    if (!data.monthYear) {
      throw new Error("Month year is required");
    }

    const dataWithAudit = applyAuditUser(data, true);
    return fixedTasksRepository.create(dataWithAudit);
  },

  async update(
    fixedTaskUuid: string,
    data: Partial<InsertRhFixedTaskV2> & { auditUserUuid?: string }
  ): Promise<RhFixedTaskV2> {
    await this.getByUuid(fixedTaskUuid);

    const dataWithAudit = applyAuditUser(data, false);
    const updated = await fixedTasksRepository.update(fixedTaskUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update fixed task: ${fixedTaskUuid}`);
    }
    return updated;
  },

  async delete(fixedTaskUuid: string): Promise<void> {
    await this.getByUuid(fixedTaskUuid);
    const success = await fixedTasksRepository.softDelete(fixedTaskUuid);
    if (!success) {
      throw new Error(`Failed to delete fixed task: ${fixedTaskUuid}`);
    }
  },
};
