import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { applyAuditUser } from "../../admin/utils/auditUser";
import {
  CrewBriefingRepository,
  type CrewBriefingWithAttachments,
  type CrewDebriefingWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import {
  crewBriefings,
  crewBriefingAttachments,
  crewDebriefings,
  crewDebriefingAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewBriefing,
  CrewBriefing,
  InsertCrewBriefingAttachment,
  CrewBriefingAttachment,
  InsertCrewDebriefing,
  CrewDebriefing,
  InsertCrewDebriefingAttachment,
  CrewDebriefingAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { resolveVesselUuid } from "./masterDataResolver";
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

const crewBriefingRepository = new CrewBriefingRepository();

// Resolve vessel name/UUID to UUID; preserve vesselName text for display fallback
async function resolveVesselField<T extends Record<string, any>>(
  data: T
): Promise<Omit<T, "vessel">> {
  const { vessel, ...rest } = data;
  const result = { ...rest } as any;

  const vesselInput = data.vesselUuid || vessel;
  if (vesselInput) {
    const vesselUuid = await resolveVesselUuid(vesselInput);
    if (!vesselUuid) {
      throw new Error(`Invalid vessel: "${vesselInput}". Not found in master_vessels table.`);
    }
    result.vesselUuid = vesselUuid;
  }

  return result;
}

export const crewBriefingService = {
  // ============ Briefings ============
  async getBriefings(crewUuid: string): Promise<CrewBriefingWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewBriefingRepository.findBriefingsByCrewUuidWithAttachments(crewUuid);
  },

  async getBriefingByUuid(briefingUuid: string): Promise<CrewBriefing> {
    const briefing = await crewBriefingRepository.findBriefingByUuid(briefingUuid);
    if (!briefing) {
      throw new Error(`Briefing record not found: ${briefingUuid}`);
    }
    return briefing;
  },

  async createBriefing(
    crewUuid: string,
    data: Omit<InsertCrewBriefing, "briefingUuid" | "crewUuid"> & { vessel?: string; auditUserUuid?: string | null }
  ): Promise<CrewBriefing> {
    await crewMembersService.getByUuid(crewUuid);
    const resolvedData = await resolveVesselField(data);
    const dataWithAudit = applyAuditUser(resolvedData, true);
    return crewBriefingRepository.createBriefing({ ...dataWithAudit, crewUuid });
  },

  async updateBriefing(
    briefingUuid: string,
    data: Partial<InsertCrewBriefing> & { vessel?: string; auditUserUuid?: string | null }
  ): Promise<CrewBriefing> {
    await this.getBriefingByUuid(briefingUuid);
    const resolvedData = await resolveVesselField(data);
    const dataWithAudit = applyAuditUser(resolvedData, false);
    const updated = await crewBriefingRepository.updateBriefing(briefingUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update briefing record: ${briefingUuid}`);
    }
    return updated;
  },

  async deleteBriefing(briefingUuid: string): Promise<void> {
    await this.getBriefingByUuid(briefingUuid);
    const success = await crewBriefingRepository.softDeleteBriefing(briefingUuid);
    if (!success) {
      throw new Error(`Failed to delete briefing record: ${briefingUuid}`);
    }
  },

  async addBriefingAttachment(
    briefingUuid: string,
    file: Omit<InsertCrewBriefingAttachment, "attUuid" | "briefingUuid">
  ): Promise<CrewBriefingAttachment> {
    await this.getBriefingByUuid(briefingUuid);
    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }
    return crewBriefingRepository.addBriefingAttachment({ ...file, briefingUuid });
  },

  async removeBriefingAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewBriefingRepository.findBriefingAttachmentByUuid(attUuid);
    const success = await crewBriefingRepository.softDeleteBriefingAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getBriefingAttachmentFile(
    attUuid: string
  ): Promise<CrewBriefingAttachment> {
    const attachment =
      await crewBriefingRepository.findBriefingAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },

  // ============ De-briefings ============
  async getDebriefings(crewUuid: string): Promise<CrewDebriefingWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewBriefingRepository.findDebriefingsByCrewUuidWithAttachments(crewUuid);
  },

  async getDebriefingByUuid(debriefingUuid: string): Promise<CrewDebriefing> {
    const debriefing = await crewBriefingRepository.findDebriefingByUuid(debriefingUuid);
    if (!debriefing) {
      throw new Error(`De-briefing record not found: ${debriefingUuid}`);
    }
    return debriefing;
  },

  async createDebriefing(
    crewUuid: string,
    data: Omit<InsertCrewDebriefing, "debriefingUuid" | "crewUuid"> & { vessel?: string; auditUserUuid?: string | null }
  ): Promise<CrewDebriefing> {
    await crewMembersService.getByUuid(crewUuid);
    const resolvedData = await resolveVesselField(data);
    const dataWithAudit = applyAuditUser(resolvedData, true);
    return crewBriefingRepository.createDebriefing({ ...dataWithAudit, crewUuid });
  },

  async updateDebriefing(
    debriefingUuid: string,
    data: Partial<InsertCrewDebriefing> & { vessel?: string; auditUserUuid?: string | null }
  ): Promise<CrewDebriefing> {
    await this.getDebriefingByUuid(debriefingUuid);
    const resolvedData = await resolveVesselField(data);
    const dataWithAudit = applyAuditUser(resolvedData, false);
    const updated = await crewBriefingRepository.updateDebriefing(debriefingUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update de-briefing record: ${debriefingUuid}`);
    }
    return updated;
  },

  async deleteDebriefing(debriefingUuid: string): Promise<void> {
    await this.getDebriefingByUuid(debriefingUuid);
    const success = await crewBriefingRepository.softDeleteDebriefing(debriefingUuid);
    if (!success) {
      throw new Error(`Failed to delete de-briefing record: ${debriefingUuid}`);
    }
  },

  async addDebriefingAttachment(
    debriefingUuid: string,
    file: Omit<InsertCrewDebriefingAttachment, "attUuid" | "debriefingUuid">
  ): Promise<CrewDebriefingAttachment> {
    await this.getDebriefingByUuid(debriefingUuid);
    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }
    return crewBriefingRepository.addDebriefingAttachment({ ...file, debriefingUuid });
  },

  async removeDebriefingAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewBriefingRepository.findDebriefingAttachmentByUuid(attUuid);
    const success = await crewBriefingRepository.softDeleteDebriefingAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getDebriefingAttachmentFile(
    attUuid: string
  ): Promise<CrewDebriefingAttachment> {
    const attachment =
      await crewBriefingRepository.findDebriefingAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },

  // ============ Combined Data ============
  async getAllBriefingData(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewBriefingRepository.findAllBriefingDataByCrewUuid(crewUuid);
  },

  /**
   * Reconcile briefings with attachments - handles add/update/delete in one transaction
   */
  async reconcileBriefingsWithAttachments(
    crewUuid: string,
    items: Array<{
      briefingUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewBriefing, "briefingUuid" | "crewUuid"> & { vessel?: string };
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>,
    auditUserUuid: string | null = null
  ): Promise<CrewBriefing[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.isDeleted) return item;
        const resolvedData = await resolveVesselField(item.data);
        return { ...item, data: resolvedData };
      })
    );

    return db.transaction(async (tx: any) => {
      const results: CrewBriefing[] = [];
      const now = new Date();

      for (const item of resolvedItems) {
        if (item.isDeleted && item.briefingUuid) {
          await tx
            .update(crewBriefings)
            .set(applyAuditUser({ isDeleted: true, auditUserUuid }))
            .where(eq(crewBriefings.briefingUuid, item.briefingUuid));
          continue;
        }

        let briefingUuid: string;

        if (item.briefingUuid) {
          const [updated] = await tx
            .update(crewBriefings)
            .set(applyAuditUser({ ...item.data, auditUserUuid }))
            .where(eq(crewBriefings.briefingUuid, item.briefingUuid))
            .returning();
          briefingUuid = item.briefingUuid;
          results.push(updated);
        } else {
          briefingUuid = uuidv4();
          const [created] = await tx
            .insert(crewBriefings)
            .values(applyAuditUser({
              ...item.data,
              briefingUuid,
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
                "crew-pool/crew-briefing",
                att.fileName,
                att.filePath,
                att.fileData,
              );
              await tx.insert(crewBriefingAttachments).values(applyAuditUser({
                attUuid: uuidv4(),
                briefingUuid,
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

  /**
   * Reconcile de-briefings with attachments - handles add/update/delete in one transaction
   */
  async reconcileDebriefingsWithAttachments(
    crewUuid: string,
    items: Array<{
      debriefingUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewDebriefing, "debriefingUuid" | "crewUuid"> & { vessel?: string };
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>,
    auditUserUuid: string | null = null
  ): Promise<CrewDebriefing[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.isDeleted) return item;
        const resolvedData = await resolveVesselField(item.data);
        return { ...item, data: resolvedData };
      })
    );

    return db.transaction(async (tx: any) => {
      const results: CrewDebriefing[] = [];
      const now = new Date();

      for (const item of resolvedItems) {
        if (item.isDeleted && item.debriefingUuid) {
          await tx
            .update(crewDebriefings)
            .set(applyAuditUser({ isDeleted: true, auditUserUuid }))
            .where(eq(crewDebriefings.debriefingUuid, item.debriefingUuid));
          continue;
        }

        let debriefingUuid: string;

        if (item.debriefingUuid) {
          const [updated] = await tx
            .update(crewDebriefings)
            .set(applyAuditUser({ ...item.data, auditUserUuid }))
            .where(eq(crewDebriefings.debriefingUuid, item.debriefingUuid))
            .returning();
          debriefingUuid = item.debriefingUuid;
          results.push(updated);
        } else {
          debriefingUuid = uuidv4();
          const [created] = await tx
            .insert(crewDebriefings)
            .values(applyAuditUser({
              ...item.data,
              debriefingUuid,
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
                "crew-pool/crew-debriefing",
                att.fileName,
                att.filePath,
                att.fileData,
              );
              await tx.insert(crewDebriefingAttachments).values(applyAuditUser({
                attUuid: uuidv4(),
                debriefingUuid,
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
