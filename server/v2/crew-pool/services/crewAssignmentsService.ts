import { CrewAssignmentsRepository } from "../repositories";
import { crewMembersService } from "./crewMembersService";
import type {
  InsertCrewAssignment,
  CrewAssignment,
} from "../../../../shared/v2/crew-pool/types";

const crewAssignmentsRepository = new CrewAssignmentsRepository();

export const crewAssignmentsService = {
  async getAll(crewUuid: string): Promise<CrewAssignment[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewAssignmentsRepository.findByCrewUuid(crewUuid);
  },

  async getByUuid(assignUuid: string): Promise<CrewAssignment> {
    const assignment = await crewAssignmentsRepository.findByUuid(assignUuid);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignUuid}`);
    }
    return assignment;
  },

  async getCurrent(crewUuid: string): Promise<CrewAssignment | null> {
    await crewMembersService.getByUuid(crewUuid);
    const current = await crewAssignmentsRepository.findCurrent(crewUuid);
    return current || null;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewAssignment, "assignUuid" | "crewUuid">
  ): Promise<CrewAssignment> {
    await crewMembersService.getByUuid(crewUuid);

    if (data.signOnDate && data.signOffDate) {
      const signOn = new Date(data.signOnDate);
      const signOff = new Date(data.signOffDate);
      if (signOn > signOff) {
        throw new Error("Sign on date cannot be after sign off date");
      }
    }

    return crewAssignmentsRepository.create({ ...data, crewUuid });
  },

  async update(
    assignUuid: string,
    data: Partial<InsertCrewAssignment>
  ): Promise<CrewAssignment> {
    await this.getByUuid(assignUuid);

    if (data.signOnDate && data.signOffDate) {
      const signOn = new Date(data.signOnDate);
      const signOff = new Date(data.signOffDate);
      if (signOn > signOff) {
        throw new Error("Sign on date cannot be after sign off date");
      }
    }

    const updated = await crewAssignmentsRepository.update(assignUuid, data);
    if (!updated) {
      throw new Error(`Failed to update assignment: ${assignUuid}`);
    }
    return updated;
  },

  async delete(assignUuid: string): Promise<void> {
    await this.getByUuid(assignUuid);
    const success = await crewAssignmentsRepository.softDelete(assignUuid);
    if (!success) {
      throw new Error(`Failed to delete assignment: ${assignUuid}`);
    }
  },

  async setAsCurrent(crewUuid: string, assignUuid: string): Promise<boolean> {
    await crewMembersService.getByUuid(crewUuid);
    await this.getByUuid(assignUuid);
    return crewAssignmentsRepository.setCurrentAssignment(crewUuid, assignUuid);
  },
};
