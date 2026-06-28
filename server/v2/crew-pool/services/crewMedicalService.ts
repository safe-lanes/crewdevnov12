import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { applyAuditUser } from "../../admin/utils/auditUser";
import {
  CrewMedicalRepository,
  type CrewPreJoiningMedicalWithAttachments,
  type CrewDoctorVisitWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import {
  crewPreJoiningMedicals,
  crewMedicalAttachments,
  crewDoctorVisits,
  crewDoctorVisitsAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewPreJoiningMedical,
  CrewPreJoiningMedical,
  InsertCrewMedicalAttachment,
  CrewMedicalAttachment,
  InsertCrewDoctorVisit,
  CrewDoctorVisit,
  InsertCrewDoctorVisitAttachment,
  CrewDoctorVisitAttachment,
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

const crewMedicalRepository = new CrewMedicalRepository();

export const crewMedicalService = {
  // ============ Pre-Joining Medicals ============
  async getMedicals(
    crewUuid: string
  ): Promise<CrewPreJoiningMedicalWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.findMedicalsByCrewUuidWithAttachments(
      crewUuid
    );
  },

  async getMedicalByUuid(medUuid: string): Promise<CrewPreJoiningMedical> {
    const medical = await crewMedicalRepository.findMedicalByUuid(medUuid);
    if (!medical) {
      throw new Error(`Medical record not found: ${medUuid}`);
    }
    return medical;
  },

  async createMedical(
    crewUuid: string,
    data: Omit<InsertCrewPreJoiningMedical, "medUuid" | "crewUuid"> & { vessel?: string }
  ): Promise<CrewPreJoiningMedical> {
    await crewMembersService.getByUuid(crewUuid);
    
    // Resolve vessel to UUID for F1 Pre Joining Medicals
    const resolvedData = await this.resolveMedicalMasterDataFields(data);
    const dataWithAudit = applyAuditUser(resolvedData, true);
    
    return crewMedicalRepository.createMedical({ ...dataWithAudit, crewUuid });
  },

  async updateMedical(
    medUuid: string,
    data: Partial<InsertCrewPreJoiningMedical> & { vessel?: string }
  ): Promise<CrewPreJoiningMedical> {
    await this.getMedicalByUuid(medUuid);

    // Resolve vessel to UUID for F1 Pre Joining Medicals
    const resolvedData = await this.resolveMedicalMasterDataFields(data);
    const dataWithAudit = applyAuditUser(resolvedData, false);

    const updated = await crewMedicalRepository.updateMedical(medUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update medical record: ${medUuid}`);
    }
    return updated;
  },

  /**
   * Resolve vessel to UUID for F1 Pre Joining Medicals
   * Note: F2 Doctor Visits has vessel as free entry (skip)
   */
  async resolveMedicalMasterDataFields<T extends Record<string, any>>(
    data: T
  ): Promise<Omit<T, 'vessel'>> {
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
  },

  async deleteMedical(medUuid: string): Promise<void> {
    await this.getMedicalByUuid(medUuid);
    const success = await crewMedicalRepository.softDeleteMedical(medUuid);
    if (!success) {
      throw new Error(`Failed to delete medical record: ${medUuid}`);
    }
  },

  async addMedicalAttachment(
    medUuid: string,
    file: Omit<InsertCrewMedicalAttachment, "attUuid" | "medUuid">
  ): Promise<CrewMedicalAttachment> {
    await this.getMedicalByUuid(medUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewMedicalRepository.addMedicalAttachment({ ...file, medUuid });
  },

  async removeMedicalAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewMedicalRepository.findAttachmentByUuid(attUuid);
    const success =
      await crewMedicalRepository.softDeleteMedicalAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getMedicalAttachmentFile(
    attUuid: string
  ): Promise<CrewMedicalAttachment> {
    const attachment =
      await crewMedicalRepository.findAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },

  // ============ Doctor Visits ============
  async getDoctorVisits(
    crewUuid: string
  ): Promise<CrewDoctorVisitWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.findVisitsByCrewUuidWithAttachments(crewUuid);
  },

  async getVisitByUuid(visitUuid: string): Promise<CrewDoctorVisit> {
    const visit = await crewMedicalRepository.findVisitByUuid(visitUuid);
    if (!visit) {
      throw new Error(`Doctor visit not found: ${visitUuid}`);
    }
    return visit;
  },

  async createVisit(
    crewUuid: string,
    data: Omit<InsertCrewDoctorVisit, "visitUuid" | "crewUuid">
  ): Promise<CrewDoctorVisit> {
    await crewMembersService.getByUuid(crewUuid);
    const dataWithAudit = applyAuditUser(data, true);
    return crewMedicalRepository.createVisit({ ...dataWithAudit, crewUuid });
  },

  async updateVisit(
    visitUuid: string,
    data: Partial<InsertCrewDoctorVisit>
  ): Promise<CrewDoctorVisit> {
    await this.getVisitByUuid(visitUuid);
    const dataWithAudit = applyAuditUser(data, false);

    const updated = await crewMedicalRepository.updateVisit(visitUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update doctor visit: ${visitUuid}`);
    }
    return updated;
  },

  async deleteVisit(visitUuid: string): Promise<void> {
    await this.getVisitByUuid(visitUuid);
    const success = await crewMedicalRepository.softDeleteVisit(visitUuid);
    if (!success) {
      throw new Error(`Failed to delete doctor visit: ${visitUuid}`);
    }
  },

  async addVisitAttachment(
    visitUuid: string,
    file: Omit<InsertCrewDoctorVisitAttachment, "attUuid" | "visitUuid">
  ): Promise<CrewDoctorVisitAttachment> {
    await this.getVisitByUuid(visitUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewMedicalRepository.addVisitAttachment({ ...file, visitUuid });
  },

  async removeVisitAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewMedicalRepository.findVisitAttachmentByUuid(attUuid);
    const success =
      await crewMedicalRepository.softDeleteVisitAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getVisitAttachmentFile(
    attUuid: string
  ): Promise<CrewDoctorVisitAttachment> {
    const attachment =
      await crewMedicalRepository.findVisitAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },

  // ============ Fitness Status ============
  async getFitnessStatus(crewUuid: string) {
    const medicals = await this.getMedicals(crewUuid);

    if (medicals.length === 0) {
      return {
        status: "unknown",
        message: "No medical records found",
        latestMedical: null,
      };
    }

    const sortedMedicals = [...medicals].sort((a, b) => {
      const dateA = a.examinationDate
        ? new Date(a.examinationDate).getTime()
        : 0;
      const dateB = b.examinationDate
        ? new Date(b.examinationDate).getTime()
        : 0;
      return dateB - dateA;
    });

    const latestMedical = sortedMedicals[0];

    if (
      latestMedical.expiryDate &&
      new Date(latestMedical.expiryDate) < new Date()
    ) {
      return {
        status: "expired",
        message: "Medical certificate expired",
        expiryDate: latestMedical.expiryDate,
        latestMedical,
      };
    }

    return {
      status: "valid",
      fitForDuty: latestMedical.fitForDuty,
      expiryDate: latestMedical.expiryDate,
      latestMedical,
    };
  },

  // ============ Combined Data ============
  async getAllMedicalData(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewMedicalRepository.findAllMedicalDataByCrewUuid(crewUuid);
  },

  /**
   * Reconcile medicals with attachments - handles add/update/delete in one transaction
   * Note: F1 Pre Joining Medicals - vesselUuid is resolved from master
   */
  async reconcileMedicalsWithAttachments(
    crewUuid: string,
    items: Array<{
      medUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewPreJoiningMedical, "medUuid" | "crewUuid"> & { vessel?: string };
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>,
    auditUserUuid: string | null = null
  ): Promise<CrewPreJoiningMedical[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    // Pre-resolve all vessel UUIDs before transaction
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.isDeleted) return item;
        const resolvedData = await this.resolveMedicalMasterDataFields(item.data);
        return { ...item, data: resolvedData };
      })
    );

    return db.transaction(async (tx: any) => {
      const results: CrewPreJoiningMedical[] = [];
      const now = new Date();

      for (const item of resolvedItems) {
        if (item.isDeleted && item.medUuid) {
          await tx
            .update(crewPreJoiningMedicals)
            .set(applyAuditUser({ isDeleted: true, auditUserUuid }))
            .where(eq(crewPreJoiningMedicals.medUuid, item.medUuid));
          continue;
        }

        let medUuid: string;

        if (item.medUuid) {
          const [updated] = await tx
            .update(crewPreJoiningMedicals)
            .set(applyAuditUser({ ...item.data, auditUserUuid }))
            .where(eq(crewPreJoiningMedicals.medUuid, item.medUuid))
            .returning();
          medUuid = item.medUuid;
          results.push(updated);
        } else {
          medUuid = uuidv4();
          const [created] = await tx
            .insert(crewPreJoiningMedicals)
            .values(applyAuditUser({
              ...item.data,
              medUuid,
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
              await tx.insert(crewMedicalAttachments).values(applyAuditUser({
                attUuid: uuidv4(),
                medUuid,
                fileName: att.fileName,
                filePath: att.filePath || null,
                fileData: att.fileData || null,
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
   * Reconcile doctor visits with attachments - handles add/update/delete in one transaction
   */
  async reconcileVisitsWithAttachments(
    crewUuid: string,
    items: Array<{
      visitUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewDoctorVisit, "visitUuid" | "crewUuid">;
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>,
    auditUserUuid: string | null = null
  ): Promise<CrewDoctorVisit[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    return db.transaction(async (tx: any) => {
      const results: CrewDoctorVisit[] = [];
      const now = new Date();

      for (const item of items) {
        if (item.isDeleted && item.visitUuid) {
          await tx
            .update(crewDoctorVisits)
            .set(applyAuditUser({ isDeleted: true, auditUserUuid }))
            .where(eq(crewDoctorVisits.visitUuid, item.visitUuid));
          continue;
        }

        let visitUuid: string;

        if (item.visitUuid) {
          const [updated] = await tx
            .update(crewDoctorVisits)
            .set(applyAuditUser({ ...item.data, auditUserUuid }))
            .where(eq(crewDoctorVisits.visitUuid, item.visitUuid))
            .returning();
          visitUuid = item.visitUuid;
          results.push(updated);
        } else {
          visitUuid = uuidv4();
          const [created] = await tx
            .insert(crewDoctorVisits)
            .values(applyAuditUser({
              ...item.data,
              visitUuid,
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
              await tx.insert(crewDoctorVisitsAttachments).values(applyAuditUser({
                attUuid: uuidv4(),
                visitUuid,
                fileName: att.fileName,
                filePath: att.filePath || null,
                fileData: att.fileData || null,
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
