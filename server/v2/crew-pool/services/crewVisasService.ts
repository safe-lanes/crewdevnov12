import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  CrewVisasRepository,
  type CrewVisaWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import { resolveCountryUuid } from "./masterDataResolver";
import {
  crewVisas,
  crewVisasAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewVisa,
  CrewVisa,
  InsertCrewVisaAttachment,
  CrewVisaAttachment,
} from "../../../../shared/v2/crew-pool/types";

const crewVisasRepository = new CrewVisasRepository();

export const crewVisasService = {
  async getAll(crewUuid: string): Promise<CrewVisaWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewVisasRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getByUuid(visaUuid: string): Promise<CrewVisa> {
    const visa = await crewVisasRepository.findByUuid(visaUuid);
    if (!visa) {
      throw new Error(`Visa not found: ${visaUuid}`);
    }
    return visa;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewVisa, "visaUuid" | "crewUuid"> & { country?: string }
  ): Promise<CrewVisa> {
    await crewMembersService.getByUuid(crewUuid);

    if (!data.visaType) {
      throw new Error("Visa type is required");
    }

    // Resolve country (accept name or UUID)
    const countryInput = data.countryUuid || (data as any).country;
    if (countryInput) {
      const countryUuid = await resolveCountryUuid(countryInput);
      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
      }
      data.countryUuid = countryUuid;
    }

    // Remove non-schema fields
    const { country, ...cleanData } = data as any;

    return crewVisasRepository.create({ ...cleanData, crewUuid });
  },

  async update(
    visaUuid: string,
    data: Partial<InsertCrewVisa> & { country?: string }
  ): Promise<CrewVisa> {
    await this.getByUuid(visaUuid);

    // Resolve country (accept name or UUID)
    const countryInput = data.countryUuid || (data as any).country;
    if (countryInput) {
      const countryUuid = await resolveCountryUuid(countryInput);
      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
      }
      data.countryUuid = countryUuid;
    }

    // Remove non-schema fields
    const { country, ...cleanData } = data as any;

    const updated = await crewVisasRepository.update(visaUuid, cleanData);
    if (!updated) {
      throw new Error(`Failed to update visa: ${visaUuid}`);
    }
    return updated;
  },

  async delete(visaUuid: string): Promise<void> {
    await this.getByUuid(visaUuid);
    const success = await crewVisasRepository.softDelete(visaUuid);
    if (!success) {
      throw new Error(`Failed to delete visa: ${visaUuid}`);
    }
  },

  async getAttachments(visaUuid: string): Promise<CrewVisaAttachment[]> {
    await this.getByUuid(visaUuid);
    return crewVisasRepository.findAttachmentsByVisaUuid(visaUuid);
  },

  async addAttachment(
    visaUuid: string,
    file: Omit<InsertCrewVisaAttachment, "attUuid" | "visaUuid">
  ): Promise<CrewVisaAttachment> {
    await this.getByUuid(visaUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewVisasRepository.addAttachment({ ...file, visaUuid });
  },

  async removeAttachment(attUuid: string): Promise<void> {
    const success = await crewVisasRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },

  async checkExpiringVisas(crewUuid: string, withinDays: number = 30) {
    const visas = await this.getAll(crewUuid);
    const now = new Date();
    const futureDate = new Date(
      now.getTime() + withinDays * 24 * 60 * 60 * 1000
    );

    return visas.filter((visa) => {
      if (!visa.expiry) return false;
      const expiryDate = new Date(visa.expiry);
      return expiryDate <= futureDate && expiryDate >= now;
    });
  },

  /**
   * Reconcile visas with attachments - handles add/update/delete in one transaction
   */
  async reconcileWithAttachments(
    crewUuid: string,
    items: Array<{
      visaUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewVisa, "visaUuid" | "crewUuid"> & { country?: string };
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>
  ): Promise<CrewVisa[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    // Pre-resolve all country UUIDs before transaction
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.isDeleted) return item;

        const countryInput = item.data.countryUuid || (item.data as any).country;
        if (countryInput) {
          const countryUuid = await resolveCountryUuid(countryInput);
          if (!countryUuid) {
            throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
          }
          const { country, ...cleanData } = item.data as any;
          return { ...item, data: { ...cleanData, countryUuid } };
        }
        return item;
      })
    );

    return db.transaction(async (tx: any) => {
      const results: CrewVisa[] = [];
      const now = new Date();

      for (const item of resolvedItems) {
        if (item.isDeleted && item.visaUuid) {
          await tx
            .update(crewVisas)
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewVisas.visaUuid, item.visaUuid));
          continue;
        }

        let visaUuid: string;

        if (item.visaUuid) {
          const [updated] = await tx
            .update(crewVisas)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewVisas.visaUuid, item.visaUuid))
            .returning();
          visaUuid = item.visaUuid;
          results.push(updated);
        } else {
          visaUuid = uuidv4();
          const [created] = await tx
            .insert(crewVisas)
            .values({
              ...item.data,
              visaUuid,
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
              await tx.insert(crewVisasAttachments).values({
                attUuid: uuidv4(),
                visaUuid,
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
