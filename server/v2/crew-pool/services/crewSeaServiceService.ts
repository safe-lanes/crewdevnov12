import {
  CrewSeaServiceRepository,
  type CrewSeaServiceWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import type {
  InsertCrewSeaService,
  CrewSeaService,
  InsertCrewSeaServiceAttachment,
  CrewSeaServiceAttachment,
} from "../../../../shared/v2/crew-pool/types";

const crewSeaServiceRepository = new CrewSeaServiceRepository();

export const crewSeaServiceService = {
  async getAll(crewUuid: string): Promise<CrewSeaServiceWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewSeaServiceRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getByType(
    crewUuid: string,
    serviceType: string
  ): Promise<CrewSeaService[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewSeaServiceRepository.findByCrewUuidAndType(
      crewUuid,
      serviceType
    );
  },

  async getByUuid(seaUuid: string): Promise<CrewSeaService> {
    const service = await crewSeaServiceRepository.findByUuid(seaUuid);
    if (!service) {
      throw new Error(`Sea service record not found: ${seaUuid}`);
    }
    return service;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewSeaService, "seaUuid" | "crewUuid">
  ): Promise<CrewSeaService> {
    await crewMembersService.getByUuid(crewUuid);

    if (data.fromDate && data.toDate) {
      const fromDate = new Date(data.fromDate);
      const toDate = new Date(data.toDate);
      if (fromDate > toDate) {
        throw new Error("From date cannot be after to date");
      }
    }

    return crewSeaServiceRepository.create({ ...data, crewUuid });
  },

  async update(
    seaUuid: string,
    data: Partial<InsertCrewSeaService>
  ): Promise<CrewSeaService> {
    await this.getByUuid(seaUuid);

    if (data.fromDate && data.toDate) {
      const fromDate = new Date(data.fromDate);
      const toDate = new Date(data.toDate);
      if (fromDate > toDate) {
        throw new Error("From date cannot be after to date");
      }
    }

    const updated = await crewSeaServiceRepository.update(seaUuid, data);
    if (!updated) {
      throw new Error(`Failed to update sea service record: ${seaUuid}`);
    }
    return updated;
  },

  async delete(seaUuid: string): Promise<void> {
    await this.getByUuid(seaUuid);
    const success = await crewSeaServiceRepository.softDelete(seaUuid);
    if (!success) {
      throw new Error(`Failed to delete sea service record: ${seaUuid}`);
    }
  },

  async getAttachments(seaUuid: string): Promise<CrewSeaServiceAttachment[]> {
    await this.getByUuid(seaUuid);
    return crewSeaServiceRepository.findAttachmentsBySeaUuid(seaUuid);
  },

  async addAttachment(
    seaUuid: string,
    file: Omit<InsertCrewSeaServiceAttachment, "attUuid" | "seaUuid">
  ): Promise<CrewSeaServiceAttachment> {
    await this.getByUuid(seaUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewSeaServiceRepository.addAttachment({ ...file, seaUuid });
  },

  async removeAttachment(attUuid: string): Promise<void> {
    const success =
      await crewSeaServiceRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },

  async getTotalExperience(crewUuid: string) {
    const services = await this.getAll(crewUuid);

    let totalDays = 0;
    for (const service of services) {
      if (service.fromDate && service.toDate) {
        const start = new Date(service.fromDate);
        const end = new Date(service.toDate);
        totalDays += Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    return {
      totalDays,
      totalMonths: Math.floor(totalDays / 30),
      totalYears: Math.floor(totalDays / 365),
      serviceCount: services.length,
    };
  },

  async getExperienceByType(crewUuid: string, serviceType: string) {
    const services = await this.getByType(crewUuid, serviceType);

    let totalDays = 0;
    for (const service of services) {
      if (service.fromDate && service.toDate) {
        const start = new Date(service.fromDate);
        const end = new Date(service.toDate);
        totalDays += Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    return {
      serviceType,
      totalDays,
      totalMonths: Math.floor(totalDays / 30),
      totalYears: Math.floor(totalDays / 365),
      serviceCount: services.length,
    };
  },
};
