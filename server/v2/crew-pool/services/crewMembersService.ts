import { CrewMembersRepository } from "../repositories";
import type {
  InsertCrewMemberV2,
  CrewMemberV2,
} from "../../../../shared/v2/crew-pool/types";

const crewMembersRepository = new CrewMembersRepository();

export const crewMembersService = {
  async getAll(filters?: {
    status?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<CrewMemberV2[]> {
    return crewMembersRepository.findAll(filters);
  },

  async getById(id: number): Promise<CrewMemberV2> {
    const crew = await crewMembersRepository.findById(id);
    if (!crew) {
      throw new Error(`Crew member not found with id: ${id}`);
    }
    return crew;
  },

  async getByUuid(crewUuid: string): Promise<CrewMemberV2> {
    const crew = await crewMembersRepository.findByUuid(crewUuid);
    if (!crew) {
      throw new Error(`Crew member not found: ${crewUuid}`);
    }
    return crew;
  },

  async getByEmpNo(empNo: string): Promise<CrewMemberV2> {
    const crew = await crewMembersRepository.findByEmpNo(empNo);
    if (!crew) {
      throw new Error(`Crew member not found with employee number: ${empNo}`);
    }
    return crew;
  },

  async create(
    data: Omit<InsertCrewMemberV2, "crewUuid">
  ): Promise<CrewMemberV2> {
    if (!data.firstName || !data.familyName) {
      throw new Error("First name and family name are required");
    }
    if (!data.empNo) {
      throw new Error("Employee number is required");
    }

    const existing = await crewMembersRepository.findByEmpNo(data.empNo);
    if (existing) {
      throw new Error(
        `Crew member with employee number ${data.empNo} already exists`
      );
    }

    return crewMembersRepository.create(data);
  },

  async update(
    crewUuid: string,
    data: Partial<InsertCrewMemberV2>
  ): Promise<CrewMemberV2> {
    await this.getByUuid(crewUuid);

    if (data.empNo) {
      const existing = await crewMembersRepository.findByEmpNo(data.empNo);
      if (existing && existing.crewUuid !== crewUuid) {
        throw new Error(
          `Employee number ${data.empNo} is already in use by another crew member`
        );
      }
    }

    const updated = await crewMembersRepository.update(crewUuid, data);
    if (!updated) {
      throw new Error(`Failed to update crew member: ${crewUuid}`);
    }
    return updated;
  },

  async updateById(
    id: number,
    data: Partial<InsertCrewMemberV2>
  ): Promise<CrewMemberV2> {
    const existing = await this.getById(id);

    if (data.empNo) {
      const empNoCheck = await crewMembersRepository.findByEmpNo(data.empNo);
      if (empNoCheck && empNoCheck.id !== id) {
        throw new Error(
          `Employee number ${data.empNo} is already in use by another crew member`
        );
      }
    }

    const updated = await crewMembersRepository.updateById(id, data);
    if (!updated) {
      throw new Error(`Failed to update crew member with id: ${id}`);
    }
    return updated;
  },

  async archive(crewUuid: string): Promise<void> {
    await this.getByUuid(crewUuid);
    const success = await crewMembersRepository.softDelete(crewUuid);
    if (!success) {
      throw new Error(`Failed to archive crew member: ${crewUuid}`);
    }
  },

  async archiveById(id: number): Promise<void> {
    await this.getById(id);
    const success = await crewMembersRepository.softDeleteById(id);
    if (!success) {
      throw new Error(`Failed to archive crew member with id: ${id}`);
    }
  },

  async unarchive(crewUuid: string): Promise<void> {
    const success = await crewMembersRepository.unarchive(crewUuid);
    if (!success) {
      throw new Error(`Failed to unarchive crew member: ${crewUuid}`);
    }
  },

  async uploadPhoto(
    crewUuid: string,
    photoPath: string
  ): Promise<CrewMemberV2> {
    return this.update(crewUuid, { uploadedPhoto: photoPath });
  },

  async removePhoto(crewUuid: string): Promise<CrewMemberV2> {
    return this.update(crewUuid, { uploadedPhoto: null });
  },
};
