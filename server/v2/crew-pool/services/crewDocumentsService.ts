import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
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

    // Remove non-schema fields
    const { issuingCountry, ...cleanData } = data as any;

    return crewDocumentsRepository.create({ ...cleanData, crewUuid });
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

    // Remove non-schema fields
    const { issuingCountry, ...cleanData } = data as any;

    const updated = await crewDocumentsRepository.update(docUuid, cleanData);
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
    const success = await crewDocumentsRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
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
    }>
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
            .set({ isDeleted: true, updatedAt: now })
            .where(eq(crewDocuments.docUuid, item.docUuid));
          continue;
        }

        let docUuid: string;

        if (item.docUuid) {
          const [updated] = await tx
            .update(crewDocuments)
            .set({ ...item.data, updatedAt: now })
            .where(eq(crewDocuments.docUuid, item.docUuid))
            .returning();
          docUuid = item.docUuid;
          results.push(updated);
        } else {
          docUuid = uuidv4();
          const [created] = await tx
            .insert(crewDocuments)
            .values({
              ...item.data,
              docUuid,
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
              await tx.insert(crewDocumentsAttachments).values({
                attUuid: uuidv4(),
                docUuid,
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

    const docUuids = documents.map((d) => d.docUuid);
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

    return documents.map((doc) => ({
      ...doc,
      attachments: attachmentMap.get(doc.docUuid) || [],
    }));
  },
};
