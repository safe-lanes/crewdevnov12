import {
  CrewEducationRepository,
  type CrewEducationWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import type {
  InsertCrewEducation,
  CrewEducation,
  InsertCrewEducationAttachment,
  CrewEducationAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { fileStorageService } from "../../shared/fileStorageService.js";

/**
 * Delete the on-disk file backing an attachment, if any. Legacy rows may carry
 * a base64 data URL in file_path (no disk file) — those are skipped.
 */
async function deleteAttachmentFile(filePath?: string | null): Promise<void> {
  if (!filePath || filePath.startsWith("data:")) return;
  await fileStorageService.deleteAttachment(filePath);
}

const crewEducationRepository = new CrewEducationRepository();

// Helper to extract and apply audit user fields
function applyAuditUser<T extends object>(data: T, isCreate = false): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;
  if (isCreate) result.createdByUuid = auditUserUuid;
  result.updatedByUuid = auditUserUuid;
  return result;
}

export const crewEducationService = {
  async getAll(crewUuid: string): Promise<CrewEducationWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewEducationRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getByUuid(eduUuid: string): Promise<CrewEducation> {
    const edu = await crewEducationRepository.findByUuid(eduUuid);
    if (!edu) {
      throw new Error(`Education record not found: ${eduUuid}`);
    }
    return edu;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewEducation, "eduUuid" | "crewUuid">
  ): Promise<CrewEducation> {
    await crewMembersService.getByUuid(crewUuid);
    const dataWithAudit = applyAuditUser(data, true);
    return crewEducationRepository.create({ ...dataWithAudit, crewUuid });
  },

  async update(
    eduUuid: string,
    data: Partial<InsertCrewEducation>
  ): Promise<CrewEducation> {
    await this.getByUuid(eduUuid);
    const dataWithAudit = applyAuditUser(data, false);

    const updated = await crewEducationRepository.update(eduUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update education record: ${eduUuid}`);
    }
    return updated;
  },

  async delete(eduUuid: string): Promise<void> {
    await this.getByUuid(eduUuid);
    const success = await crewEducationRepository.softDelete(eduUuid);
    if (!success) {
      throw new Error(`Failed to delete education record: ${eduUuid}`);
    }
  },

  async getAttachments(eduUuid: string): Promise<CrewEducationAttachment[]> {
    await this.getByUuid(eduUuid);
    return crewEducationRepository.findAttachmentsByEduUuid(eduUuid);
  },

  async addAttachment(
    eduUuid: string,
    file: Omit<InsertCrewEducationAttachment, "attUuid" | "eduUuid">
  ): Promise<CrewEducationAttachment> {
    await this.getByUuid(eduUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewEducationRepository.addAttachment({ ...file, eduUuid });
  },

  async removeAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewEducationRepository.findAttachmentByUuid(attUuid);
    const success =
      await crewEducationRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getAttachmentFile(attUuid: string): Promise<CrewEducationAttachment> {
    const attachment =
      await crewEducationRepository.findAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },
};
