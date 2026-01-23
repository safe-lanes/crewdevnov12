import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  CrewSeaServiceRepository,
  type CrewSeaServiceWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import {
  crewSeaService,
  crewSeaServiceAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewSeaService,
  CrewSeaService as CrewSeaServiceType,
  InsertCrewSeaServiceAttachment,
  CrewSeaServiceAttachment,
} from "../../../../shared/v2/crew-pool/types";

const crewSeaServiceRepository = new CrewSeaServiceRepository();

export interface ExperienceMetrics {
  totalSeaTimeMonths: number;
  companySeaTimeMonths: number;
  externalSeaTimeMonths: number;
  rankExperienceMonths: number;
  vesselTypeExperience: Record<string, number>;
}

export const crewSeaServiceService = {
  async getAll(crewUuid: string): Promise<CrewSeaServiceWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewSeaServiceRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getByType(
    crewUuid: string,
    serviceType: string
  ): Promise<CrewSeaServiceType[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewSeaServiceRepository.findByCrewUuidAndType(
      crewUuid,
      serviceType
    );
  },

  async getByUuid(seaUuid: string): Promise<CrewSeaServiceType> {
    const service = await crewSeaServiceRepository.findByUuid(seaUuid);
    if (!service) {
      throw new Error(`Sea service record not found: ${seaUuid}`);
    }
    return service;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewSeaService, "seaUuid" | "crewUuid">
  ): Promise<CrewSeaServiceType> {
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
  ): Promise<CrewSeaServiceType> {
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

  /**
   * Calculate experience metrics from sea service records
   * Used by: Officer Matrix, Oil Major Compliance Engine
   */
  calculateExperienceMetrics(
    seaServiceRecords: CrewSeaServiceType[],
    currentRank: string
  ): ExperienceMetrics {
    let companySeaTimeMonths = 0;
    let externalSeaTimeMonths = 0;
    let rankExperienceMonths = 0;
    const vesselTypeExperience: Record<string, number> = {};

    for (const service of seaServiceRecords) {
      const months = this.calculatePeriodMonths(service.fromDate, service.toDate);

      const isCompanyService = service.serviceType === "company";
      if (isCompanyService) {
        companySeaTimeMonths += months;
      } else {
        externalSeaTimeMonths += months;
      }

      if (service.rank === currentRank) {
        rankExperienceMonths += months;
      }

      if (service.vesselTypeUuid) {
        vesselTypeExperience[service.vesselTypeUuid] =
          (vesselTypeExperience[service.vesselTypeUuid] || 0) + months;
      }
    }

    return {
      totalSeaTimeMonths: companySeaTimeMonths + externalSeaTimeMonths,
      companySeaTimeMonths,
      externalSeaTimeMonths,
      rankExperienceMonths,
      vesselTypeExperience,
    };
  },

  /**
   * Calculate period in months between two dates
   */
  calculatePeriodMonths(
    fromDate: string | Date | null | undefined,
    toDate: string | Date | null | undefined
  ): number {
    if (!fromDate || !toDate) return 0;
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const diffTime = to.getTime() - from.getTime();
      return Math.max(0, diffTime / (1000 * 60 * 60 * 24 * 30.44));
    } catch {
      return 0;
    }
  },

  /**
   * Get all sea service for a crew member with experience metrics
   */
  async getAllWithMetrics(
    crewUuid: string,
    currentRank: string
  ): Promise<{
    records: CrewSeaServiceWithAttachments[];
    metrics: ExperienceMetrics;
  }> {
    const records = await this.getAll(crewUuid);
    const metrics = this.calculateExperienceMetrics(records, currentRank);
    return { records, metrics };
  },

  /**
   * Reconcile sea service with attachments - handles add/update/delete in one transaction
   */
  async reconcileWithAttachments(
    crewUuid: string,
    items: Array<{
      seaUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewSeaService, "seaUuid" | "crewUuid">;
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>
  ): Promise<CrewSeaServiceType[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    return db.transaction(async (tx: any) => {
      const results: CrewSeaServiceType[] = [];
      const now = new Date();

      for (const item of items) {
        if (item.isDeleted && item.seaUuid) {
          await tx
            .update(crewSeaService)
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewSeaService.seaUuid, item.seaUuid));
          continue;
        }

        let seaUuid: string;

        if (item.seaUuid) {
          const [updated] = await tx
            .update(crewSeaService)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewSeaService.seaUuid, item.seaUuid))
            .returning();
          seaUuid = item.seaUuid;
          results.push(updated);
        } else {
          seaUuid = uuidv4();
          const [created] = await tx
            .insert(crewSeaService)
            .values({
              ...item.data,
              seaUuid,
              crewUuid,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          results.push(created);
        }

        if (item.attachments) {
          for (const att of item.attachments) {
            if (att.isNew && (att.filePath || att.fileData)) {
              await tx.insert(crewSeaServiceAttachments).values({
                attUuid: uuidv4(),
                seaUuid,
                fileName: att.fileName,
                filePath: att.filePath || null,
                fileData: att.fileData || null,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }

      return results;
    });
  },
};
