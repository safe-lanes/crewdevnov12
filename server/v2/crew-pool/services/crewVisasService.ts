import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { applyAuditUser } from "../../admin/utils/auditUser";
import {
  CrewVisasRepository,
  type CrewVisaWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
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
import { fileStorageService } from "../../shared/fileStorageService.js";
import { decodeStoredFile } from "../../shared/serveAttachmentHelper.js";

/**
 * Delete the on-disk file backing an attachment, if any. Legacy rows may carry
 * a base64 data URL in file_path (no disk file) — those are skipped.
 */
async function deleteAttachmentFile(filePath?: string | null): Promise<void> {
  if (!filePath || filePath.startsWith("data:")) return;
  await fileStorageService.deleteAttachment(filePath);
}

/**
 * Persist a new reconcile attachment value to disk when it is base64; otherwise
 * keep the provided relative path. Never returns base64 for storage.
 */
async function persistReconcileAttachment(
  moduleName: string,
  fileName: string,
  filePath?: string,
  fileData?: string,
): Promise<{ filePath: string | null; fileData: null }> {
  const raw = fileData || filePath || "";
  const decoded = decodeStoredFile(raw, null);
  if (decoded) {
    const storedPath = await fileStorageService.writeAttachment(
      moduleName,
      fileName,
      decoded.buffer,
    );
    return { filePath: storedPath, fileData: null };
  }
  return { filePath: filePath || null, fileData: null };
}

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
    data: Omit<InsertCrewVisa, "visaUuid" | "crewUuid"> & { country?: string | null; auditUserUuid?: string | null }
  ): Promise<CrewVisa> {
    await crewMembersService.getByUuid(crewUuid);

    if (!data.visaType) {
      throw new Error("Visa type is required");
    }

    // C2 Visas: "Issuing Country" is a free entry field, store as-is without UUID resolution
    // Store the country name directly in the "country" column
    const countryInput = (data as any).country || data.countryUuid;
    const cleanData: any = { ...data };
    if (countryInput) {
      cleanData.country = countryInput;
      // Clear countryUuid since we're storing free text
      cleanData.countryUuid = null;
    }

    const dataWithAudit = applyAuditUser(cleanData, true);
    return crewVisasRepository.create({ ...dataWithAudit, crewUuid });
  },

  async update(
    visaUuid: string,
    data: Partial<InsertCrewVisa> & { country?: string | null; auditUserUuid?: string | null }
  ): Promise<CrewVisa> {
    await this.getByUuid(visaUuid);

    // C2 Visas: "Issuing Country" is a free entry field, store as-is without UUID resolution
    const countryInput = (data as any).country || data.countryUuid;
    const cleanData: any = { ...data };
    if (countryInput) {
      cleanData.country = countryInput;
      // Clear countryUuid since we're storing free text
      cleanData.countryUuid = null;
    }

    const dataWithAudit = applyAuditUser(cleanData, false);
    const updated = await crewVisasRepository.update(visaUuid, dataWithAudit);
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
    const attachment = await crewVisasRepository.findAttachmentByUuid(attUuid);
    const success = await crewVisasRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getAttachmentFile(attUuid: string): Promise<CrewVisaAttachment> {
    const attachment = await crewVisasRepository.findAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
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
    }>,
    auditUserUuid: string | null = null
  ): Promise<CrewVisa[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    // C2 Visas: "Issuing Country" is a free entry field - no UUID resolution
    // Store the country name directly in the "country" column
    const resolvedItems = items.map((item) => {
      if (item.isDeleted) return item;

      const countryInput = (item.data as any).country || item.data.countryUuid;
      if (countryInput) {
        const cleanData: any = { ...item.data };
        cleanData.country = countryInput;
        cleanData.countryUuid = null;
        return { ...item, data: cleanData };
      }
      return item;
    });

    return db.transaction(async (tx: any) => {
      const results: CrewVisa[] = [];
      const now = new Date();

      for (const item of resolvedItems) {
        if (item.isDeleted && item.visaUuid) {
          await tx
            .update(crewVisas)
            .set(applyAuditUser({ isDeleted: true, auditUserUuid }))
            .where(eq(crewVisas.visaUuid, item.visaUuid));
          continue;
        }

        let visaUuid: string;

        if (item.visaUuid) {
          const [updated] = await tx
            .update(crewVisas)
            .set(applyAuditUser({ ...item.data, auditUserUuid }))
            .where(eq(crewVisas.visaUuid, item.visaUuid))
            .returning();
          visaUuid = item.visaUuid;
          results.push(updated);
        } else {
          visaUuid = uuidv4();
          const [created] = await tx
            .insert(crewVisas)
            .values(applyAuditUser({
              ...item.data,
              visaUuid,
              crewUuid,
              createdAt: now,
              auditUserUuid,
            }, true))
            .returning();
          results.push(created);
        }

        if (item.attachments) {
          for (const att of item.attachments) {
            if (att.isNew && (att.filePath || att.fileData)) {
              const stored = await persistReconcileAttachment(
                "crew-pool/crew-visas",
                att.fileName,
                att.filePath,
                att.fileData,
              );
              await tx.insert(crewVisasAttachments).values(applyAuditUser({
                attUuid: uuidv4(),
                visaUuid,
                fileName: att.fileName,
                filePath: stored.filePath,
                fileData: stored.fileData,
                createdAt: now,
                auditUserUuid,
              }, true));
            }
          }
        }
      }

      return results;
    });
  },
};
