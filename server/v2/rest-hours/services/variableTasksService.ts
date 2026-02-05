import { VariableTasksRepository } from "../repositories";
import type {
  RhVariableTaskV2,
  InsertRhVariableTaskV2,
} from "../../../../shared/v2/rest-hours/types";

const variableTasksRepository = new VariableTasksRepository();

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

    const dataWithAudit = applyAuditUser(data, true);
    return variableTasksRepository.create(dataWithAudit);
  },

  async update(
    variableTaskUuid: string,
    data: Partial<InsertRhVariableTaskV2> & { auditUserUuid?: string }
  ): Promise<RhVariableTaskV2> {
    await this.getByUuid(variableTaskUuid);

    const dataWithAudit = applyAuditUser(data, false);
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
};
