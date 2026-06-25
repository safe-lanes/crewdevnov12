import { eq, and, ilike } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  CrewLicensesRepository,
  CrewTrainingRepository,
  type CrewLicenseWithAttachments,
  type CrewTrainingCourseWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import { resolveCountryUuid } from "./masterDataResolver";
import {
  crewLicenses,
  crewLicensesAttachments,
  crewTrainingCourses,
  crewTrainingAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewLicense,
  CrewLicense,
  InsertCrewLicenseAttachment,
  CrewLicenseAttachment,
  InsertCrewTrainingCourse,
  CrewTrainingCourse,
  InsertCrewTrainingAttachment,
  CrewTrainingAttachment,
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

const crewLicensesRepository = new CrewLicensesRepository();
const crewTrainingRepository = new CrewTrainingRepository();

// Helper to extract and apply audit user fields
function applyAuditUser<T extends object>(data: T, isCreate = false): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;
  if (isCreate) result.createdByUuid = auditUserUuid;
  result.updatedByUuid = auditUserUuid;
  return result;
}

// Generate next license ID in format LIC001, LIC002, etc.
async function generateLicenseId(): Promise<string> {
  const db = getDb();
  const results = await db
    .select({ licenseId: crewLicenses.licenseId })
    .from(crewLicenses)
    .where(ilike(crewLicenses.licenseId, 'LIC%'));
  
  let maxNum = 0;
  for (const row of results) {
    if (row.licenseId) {
      const match = row.licenseId.match(/LIC(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  
  const nextNum = maxNum + 1;
  return `LIC${nextNum.toString().padStart(3, '0')}`;
}

// Generate next course ID in format SC001, SC002, etc.
async function generateCourseId(): Promise<string> {
  const db = getDb();
  const results = await db
    .select({ courseId: crewTrainingCourses.courseId })
    .from(crewTrainingCourses)
    .where(ilike(crewTrainingCourses.courseId, 'SC%'));
  
  let maxNum = 0;
  for (const row of results) {
    if (row.courseId) {
      const match = row.courseId.match(/SC(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  
  const nextNum = maxNum + 1;
  return `SC${nextNum.toString().padStart(3, '0')}`;
}

export const crewCertificatesService = {
  // ============ Licenses ============
  async getLicenses(crewUuid: string): Promise<CrewLicenseWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewLicensesRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getActiveLicenses(crewUuid: string): Promise<CrewLicense[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewLicensesRepository.findActiveByCrewUuid(crewUuid);
  },

  async getLicenseByUuid(licUuid: string): Promise<CrewLicense> {
    const license = await crewLicensesRepository.findByUuid(licUuid);
    if (!license) {
      throw new Error(`License not found: ${licUuid}`);
    }
    return license;
  },

  async createLicense(
    crewUuid: string,
    data: Omit<InsertCrewLicense, "licUuid" | "crewUuid"> & { issuingCountry?: string }
  ): Promise<CrewLicense> {
    await crewMembersService.getByUuid(crewUuid);

    // Validate that certificateDocument is provided (required field)
    if (!data.certificateDocument) {
      throw new Error("Certificate document is required");
    }

    // Resolve issuing country (accept name or UUID)
    const countryInput = data.issuingCountryUuid || (data as any).issuingCountry;
    if (countryInput) {
      const countryUuid = await resolveCountryUuid(countryInput);
      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
      }
      data.issuingCountryUuid = countryUuid;
    }

    const licenseId = data.licenseId || null;

    // Remove non-schema fields and apply audit user
    const { issuingCountry, ...cleanData } = data as any;
    const dataWithAudit = applyAuditUser(cleanData, true);

    return crewLicensesRepository.create({ ...dataWithAudit, crewUuid, licenseId });
  },

  async updateLicense(
    licUuid: string,
    data: Partial<InsertCrewLicense> & { issuingCountry?: string }
  ): Promise<CrewLicense> {
    await this.getLicenseByUuid(licUuid);

    // Resolve issuing country (accept name or UUID)
    const countryInput = data.issuingCountryUuid || (data as any).issuingCountry;
    if (countryInput) {
      const countryUuid = await resolveCountryUuid(countryInput);
      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
      }
      data.issuingCountryUuid = countryUuid;
    }

    // Remove non-schema fields and apply audit user
    const { issuingCountry, ...cleanData } = data as any;
    const dataWithAudit = applyAuditUser(cleanData, false);

    const updated = await crewLicensesRepository.update(licUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update license: ${licUuid}`);
    }
    return updated;
  },

  async deleteLicense(licUuid: string): Promise<void> {
    await this.getLicenseByUuid(licUuid);
    const success = await crewLicensesRepository.softDelete(licUuid);
    if (!success) {
      throw new Error(`Failed to delete license: ${licUuid}`);
    }
  },

  async archiveLicense(licUuid: string): Promise<boolean> {
    await this.getLicenseByUuid(licUuid);
    return crewLicensesRepository.archive(licUuid);
  },

  async unarchiveLicense(licUuid: string): Promise<boolean> {
    await this.getLicenseByUuid(licUuid);
    return crewLicensesRepository.unarchive(licUuid);
  },

  async addLicenseAttachment(
    licUuid: string,
    file: Omit<InsertCrewLicenseAttachment, "attUuid" | "licUuid">
  ): Promise<CrewLicenseAttachment> {
    await this.getLicenseByUuid(licUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewLicensesRepository.addAttachment({ ...file, licUuid });
  },

  async removeLicenseAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewLicensesRepository.findAttachmentByUuid(attUuid);
    const success = await crewLicensesRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getLicenseAttachmentFile(
    attUuid: string,
  ): Promise<CrewLicenseAttachment> {
    const attachment =
      await crewLicensesRepository.findAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },

  /**
   * Reconcile licenses with attachments - handles add/update/delete in one transaction
   */
  async reconcileLicensesWithAttachments(
    crewUuid: string,
    items: Array<{
      licUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewLicense, "licUuid" | "crewUuid">;
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>
  ): Promise<CrewLicense[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    return db.transaction(async (tx: any) => {
      const results: CrewLicense[] = [];
      const now = new Date();

      for (const item of items) {
        if (item.isDeleted && item.licUuid) {
          await tx
            .update(crewLicenses)
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewLicenses.licUuid, item.licUuid));
          continue;
        }

        let licUuid: string;

        if (item.licUuid) {
          const [updated] = await tx
            .update(crewLicenses)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewLicenses.licUuid, item.licUuid))
            .returning();
          licUuid = item.licUuid;
          results.push(updated);
        } else {
          licUuid = uuidv4();
          const [created] = await tx
            .insert(crewLicenses)
            .values({
              ...item.data,
              licUuid,
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
              const stored = await persistReconcileAttachment(
                "crew-licenses",
                att.fileName,
                att.filePath,
                att.fileData,
              );
              await tx.insert(crewLicensesAttachments).values({
                attUuid: uuidv4(),
                licUuid,
                fileName: att.fileName,
                filePath: stored.filePath,
                fileData: stored.fileData,
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

  // ============ Training ============
  async getTraining(
    crewUuid: string
  ): Promise<CrewTrainingCourseWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewTrainingRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getTrainingByUuid(trainUuid: string): Promise<CrewTrainingCourse> {
    const training = await crewTrainingRepository.findByUuid(trainUuid);
    if (!training) {
      throw new Error(`Training record not found: ${trainUuid}`);
    }
    return training;
  },

  async createTraining(
    crewUuid: string,
    data: Omit<InsertCrewTrainingCourse, "trainUuid" | "crewUuid">
  ): Promise<CrewTrainingCourse> {
    await crewMembersService.getByUuid(crewUuid);

    // Validate that trainingCourse is provided (required field)
    if (!data.trainingCourse) {
      throw new Error("Training course is required");
    }

    const courseId = data.courseId || null;

    const dataWithAudit = applyAuditUser(data, true);

    return crewTrainingRepository.create({ ...dataWithAudit, crewUuid, courseId });
  },

  async updateTraining(
    trainUuid: string,
    data: Partial<InsertCrewTrainingCourse>
  ): Promise<CrewTrainingCourse> {
    await this.getTrainingByUuid(trainUuid);
    const dataWithAudit = applyAuditUser(data, false);

    const updated = await crewTrainingRepository.update(trainUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update training: ${trainUuid}`);
    }
    return updated;
  },

  async deleteTraining(trainUuid: string): Promise<void> {
    await this.getTrainingByUuid(trainUuid);
    const success = await crewTrainingRepository.softDelete(trainUuid);
    if (!success) {
      throw new Error(`Failed to delete training: ${trainUuid}`);
    }
  },

  async addTrainingAttachment(
    trainUuid: string,
    file: Omit<InsertCrewTrainingAttachment, "attUuid" | "trainUuid">
  ): Promise<CrewTrainingAttachment> {
    await this.getTrainingByUuid(trainUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewTrainingRepository.addAttachment({ ...file, trainUuid });
  },

  async removeTrainingAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewTrainingRepository.findAttachmentByUuid(attUuid);
    const success = await crewTrainingRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getTrainingAttachmentFile(
    attUuid: string,
  ): Promise<CrewTrainingAttachment> {
    const attachment =
      await crewTrainingRepository.findAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },

  /**
   * Reconcile training with attachments - handles add/update/delete in one transaction
   */
  async reconcileTrainingWithAttachments(
    crewUuid: string,
    items: Array<{
      trainUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewTrainingCourse, "trainUuid" | "crewUuid">;
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>
  ): Promise<CrewTrainingCourse[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    return db.transaction(async (tx: any) => {
      const results: CrewTrainingCourse[] = [];
      const now = new Date();

      for (const item of items) {
        if (item.isDeleted && item.trainUuid) {
          await tx
            .update(crewTrainingCourses)
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewTrainingCourses.trainUuid, item.trainUuid));
          continue;
        }

        let trainUuid: string;

        if (item.trainUuid) {
          const [updated] = await tx
            .update(crewTrainingCourses)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewTrainingCourses.trainUuid, item.trainUuid))
            .returning();
          trainUuid = item.trainUuid;
          results.push(updated);
        } else {
          trainUuid = uuidv4();
          const [created] = await tx
            .insert(crewTrainingCourses)
            .values({
              ...item.data,
              trainUuid,
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
              const stored = await persistReconcileAttachment(
                "crew-training",
                att.fileName,
                att.filePath,
                att.fileData,
              );
              await tx.insert(crewTrainingAttachments).values({
                attUuid: uuidv4(),
                trainUuid,
                fileName: att.fileName,
                filePath: stored.filePath,
                fileData: stored.fileData,
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

  // ============ Expiry Checks ============
  async checkExpiringCertificates(crewUuid: string, withinDays: number = 30) {
    const [licenses, training] = await Promise.all([
      this.getLicenses(crewUuid),
      this.getTraining(crewUuid),
    ]);

    const now = new Date();
    const futureDate = new Date(
      now.getTime() + withinDays * 24 * 60 * 60 * 1000
    );

    const expiringLicenses = licenses.filter((lic) => {
      if (!lic.expiry) return false;
      const expiryDate = new Date(lic.expiry);
      return expiryDate <= futureDate && expiryDate >= now;
    });

    const expiringTraining = training.filter((t) => {
      if (!t.expiry) return false;
      const expiryDate = new Date(t.expiry);
      return expiryDate <= futureDate && expiryDate >= now;
    });

    return {
      expiringLicenses,
      expiringTraining,
      totalExpiring: expiringLicenses.length + expiringTraining.length,
    };
  },
};
