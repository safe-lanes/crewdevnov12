import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { applyAuditUser } from "../../admin/utils/auditUser";
import {
  CrewDocumentsRepository,
  type CrewDocumentWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import { resolveCountryUuid } from "./masterDataResolver";
import {
  crewDocuments,
  crewDocumentsAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewDocument,
  CrewDocument,
  InsertCrewDocumentAttachment,
  CrewDocumentAttachment,
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

const crewDocumentsRepository = new CrewDocumentsRepository();

export const crewDocumentsService = {
  async getAll(crewUuid: string): Promise<CrewDocumentWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewDocumentsRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getByUuid(docUuid: string): Promise<CrewDocument> {
    const doc = await crewDocumentsRepository.findByUuid(docUuid);
    if (!doc) {
      throw new Error(`Document not found: ${docUuid}`);
    }
    return doc;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewDocument, "docUuid" | "crewUuid"> & { issuingCountry?: string }
  ): Promise<CrewDocument> {
    await crewMembersService.getByUuid(crewUuid);

    if (!data.documentName && !data.documentId) {
      throw new Error("Document name or ID is required");
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

    // Remove non-schema fields and apply audit user
    const { issuingCountry, ...cleanData } = data as any;
    const dataWithAudit = applyAuditUser(cleanData, true);

    return crewDocumentsRepository.create({ ...dataWithAudit, crewUuid });
  },

  async update(
    docUuid: string,
    data: Partial<InsertCrewDocument> & { issuingCountry?: string }
  ): Promise<CrewDocument> {
    await this.getByUuid(docUuid);

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

    const updated = await crewDocumentsRepository.update(docUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update document: ${docUuid}`);
    }
    return updated;
  },

  async delete(docUuid: string): Promise<void> {
    await this.getByUuid(docUuid);
    const success = await crewDocumentsRepository.softDelete(docUuid);
    if (!success) {
      throw new Error(`Failed to delete document: ${docUuid}`);
    }
  },

  async getAttachments(docUuid: string): Promise<CrewDocumentAttachment[]> {
    await this.getByUuid(docUuid);
    return crewDocumentsRepository.findAttachmentsByDocUuid(docUuid);
  },

  async addAttachment(
    docUuid: string,
    file: Omit<InsertCrewDocumentAttachment, "attUuid" | "docUuid">
  ): Promise<CrewDocumentAttachment> {
    await this.getByUuid(docUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewDocumentsRepository.addAttachment({ ...file, docUuid });
  },

  async removeAttachment(attUuid: string): Promise<void> {
    const attachment =
      await crewDocumentsRepository.findAttachmentByUuid(attUuid);
    const success = await crewDocumentsRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
    await deleteAttachmentFile(attachment?.filePath);
  },

  async getAttachmentFile(attUuid: string): Promise<CrewDocumentAttachment> {
    const attachment =
      await crewDocumentsRepository.findAttachmentByUuid(attUuid);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attUuid}`);
    }
    return attachment;
  },

  /**
   * Reconcile documents with attachments - handles add/update/delete in one transaction
   * Frontend sends array of items with:
   * - docUuid?: string - Existing document UUID (empty = new)
   * - isDeleted?: boolean - Mark for soft deletion
   * - data: DocumentData - Document field values
   * - attachments?: Array - Attachment changes
   */
  async reconcileWithAttachments(
    crewUuid: string,
    items: Array<{
      docUuid?: string;
      isDeleted?: boolean;
      data: Omit<InsertCrewDocument, "docUuid" | "crewUuid"> & { issuingCountry?: string };
      attachments?: Array<{
        attUuid?: string;
        isNew?: boolean;
        fileName: string;
        filePath?: string;
        fileData?: string;
      }>;
    }>,
    auditUserUuid: string | null = null
  ): Promise<CrewDocument[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    // Pre-resolve all country UUIDs before transaction
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.isDeleted) return item;

        const countryInput = item.data.issuingCountryUuid || (item.data as any).issuingCountry;
        if (countryInput) {
          const countryUuid = await resolveCountryUuid(countryInput);
          if (!countryUuid) {
            throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
          }
          const { issuingCountry, ...cleanData } = item.data as any;
          return { ...item, data: { ...cleanData, issuingCountryUuid: countryUuid } };
        }
        return item;
      })
    );

    return db.transaction(async (tx: any) => {
      const results: CrewDocument[] = [];
      const now = new Date();

      for (const item of resolvedItems) {
        if (item.isDeleted && item.docUuid) {
          await tx
            .update(crewDocuments)
            .set(applyAuditUser({ isDeleted: true, auditUserUuid }))
            .where(eq(crewDocuments.docUuid, item.docUuid));
          continue;
        }

        let docUuid: string;

        if (item.docUuid) {
          const [updated] = await tx
            .update(crewDocuments)
            .set(applyAuditUser({ ...item.data, auditUserUuid }))
            .where(eq(crewDocuments.docUuid, item.docUuid))
            .returning();
          docUuid = item.docUuid;
          results.push(updated);
        } else {
          docUuid = uuidv4();
          const [created] = await tx
            .insert(crewDocuments)
            .values(applyAuditUser({
              ...item.data,
              docUuid,
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
                "crew-pool/crew-documents",
                att.fileName,
                att.filePath,
                att.fileData,
              );
              await tx.insert(crewDocumentsAttachments).values(applyAuditUser({
                attUuid: uuidv4(),
                docUuid,
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
   * Get all documents with nested attachments for a crew member
   */
  async getAllWithAttachments(crewUuid: string): Promise<CrewDocumentWithAttachments[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    const documents = await db
      .select()
      .from(crewDocuments)
      .where(
        and(
          eq(crewDocuments.crewUuid, crewUuid),
          eq(crewDocuments.isDeleted, false)
        )
      );

    if (documents.length === 0) return [];

    const docUuids = documents.map((d: CrewDocument) => d.docUuid);
    const allAttachments = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(
        and(
          inArray(crewDocumentsAttachments.docUuid, docUuids),
          eq(crewDocumentsAttachments.isDeleted, false)
        )
      );

    const attachmentMap = new Map<string, CrewDocumentAttachment[]>();
    for (const att of allAttachments) {
      const existing = attachmentMap.get(att.docUuid) || [];
      existing.push(att);
      attachmentMap.set(att.docUuid, existing);
    }

    return documents.map((doc: CrewDocument) => ({
      ...doc,
      attachments: attachmentMap.get(doc.docUuid) || [],
    }));
  },
};
